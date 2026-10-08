import type { Item } from '../types/item';

// Mirrors server/lookReadiness.ts isAvailableNow: a state with an until-date
// lapses on its own once that local date has passed, so a forgotten "in the
// wash" never hides an item from the stylist for good.

export type Availability = 'available' | 'laundry' | 'lent' | 'stored';

export const AVAILABILITY_LABELS: Record<Exclude<Availability, 'available'>, string> = {
  laundry: 'In the wash',
  lent: 'Lent out',
  stored: 'Stored away',
};

/** Laundry clears itself after a few days; lent and stored wait for the user. */
const LAPSE_DAYS: Partial<Record<Availability, number>> = { laundry: 3 };

function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isAvailableNow(item: Pick<Item, 'availability' | 'availabilityUntil'>, today = localDate()): boolean {
  if (!item.availability || item.availability === 'available') return true;
  return item.availabilityUntil != null && item.availabilityUntil < today;
}

/** The PATCH body that puts an item into `availability`. */
export function availabilityPatch(availability: Availability, now = new Date()): Pick<Item, 'availability' | 'availabilityUntil'> {
  const days = LAPSE_DAYS[availability];
  if (days == null) return { availability, availabilityUntil: null };
  const until = new Date(now);
  until.setDate(until.getDate() + days);
  return { availability, availabilityUntil: localDate(until) };
}
