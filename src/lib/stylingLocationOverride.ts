import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateKey } from './dailyStylistPick';

export type LocationOverride =
  | { mode: 'current' }
  | { mode: 'home' }
  | { mode: 'destination'; label: string };

const KEY_PREFIX = 'styling-location-override:';

function keyForUser(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function parseOverride(value: unknown): LocationOverride | null {
  if (!value || typeof value !== 'object') return null;
  const mode = (value as { mode?: unknown }).mode;
  if (mode === 'home') return { mode: 'home' };
  if (mode === 'destination') {
    const label = (value as { label?: unknown }).label;
    if (typeof label === 'string' && label.trim()) {
      return { mode: 'destination', label: label.trim() };
    }
  }
  // 'current' is the default (no override) and is never persisted.
  return null;
}

/**
 * Returns the saved override only when it was stored today (local time).
 * A stale override from a previous day resets back to live location.
 */
export async function loadLocationOverride(userId: string): Promise<LocationOverride | null> {
  const raw = await AsyncStorage.getItem(keyForUser(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.date !== toLocalDateKey(new Date())) return null;
    return parseOverride(parsed?.override);
  } catch {
    return null;
  }
}

export async function saveLocationOverride(
  userId: string,
  override: LocationOverride,
): Promise<void> {
  if (override.mode === 'current') {
    await clearLocationOverride(userId);
    return;
  }
  await AsyncStorage.setItem(
    keyForUser(userId),
    JSON.stringify({ date: toLocalDateKey(new Date()), override }),
  );
}

export async function clearLocationOverride(userId: string): Promise<void> {
  await AsyncStorage.removeItem(keyForUser(userId));
}
