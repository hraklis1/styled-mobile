import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import type { BlockReason } from '../batch-import/types';

const mmkv = createMMKV({ id: 'styled.polish-queue' });

/** A job nobody could finish in this long is dropped (the item keeps its photo). */
export const POLISH_JOB_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PolishJobStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked';

export type PolishJob = {
  itemId: number;
  /** Stable across resumes, so a replayed request is never charged twice. */
  idempotencyKey: string;
  status: PolishJobStatus;
  attempts: number;
  notBefore: number;
  error: string | null;
  createdAt: number;
};

type PolishQueueState = {
  /** Supabase user id the jobs belong to; a queue never survives into another account. */
  userId: string | null;
  jobs: PolishJob[];
  blocked: BlockReason | null;
  /** Queue items just saved to the closet. Already-queued items are ignored. */
  enqueue: (userId: string, jobs: { itemId: number; idempotencyKey: string }[]) => void;
  patch: (itemId: number, patch: Partial<PolishJob>) => void;
  /** Credits ran out: everything still waiting would be refused the same way. */
  block: (reason: BlockReason) => void;
  unblock: () => void;
  retryFailed: () => void;
  /** Forget finished, failed and blocked jobs (the tray's dismiss). */
  clearSettled: () => void;
  reset: () => void;
};

/** A job that was mid-request when the app died goes back in the queue. */
export function resetInFlight(jobs: PolishJob[]): PolishJob[] {
  return jobs.map((job) => (job.status === 'running' ? { ...job, status: 'pending', notBefore: 0 } : job));
}

export const usePolishQueueStore = create<PolishQueueState>()(
  persist(
    (set) => ({
      userId: null,
      jobs: [],
      blocked: null,
      enqueue: (userId, incoming) => set((s) => {
        const base = s.userId === userId ? s.jobs : [];
        const known = new Set(base.map((job) => job.itemId));
        const now = Date.now();
        const added = incoming
          .filter((job) => !known.has(job.itemId))
          .map((job): PolishJob => ({
            ...job,
            status: s.blocked && s.userId === userId ? 'blocked' : 'pending',
            attempts: 0,
            notBefore: 0,
            error: null,
            createdAt: now,
          }));
        return { userId, jobs: [...base, ...added], blocked: s.userId === userId ? s.blocked : null };
      }),
      patch: (itemId, patch) => set((s) => ({
        jobs: s.jobs.map((job) => (job.itemId === itemId ? { ...job, ...patch } : job)),
      })),
      block: (reason) => set((s) => ({
        blocked: reason,
        jobs: s.jobs.map((job) => (job.status === 'pending' ? { ...job, status: 'blocked' } : job)),
      })),
      unblock: () => set((s) => ({
        blocked: null,
        jobs: s.jobs.map((job) => (job.status === 'blocked' ? { ...job, status: 'pending', notBefore: 0, error: null } : job)),
      })),
      retryFailed: () => set((s) => ({
        jobs: s.jobs.map((job) => (job.status === 'failed' ? { ...job, status: 'pending', attempts: 0, notBefore: 0, error: null } : job)),
      })),
      clearSettled: () => set((s) => ({
        blocked: null,
        jobs: s.jobs.filter((job) => job.status === 'pending' || job.status === 'running'),
      })),
      reset: () => set({ userId: null, jobs: [], blocked: null }),
    }),
    {
      name: 'polish-queue-v1',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (key) => mmkv.getString(key) ?? null,
        setItem: (key, value) => mmkv.set(key, value),
        removeItem: (key) => mmkv.remove(key),
      })),
      partialize: (s) => ({ userId: s.userId, jobs: s.jobs, blocked: s.blocked }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<Pick<PolishQueueState, 'userId' | 'jobs' | 'blocked'>> | undefined;
        const now = Date.now();
        const jobs = resetInFlight((stored?.jobs ?? []).filter((job) => now - job.createdAt < POLISH_JOB_MAX_AGE_MS));
        return { ...current, userId: stored?.userId ?? null, jobs, blocked: jobs.length ? stored?.blocked ?? null : null };
      },
    },
  ),
);

export const polishQueue = {
  get: () => usePolishQueueStore.getState(),
};

export type PolishSummary = {
  total: number;
  done: number;
  active: number;
  failed: number;
  blocked: number;
};

export function summarizePolish(jobs: readonly PolishJob[]): PolishSummary {
  const count = (status: PolishJobStatus) => jobs.filter((job) => job.status === status).length;
  return {
    total: jobs.length,
    done: count('done'),
    active: count('pending') + count('running'),
    failed: count('failed'),
    blocked: count('blocked'),
  };
}

/** Whether an item's polish is queued or running — for "Polishing…" marks on tiles. */
export function usePolishPending(itemId: number): boolean {
  return usePolishQueueStore((s) => s.jobs.some((job) => job.itemId === itemId && (job.status === 'pending' || job.status === 'running')));
}
