import { eventDayKey } from '../../components/calendar/calendarAgenda';
import { toDateStr } from '../../components/calendar/calendarUtils';
import type { Event } from '../../types/event';
import type { StylistTripPrefill } from '../../contexts/GlobalAIStylistContext';
import type { TripSummary } from './types';

/**
 * Calendar events that are really trips (docs/trip-planner.md). Mirrors the
 * server's eventTripSpan so a plan started here gets the dates sync will keep.
 */

const DAY_MS = 86_400_000;
const TRAVEL_WORDS = /\b(trip|travel|flight|fly(ing)?|holiday|vacation|getaway|honeymoon|retreat|hotel|airbnb|weekend away|road ?trip)\b/i;

function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d - 1));
}

/** First and last calendar day an event covers; all-day ends are exclusive at the source. */
export function eventTripSpan(event: Pick<Event, 'date' | 'calendarMetadata'>): { startDate: string; endDate: string } {
  const startDate = eventDayKey(event);
  const end = event.calendarMetadata?.endDate;
  let endDate = startDate;
  if (end) {
    endDate = /^\d{4}-\d{2}-\d{2}$/.test(end) ? previousDay(end) : toDateStr(new Date(Date.parse(end) - 1));
  }
  return { startDate, endDate: endDate < startDate ? startDate : endDate };
}

function nights(span: { startDate: string; endDate: string }): number {
  return Math.round((Date.parse(`${span.endDate}T12:00:00`) - Date.parse(`${span.startDate}T12:00:00`)) / DAY_MS);
}

/**
 * Overnight events are trips. A single day only counts when it's an all-day
 * event that says so ("Flight to Rome", "Lisbon trip"), so a timed meeting
 * that happens to name a city never is.
 */
export function isTripLikeEvent(event: Event): boolean {
  if (event.calendarMetadata?.cancelled) return false;
  if (nights(eventTripSpan(event)) >= 1) return true;
  return !!event.calendarMetadata?.allDay && TRAVEL_WORDS.test(event.title);
}

/**
 * "Trip to Lisbon" → "Lisbon"; the event's location wins when it has one.
 * Blank when the event doesn't name a place ("APS week"): a non-place
 * destination gets no forecast and no structured plan, so the user fills it.
 */
export function eventDestination(event: Pick<Event, 'title' | 'location'>): string {
  const location = event.location?.trim();
  if (location) return location.split('\n')[0].slice(0, 160);
  const title = event.title.trim();
  const to = title.match(/\b(?:to|in)\s+(.+)$/i);
  if (to) return to[1].trim().slice(0, 160);
  if (!TRAVEL_WORDS.test(title)) return '';
  return title.replace(TRAVEL_WORDS, '').replace(/[\s·:–-]+$/u, '').replace(/^[\s·:–-]+/u, '').trim().slice(0, 160);
}

/** The trip brief pre-fill for planning an event as a trip. */
export function tripPrefillFromEvent(event: Event): StylistTripPrefill {
  return { destination: eventDestination(event), ...eventTripSpan(event), eventId: event.id };
}

export function tripForEvent(trips: TripSummary[], eventId: number): TripSummary | undefined {
  return trips.find((trip) => trip.eventId === eventId);
}

/** "Lisbon, Portugal" → ["lisbon", "portugal"]: the words that name the place. */
function placeWords(destination: string): string[] {
  return destination.toLowerCase().split(/[,/]/).map((part) => part.trim()).filter((part) => part.length >= 3);
}

/**
 * Unlinked events that are plausibly this trip: they overlap its dates and
 * name the destination, read as travel, or cover exactly the same days.
 * Overlap alone isn't enough ("Simona away" spans the week but isn't Lisbon).
 */
export function linkableEventsForTrip(trip: { id: number; destination: string; startDate: string; endDate: string }, events: Event[], trips: TripSummary[]): Event[] {
  const linked = new Set(trips.filter((t) => t.id !== trip.id && t.eventId != null).map((t) => t.eventId));
  const place = placeWords(trip.destination);
  return events.filter((event) => {
    if (linked.has(event.id) || !isTripLikeEvent(event)) return false;
    const span = eventTripSpan(event);
    if (span.startDate > trip.endDate || trip.startDate > span.endDate) return false;
    const text = `${event.title} ${event.location ?? ''}`.toLowerCase();
    const namesPlace = place.some((word) => text.includes(word));
    const sameDays = span.startDate === trip.startDate && span.endDate === trip.endDate;
    return namesPlace || TRAVEL_WORDS.test(event.title) || sameDays;
  });
}
