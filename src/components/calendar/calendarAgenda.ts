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
