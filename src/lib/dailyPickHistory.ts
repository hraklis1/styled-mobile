import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailyPickHistoryEntry } from './dailyStylistPick';

const HISTORY_LIMIT = 7;
const KEY_PREFIX = 'daily-stylist-picks:';

function keyForUser(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export async function loadDailyPickHistory(userId: string): Promise<DailyPickHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(keyForUser(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => (
        typeof entry?.date === 'string'
        && typeof entry?.outfitId === 'number'
        && Number.isFinite(entry.outfitId)
      ))
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function recordDailyPick(
  history: DailyPickHistoryEntry[],
  entry: DailyPickHistoryEntry,
): DailyPickHistoryEntry[] {
  return [
    entry,
    ...history.filter((existing) => existing.date !== entry.date),
  ].slice(0, HISTORY_LIMIT);
}

export async function saveDailyPickHistory(
  userId: string,
  history: DailyPickHistoryEntry[],
): Promise<void> {
  await AsyncStorage.setItem(keyForUser(userId), JSON.stringify(history.slice(0, HISTORY_LIMIT)));
}
