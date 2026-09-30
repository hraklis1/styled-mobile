import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import { IDLE, reduce } from './reducer';
import type { WearEvent, WearFlow } from './types';

const mmkv = createMMKV({ id: 'styled.wear-log' });

/** A review nobody has touched for this long is dropped rather than resumed. */
export const REVIEW_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * What survives a relaunch. Only a review is worth resuming: a scan that was
 * in flight has no photo data to resend yet (offline resume is Phase 4), a
 * save in flight goes back to review — it is idempotent on the flow id, so
 * tapping Log again can't double count — and a finished log is done.
 */
export function rehydrateFlow(flow: WearFlow | undefined, now: number): WearFlow {
  if (!flow) return IDLE;
  if (flow.status === 'saving') return { ...flow, status: 'reviewing', resolving: null };
  if (flow.status === 'reviewing') {
    return now - flow.updatedAt > REVIEW_MAX_AGE_MS ? IDLE : { ...flow, resolving: null };
  }
  return IDLE;
}

type WearLogState = {
  flow: WearFlow;
  dispatch: (event: WearEvent) => void;
};

export const useWearLogStore = create<WearLogState>()(
  persist(
    (set) => ({
      flow: IDLE,
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
        flow: rehydrateFlow((persisted as { flow?: WearFlow } | undefined)?.flow, Date.now()),
      }),
    },
  ),
);

export const dispatchWear = (event: WearEvent) => useWearLogStore.getState().dispatch(event);
