import type { LocationOverride } from './stylingLocationOverride';

/**
 * Process-wide source of truth for the active styling-location override.
 *
 * `useActiveStylingLocation` is called independently from several long-lived
 * places (the home screen and the always-mounted AI stylist modal). Keeping the
 * override in component-local state let those copies drift: changing the
 * location on the home screen never reached the stylist instance. A single
 * shared store keeps every consumer in sync and propagates changes
 * synchronously, without waiting on an AsyncStorage round-trip.
 */

let currentOverride: LocationOverride | null = null;
const listeners = new Set<() => void>();

export function getOverrideSnapshot(): LocationOverride | null {
  return currentOverride;
}

export function setOverrideSnapshot(next: LocationOverride | null): void {
  if (currentOverride === next) return;
  currentOverride = next;
  for (const listener of listeners) listener();
}

export function subscribeOverride(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
