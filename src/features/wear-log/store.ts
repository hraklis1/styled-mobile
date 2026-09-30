import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import { relocateLocalUris } from '../../lib/relocateLocalUri';
import { draftFrom, IDLE, reduce } from './reducer';
import type { Resolution, ReviewFlow, WearEvent, WearFlow } from './types';

const mmkv = createMMKV({ id: 'styled.wear-log' });

/** A review nobody has touched for this long is dropped rather than resumed. */
export const REVIEW_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * What survives a relaunch. A scan in flight or waiting for the connection
 * resumes — its photo is on disk and the retry reuses the flow id as the
 * idempotency key, so a scan the server already charged for is replayed. A
 * save in flight goes back to review (Log again is idempotent on the flow
 * id), and a finished log is done. Anything untouched for a day is dropped.
 */
export function rehydrateFlow(flow: WearFlow | undefined, now: number): WearFlow {
  if (!flow || flow.status === 'idle' || flow.status === 'logged') return IDLE;
  if (flow.status === 'processing') {
    return now - flow.startedAt > REVIEW_MAX_AGE_MS ? IDLE : { ...flow, startedAt: now };
  }
  if (flow.status === 'failed') return flow;
  if (flow.status === 'saving') return withDrafts({ ...flow, status: 'reviewing', resolving: null });
  return now - flow.updatedAt > REVIEW_MAX_AGE_MS ? IDLE : withDrafts({ ...flow, resolving: null });
}

/** Reviews saved before drafts existed hold `{ kind: 'new' }` alone. */
function withDrafts(flow: ReviewFlow): ReviewFlow {
  const resolutions: Record<string, Resolution> = {};
  for (const d of flow.scan.detections) {
    const r = flow.resolutions[d.id] as Resolution | { kind: 'new'; draft?: undefined } | undefined;
    resolutions[d.id] = r?.kind === 'new' && !r.draft ? { kind: 'new', draft: draftFrom(d) } : (r ?? { kind: 'unresolved' }) as Resolution;
  }
  return { ...flow, resolutions, additionalItemIds: [...new Set(flow.additionalItemIds ?? [])] };
}

type WearLogState = {
  flow: WearFlow;
  /** Whether the logger is showing the flow; the tray stands in when it isn't. */
  workspaceOpen: boolean;
  dispatch: (event: WearEvent) => void;
  setWorkspaceOpen: (open: boolean) => void;
};

export const useWearLogStore = create<WearLogState>()(
  persist(
    (set) => ({
      flow: IDLE,
      workspaceOpen: false,
      setWorkspaceOpen: (workspaceOpen) => set({ workspaceOpen }),
      dispatch: (event) =>
        set((s) => {
          const next = reduce(s.flow, event);
          if (next === s.flow) return s;
          // Any decision in review refreshes its age.
          return { flow: next.status === 'reviewing' ? { ...next, updatedAt: Date.now() } : next };
        }),
    }),
    {
      name: 'wear-log-flow',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (k) => mmkv.getString(k) ?? null,
        setItem: (k, v) => mmkv.set(k, v),
        removeItem: (k) => { mmkv.remove(k); },
      })),
      partialize: (s) => ({ flow: s.flow }),
      merge: (persisted, current) => ({
        ...current,
        // The sandbox path moves on every install/update; re-root the photo.
        flow: relocateLocalUris(rehydrateFlow((persisted as { flow?: WearFlow } | undefined)?.flow, Date.now())),
      }),
    },
  ),
);

export const dispatchWear = (event: WearEvent) => useWearLogStore.getState().dispatch(event);
