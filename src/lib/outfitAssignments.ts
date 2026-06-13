import type { Event } from '../types/event';

export type UpcomingAssignmentSummary = {
  nextEvent: Event;
  count: number;
};

export function parseEventDate(date: string): Date {
  // Backend event timestamps are stored as local wall-clock values in a
  // timestamp-without-time-zone column, but are serialized with a trailing Z.
  // Parse that wire shape as local time so upcoming-event UI does not shift it.
  const localTimestamp = date.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{3})?Z$/)?.[1];
  return new Date(localTimestamp ?? date);
}

export function getUpcomingEvents(events: Event[], now = new Date()): Event[] {
  return events
    .filter((event) => parseEventDate(event.date).getTime() >= now.getTime())
    .sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());
}

export function getUpcomingOutfitEvents(events: Event[], outfitId: number, now = new Date()): Event[] {
  return getUpcomingEvents(events, now).filter((event) => event.outfitId === outfitId);
}

export function getUpcomingAssignmentSummaries(events: Event[], now = new Date()): Map<number, UpcomingAssignmentSummary> {
  const summaries = new Map<number, UpcomingAssignmentSummary>();
  for (const event of getUpcomingEvents(events, now)) {
    if (event.outfitId == null) continue;
    const summary = summaries.get(event.outfitId);
    if (summary) {
      summary.count += 1;
    } else {
      summaries.set(event.outfitId, { nextEvent: event, count: 1 });
    }
  }
  return summaries;
}
