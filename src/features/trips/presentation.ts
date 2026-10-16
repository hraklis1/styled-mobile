import type { Ionicons } from '@expo/vector-icons';
import type { Item } from '../../types/item';
import { parseLocalCalendarDate } from '../stylist/workflows';
import type { TripLuggageFit, TripPlanV2, TripWeatherCondition } from './types';

type IconName = keyof typeof Ionicons.glyphMap;

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short' });

export function tripDayParts(date: string): { weekday: string; day: string; month: string } {
  const parsed = parseLocalCalendarDate(date);
  if (!parsed) return { weekday: '', day: date, month: '' };
  return { weekday: WEEKDAY.format(parsed), day: String(parsed.getDate()), month: MONTH.format(parsed) };
}

export function weatherIcon(condition: TripWeatherCondition): IconName {
  switch (condition) {
    case 'sunny': return 'sunny-outline';
    case 'cloudy': return 'partly-sunny-outline';
    case 'rainy': return 'rainy-outline';
    case 'snowy': return 'snow-outline';
    case 'stormy': return 'thunderstorm-outline';
  }
}

export function luggageFitCopy(fit: TripLuggageFit | null | undefined): string | null {
  switch (fit) {
    case 'comfortable': return 'Fits a carry-on';
    case 'tight': return 'A snug carry-on';
    case 'over': return 'More than a carry-on';
    default: return null;
  }
}

/** "Thu 12, Sat 14" — the days a look is worn, for the looks list. */
export function daysWearingLook(plan: TripPlanV2, lookIndex: number): string {
  return (plan.days ?? [])
    .filter((day) => day.lookIndexes.includes(lookIndex))
    .map((day) => { const p = tripDayParts(day.date); return `${p.weekday} ${p.day}`; })
    .join(', ');
}

const GROUPS: Array<{ key: string; title: string; categories: string[] }> = [
  { key: 'outerwear', title: 'Outerwear', categories: ['outerwear'] },
  { key: 'tops', title: 'Tops', categories: ['top'] },
  { key: 'bottoms', title: 'Bottoms', categories: ['bottom'] },
  { key: 'dresses', title: 'Dresses & one-pieces', categories: ['full_body'] },
  { key: 'shoes', title: 'Shoes', categories: ['shoes'] },
  { key: 'accessories', title: 'Accessories', categories: ['accessory', 'valuables'] },
];

/** A look's pieces in head-to-toe order, so every day's strip reads the same way. */
export function orderLookPieces(pieces: Item[]): Item[] {
  const rank = (item: Item) => {
    const i = GROUPS.findIndex((g) => g.categories.includes(item.category ?? ''));
    return i === -1 ? GROUPS.length : i;
  };
  return pieces.map((item, i) => ({ item, i })).sort((a, b) => rank(a.item) - rank(b.item) || a.i - b.i).map((x) => x.item);
}

export type PackingRow = { item: Item; uses: number };
export type PackingGroup = { key: string; title: string; rows: PackingRow[] };

/**
 * The owned packing list, grouped the way a suitcase is packed. Pieces worn in
 * transit come first as their own group: they never go in the bag, so they
 * don't count toward what's packed.
 */
export function packingGroups(plan: TripPlanV2, items: Item[]): { transit: PackingRow[]; groups: PackingGroup[] } {
  const byId = new Map(items.map((item) => [item.id, item]));
  const uses = new Map((plan.capsule ?? []).map((c) => [c.itemId, c.uses]));
  const travel = plan.travelLookIndex != null ? plan.outfits[plan.travelLookIndex] : undefined;
  const transitIds = new Set(travel ? (travel.status === 'incomplete' ? travel.foundationItemIds ?? travel.itemIds : travel.itemIds) : []);
  const rows = (plan.packingItemIds ?? []).flatMap((id) => {
    const item = byId.get(id);
    return item ? [{ item, uses: uses.get(id) ?? 1 }] : [];
  });
  const transit = rows.filter((row) => transitIds.has(row.item.id));
  const bag = rows.filter((row) => !transitIds.has(row.item.id));
  const known = new Set(GROUPS.flatMap((g) => g.categories));
  const groups = [
    ...GROUPS.map((group) => ({ key: group.key, title: group.title, rows: bag.filter((row) => group.categories.includes(row.item.category ?? '')) })),
    { key: 'other', title: 'Everything else', rows: bag.filter((row) => !known.has(row.item.category ?? '')) },
  ].filter((group) => group.rows.length > 0);
  return { transit, groups };
}

/** Pieces to tick: everything in the bag plus the unowned extras. */
export function packingProgress(plan: TripPlanV2, items: Item[], packedItemIds: number[], packedExtras: string[]) {
  const { groups } = packingGroups(plan, items);
  const bagIds = groups.flatMap((g) => g.rows.map((r) => r.item.id));
  const packed = new Set(packedItemIds);
  const extras = new Set(packedExtras.map((e) => e.toLowerCase()));
  const done = bagIds.filter((id) => packed.has(id)).length + plan.packingList.filter((e) => extras.has(e.toLowerCase())).length;
  const total = bagIds.length + plan.packingList.length;
  return { done, total, fraction: total ? done / total : 0 };
}
