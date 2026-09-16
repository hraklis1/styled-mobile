import type { ShoppingSnap } from '../types/shoppingSnap';
import { dateGroupLabel } from './shoppingGallery';

/**
 * What the visit review's header says, computed once. The organizer lays it
 * out; the words live here so they can be tested without rendering.
 */
export type ShoppingVisitReviewHeader = {
  eyebrow: string;
  /** The store, or a date-based stand-in when no snap carries one. */
  title: string;
  /** "Today · 4:10 PM" — the day label the shortlist already uses, plus the time. */
  meta: string;
};

export type VisitReviewHeaderOptions = {
  isLiveVisit: boolean;
  /** Store from the session record, for a visit whose snaps were never tagged with one. */
  fallbackStoreName?: string | null;
  now?: Date;
};

export function buildVisitReviewHeader(
  snaps: ShoppingSnap[],
  { isLiveVisit, fallbackStoreName = null, now = new Date() }: VisitReviewHeaderOptions,
): ShoppingVisitReviewHeader {
  const earliest = snaps.reduce<ShoppingSnap | null>((best, snap) => (
    best === null || new Date(snap.capturedAt).getTime() < new Date(best.capturedAt).getTime() ? snap : best
  ), null);
  const capturedAt = earliest ? new Date(earliest.capturedAt) : now;
  const dayLabel = dateGroupLabel(capturedAt, now);
  const time = capturedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const storeName = snaps.find((snap) => snap.storeName)?.storeName ?? fallbackStoreName;

  return {
    eyebrow: isLiveVisit ? 'THIS VISIT' : 'EARLIER VISIT',
    title: storeName ?? (dayLabel === 'Today' ? "Today's visit" : 'Earlier visit'),
    meta: `${dayLabel} · ${time}`,
  };
}
