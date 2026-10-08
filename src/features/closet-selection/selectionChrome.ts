import { useSyncExternalStore } from 'react';

/**
 * Whether a closet selection currently owns the bottom of the screen. The
 * app-wide floating trays (batch import, polish, scan draft) step aside while
 * it does, so they never stack on the selection action bar.
 */
let selecting = false;
const listeners = new Set<() => void>();

export function setSelectionChromeActive(next: boolean) {
  if (next === selecting) return;
  selecting = next;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useSelectionChromeActive() {
  return useSyncExternalStore(subscribe, () => selecting);
}
