import { parseLocalCalendarDate } from '../../features/stylist/workflows';
import type { TripSummary } from '../../features/trips/types';

/** Which trip, if any, covers a calendar date. Trips are listed soonest first. */
export function tripOnDate(trips: TripSummary[], date: string): TripSummary | undefined {
  return trips.find((trip) => trip.startDate <= date && date <= trip.endDate);
}

export function tripDayNumber(trip: TripSummary, date: string): { day: number; of: number } | null {
  const start = parseLocalCalendarDate(trip.startDate), end = parseLocalCalendarDate(trip.endDate), at = parseLocalCalendarDate(date);
  if (!start || !end || !at) return null;
  return { day: Math.round((at.getTime() - start.getTime()) / 86_400_000) + 1, of: Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1 };
}

/**
 * The trip's line in a day heading. The first day carries packing progress,
 * since that's the morning it matters; later days say where in the trip you are.
 */
export function tripDayLabel(trip: TripSummary, date: string): string {
  if (date === trip.startDate) {
    const packing = trip.packable > 0
      ? (trip.packed >= trip.packable ? 'All packed' : `${trip.packed} of ${trip.packable} packed`)
      : null;
    return [`Leaving for ${trip.destination}`, packing].filter(Boolean).join(' · ');
  }
  const n = tripDayNumber(trip, date);
  return n ? `${trip.destination} · day ${n.day} of ${n.of}` : trip.destination;
}
