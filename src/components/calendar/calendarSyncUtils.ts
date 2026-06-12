import type { CalendarPreviewEvent } from '../../hooks/useCalendarSync';

export interface CalendarPreviewSection {
  title: string;
  data: CalendarPreviewEvent[];
}

export type CalendarDateRange = 7 | 30 | 'all';

export interface CalendarPreviewFilters {
  search: string;
  dateRange: CalendarDateRange;
  occasions: string[];
}

export function partitionPreviewEvents(events: CalendarPreviewEvent[]) {
  return {
    newEvents: events.filter((event) => !event.alreadyImported),
    syncedEvents: events.filter((event) => event.alreadyImported),
  };
}

export function filterPreviewEvents(
  events: CalendarPreviewEvent[],
  filters: CalendarPreviewFilters,
  now = new Date(),
) {
  const query = filters.search.trim().toLocaleLowerCase();
  const occasionSet = new Set(filters.occasions);
  const rangeEnd = filters.dateRange === 'all'
    ? null
    : new Date(now.getTime() + filters.dateRange * 24 * 60 * 60 * 1000);

  return events.filter((event) => {
    const eventDate = new Date(event.date);
    if (Number.isNaN(eventDate.getTime()) || eventDate.getTime() < now.getTime()) return false;
    if (rangeEnd && eventDate.getTime() > rangeEnd.getTime()) return false;

    if (occasionSet.size > 0 && !occasionSet.has(event.occasion)) return false;

    if (query) {
      const title = event.title.toLocaleLowerCase();
      const location = event.location?.toLocaleLowerCase() ?? '';
      if (!title.includes(query) && !location.includes(query)) return false;
    }

    return true;
  });
}

export function createDefaultSelection(events: CalendarPreviewEvent[], now = new Date()) {
  const newEvents = events.filter((event) => !event.alreadyImported);
  return new Set(
    filterPreviewEvents(newEvents, { search: '', dateRange: 30, occasions: [] }, now)
      .map((event) => event.externalId),
  );
}

export function updateVisibleSelection(
  selected: Set<string>,
  visibleEvents: CalendarPreviewEvent[],
  action: 'select' | 'clear',
) {
  const next = new Set(selected);
  visibleEvents.forEach((event) => {
    if (action === 'select') next.add(event.externalId);
    else next.delete(event.externalId);
  });
  return next;
}

export function groupPreviewEventsByDate(events: CalendarPreviewEvent[]): CalendarPreviewSection[] {
  const groups = new Map<string, CalendarPreviewEvent[]>();

  events
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((event) => {
      const date = new Date(event.date);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const group = groups.get(key) ?? [];
      group.push(event);
      groups.set(key, group);
    });

  return Array.from(groups.values()).map((data) => ({
    title: new Date(data[0].date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    data,
  }));
}
