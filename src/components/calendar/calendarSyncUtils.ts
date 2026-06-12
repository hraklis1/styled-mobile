import type { CalendarPreviewEvent } from '../../hooks/useCalendarSync';

export interface CalendarPreviewSection {
  title: string;
  data: CalendarPreviewEvent[];
}

export function partitionPreviewEvents(events: CalendarPreviewEvent[]) {
  return {
    newEvents: events.filter((event) => !event.alreadyImported),
    syncedEvents: events.filter((event) => event.alreadyImported),
  };
}

export function createDefaultSelection(events: CalendarPreviewEvent[]) {
  return new Set(
    events.filter((event) => !event.alreadyImported).map((event) => event.externalId),
  );
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
