import type { OutfitLog } from '../hooks/useOutfitLogs';
import type { Item, ItemCategory, NormalizedColor } from '../types/item';
import { NORMALIZED_COLOR_HEX, normalizedColorDisplayName } from './colorUtils';

/** Below this, percentages are noise; the card asks for more pieces instead. */
export const INSIGHTS_MIN_ITEMS = 8;
/** Cost per wear is only honest once a few pieces carry a price. */
const MIN_PRICED_ITEMS = 3;
const ACTIVE_WINDOW_DAYS = 90;
/** Matches the server's Closet Refresh stale rule, so the two screens agree. */
const SLEEPING_DAYS = 60;
const RHYTHM_WEEKS = 12;
const DAY_MS = 86_400_000;

export type ColorShare = { key: string; label: string; hex: string; count: number; share: number };
export type CategoryShare = { category: ItemCategory; count: number; share: number };
export type ValuePick = { item: Item; costPerWear: number };

export type ClosetInsights = {
  totalItems: number;
  /** False below INSIGHTS_MIN_ITEMS; the card shows an unlock prompt instead. */
  ready: boolean;
  /** Share of pieces worn in the last 90 days, 0–1. */
  activeShare: number;
  activeCount: number;
  /** null when fewer than MIN_PRICED_ITEMS worn pieces have a price. */
  avgCostPerWear: number | null;
  sleeping: Item[];
  colors: ColorShare[];
  categories: CategoryShare[];
  hardestWorking: Item[];
  bestValue: ValuePick[];
  /** Wear logs per week, oldest first; empty below 3 logs in the window. */
  rhythm: number[];
};

function daysSince(iso: string | null, now: Date): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Infinity : (now.getTime() - t) / DAY_MS;
}

function topColors(items: Item[]): ColorShare[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.colorNormalized;
    if (key && key in NORMALIZED_COLOR_HEX) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  // Five named colors and the long tail folded together keeps the strip legible.
  const head = sorted.slice(0, 5).map(([key, count]) => ({
    key,
    label: normalizedColorDisplayName(key as NormalizedColor),
    hex: NORMALIZED_COLOR_HEX[key as NormalizedColor],
    count,
    share: count / total,
  }));
  const rest = sorted.slice(5).reduce((sum, [, c]) => sum + c, 0);
  if (rest > 0) head.push({ key: 'other', label: 'Other', hex: '#BDB7AD', count: rest, share: rest / total });
  return head;
}

function weeklyRhythm(logs: OutfitLog[], now: Date): number[] {
  const weeks = new Array<number>(RHYTHM_WEEKS).fill(0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  for (const log of logs) {
    const [y, m, d] = log.date.slice(0, 10).split('-').map(Number);
    const t = new Date(y, m - 1, d).getTime();
    const weeksAgo = Math.floor((end - t - 1) / (7 * DAY_MS));
    if (weeksAgo >= 0 && weeksAgo < RHYTHM_WEEKS) weeks[RHYTHM_WEEKS - 1 - weeksAgo] += 1;
  }
  // A line through one or two logs is a spike, not a rhythm.
  return weeks.reduce((a, b) => a + b, 0) >= 3 ? weeks : [];
}

export function buildClosetInsights(
  allItems: Item[],
  logs: OutfitLog[],
  now: Date = new Date(),
): ClosetInsights {
  const items = allItems.filter((item) => !item.isArchived);
  const total = items.length;

  const active = items.filter((item) => daysSince(item.lastWornAt, now) <= ACTIVE_WINDOW_DAYS);

  const priced = items.filter((item) => (item.purchasePrice ?? 0) > 0 && item.wearCount > 0);
  const avgCostPerWear = priced.length >= MIN_PRICED_ITEMS
    ? priced.reduce((s, i) => s + Number(i.purchasePrice), 0) / priced.reduce((s, i) => s + i.wearCount, 0)
    : null;

  // Grace period: a piece added last week isn't "sleeping", it's new.
  const sleeping = items
    .filter((item) => daysSince(item.lastWornAt, now) > SLEEPING_DAYS && daysSince(item.createdAt, now) > SLEEPING_DAYS)
    .sort((a, b) => daysSince(b.lastWornAt, now) - daysSince(a.lastWornAt, now));

  const byCategory = new Map<ItemCategory, number>();
  for (const item of items) {
    if (item.category) byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
  }
  const categories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count, share: count / total }));

  const hardestWorking = items
    .filter((item) => item.wearCount > 0)
    .sort((a, b) => b.wearCount - a.wearCount)
    .slice(0, 5);

  const bestValue = priced
    .map((item) => ({ item, costPerWear: Number(item.purchasePrice) / item.wearCount }))
    .sort((a, b) => a.costPerWear - b.costPerWear)
    .slice(0, 3);

  return {
    totalItems: total,
    ready: total >= INSIGHTS_MIN_ITEMS,
    activeShare: total ? active.length / total : 0,
    activeCount: active.length,
    avgCostPerWear,
    sleeping,
    colors: topColors(items),
    categories,
    hardestWorking,
    bestValue,
    rhythm: weeklyRhythm(logs, now),
  };
}
