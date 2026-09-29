import type { OutfitLog } from '../hooks/useOutfitLogs';
import { toLocalDateKey } from './dailyStylistPick';

export type WearWeekDay = {
  /** Local `YYYY-MM-DD`, the same shape `OutfitLog.date` is stored in. */
  dateKey: string;
  date: Date;
  isToday: boolean;
  /** The day's latest entry, when more than one was logged. */
  log: OutfitLog | null;
};

export type WearWeek = {
  days: WearWeekDay[];
  loggedCount: number;
  /** The most recent entry on or before today, in the window or earlier. */
  lastLog: OutfitLog | null;
};

function latestFirst(a: OutfitLog, b: OutfitLog): number {
  const byDate = b.date.slice(0, 10).localeCompare(a.date.slice(0, 10));
  if (byDate !== 0) return byDate;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * Buckets wear logs into the seven days ending on `today`, oldest first.
 * A rolling window rather than the Calendar tab's Monday week: a calendar
 * week is mostly future days early on (all but one on a Monday), and a future
 * day can't be logged, so the strip would sit empty exactly when a user is
 * most likely to have days to back-fill.
 */
export function buildWearWeek(logs: OutfitLog[], today: Date = new Date()): WearWeek {
  const todayKey = toLocalDateKey(today);

  const sorted = [...logs].sort(latestFirst);
  const latestByDay = new Map<string, OutfitLog>();
  for (const log of sorted) {
    const key = log.date.slice(0, 10);
    if (!latestByDay.has(key)) latestByDay.set(key, log);
  }

  const days: WearWeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
    const dateKey = toLocalDateKey(date);
    return {
      dateKey,
      date,
      isToday: dateKey === todayKey,
      log: latestByDay.get(dateKey) ?? null,
    };
  });

  return {
    days,
    loggedCount: days.filter((day) => day.log).length,
    lastLog: sorted.find((log) => log.date.slice(0, 10) <= todayKey) ?? null,
  };
}
