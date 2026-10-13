import type { Event } from '../../types/event';
import { toDateStr } from './calendarUtils';

export type AgendaDateItem = {
  kind: string;
  event?: { date: string };
  date?: string;
};

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function monthHeading(dateStr: string, currentYear: number): string {
  const date = new Date(`${monthKey(dateStr)}-01T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    ...(date.getFullYear() === currentYear ? {} : { year: 'numeric' }),
  });
}

/** The hero is the first destination on its day; later events remain in the agenda. */
export function findAgendaDateIndex(items: AgendaDateItem[], dateStr: string): number {
  return items.findIndex((item) => {
    if (item.kind === 'day-placeholder') return item.date === dateStr;
    if ((item.kind === 'hero' || item.kind === 'event' || item.kind === 'past-event') && item.event) {
      return toDateStr(new Date(item.event.date)) === dateStr;
    }
    return false;
  });
}

/** All-day dates belong to the source's calendar date, independent of UTC offsets. */
export function eventDayKey(event: Pick<Event, 'date' | 'calendarMetadata'>): string {
  return event.calendarMetadata?.allDay && event.calendarMetadata.allDayDate
    ? event.calendarMetadata.allDayDate
    : toDateStr(new Date(event.date));
}

export function sortCalendarEvents(events: Event[]): Event[] {
  return [...events].sort((a, b) => eventDayKey(a).localeCompare(eventDayKey(b))
    || Number(!!b.calendarMetadata?.allDay) - Number(!!a.calendarMetadata?.allDay)
    || new Date(a.date).getTime() - new Date(b.date).getTime()
    || a.id - b.id);
}

export function eventsForCalendarDay(events: Event[], date: string): Event[] {
  return sortCalendarEvents(events.filter((event) => eventDayKey(event) === date));
}

export function agendaDayHeading(date: string, today = new Date()): string {
  const day = new Date(`${date}T12:00:00`);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const prefix = date === toDateStr(today) ? 'Today · ' : date === toDateStr(tomorrow) ? 'Tomorrow · ' : '';
  return prefix + day.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    ...(day.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}
