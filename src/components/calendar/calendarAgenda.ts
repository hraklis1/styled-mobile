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

export type DayPlanningStatus = 'needs' | 'planned';

/**
 * One signal per day for the strip and month grid: hollow when a timed event
 * that day still needs a look, filled once every timed event has one. Days
 * with no events, or only unplanned all-day ones, are absent: no dot at all.
 */
export function buildPlanningStatusMap(events: Event[]): Map<string, DayPlanningStatus> {
  const map = new Map<string, DayPlanningStatus>();
  for (const event of events) {
    const day = eventDayKey(event);
    const planned = (event.itemIds ?? []).length > 0;
    // All-day entries are mostly shifts, trips and reminders. They only count
    // once a look is planned for them, never as a day that needs one.
    if (!planned && event.calendarMetadata?.allDay) continue;
    if (!planned) map.set(day, 'needs');
    else if (!map.has(day)) map.set(day, 'planned');
  }
  return map;
}

export type AgendaDay = { date: string; allDay: Event[]; timed: Event[] };

export type AgendaWindow = {
  days: AgendaDay[];
  /** Past days with events that are not loaded yet. */
  earlierCount: number;
  /** Future days with events that are not loaded yet. */
  laterCount: number;
};

/**
 * The unified timeline: day sections from `pastDayCount` event days before
 * today through `futureDayCount` event days from today. `pinnedDate` keeps an
 * empty, explicitly chosen day in the timeline so it has somewhere to land.
 */
export function buildAgendaWindow(
  events: Event[],
  { todayStr, pastDayCount, futureDayCount, pinnedDate }: {
    todayStr: string;
    pastDayCount: number;
    futureDayCount: number;
    pinnedDate?: string | null;
  },
): AgendaWindow {
  const byDay = new Map<string, Event[]>();
  for (const event of sortCalendarEvents(events)) {
    const day = eventDayKey(event);
    const group = byDay.get(day);
    if (group) group.push(event);
    else byDay.set(day, [event]);
  }
  const dates = [...byDay.keys()];
  const past = dates.filter((date) => date < todayStr);
  const future = dates.filter((date) => date >= todayStr);
  const visiblePast = pastDayCount > 0 ? past.slice(-pastDayCount) : [];
  const visibleFuture = future.slice(0, futureDayCount);
  const visible = new Set([...visiblePast, ...visibleFuture]);
  if (pinnedDate) visible.add(pinnedDate);

  const days = [...visible].sort().map((date) => {
    const group = byDay.get(date) ?? [];
    return {
      date,
      allDay: group.filter((event) => event.calendarMetadata?.allDay),
      timed: group.filter((event) => !event.calendarMetadata?.allDay),
    };
  });
  return {
    days,
    earlierCount: past.length - visiblePast.length,
    laterCount: future.length - visibleFuture.length,
  };
}

/**
 * How many event days each side of today must be loaded for `date` to sit
 * inside the window. Used when the strip jumps beyond what is loaded.
 */
export function windowCountsForDate(events: Event[], date: string, todayStr: string): { past: number; future: number } {
  const dates = new Set(events.map(eventDayKey));
  let past = 0;
  let future = 0;
  for (const day of dates) {
    if (day < todayStr && day >= date) past += 1;
    if (day >= todayStr && day <= date) future += 1;
  }
  return { past, future };
}

export type UpcomingDay = {
  date: string;
  /** All the day's events, all-day first, then by time. */
  events: Event[];
  /** The first event with a planned look; its collage stands for the day. */
  lookEvent: Event | null;
};

/** The next `limit` days that have events, from today, for Home's rail. */
export function buildUpcomingDays(events: Event[], todayStr: string, limit: number): UpcomingDay[] {
  const days: UpcomingDay[] = [];
  for (const event of sortCalendarEvents(events)) {
    const date = eventDayKey(event);
    if (date < todayStr) continue;
    let day = days[days.length - 1];
    if (!day || day.date !== date) {
      if (days.length === limit) break;
      day = { date, events: [], lookEvent: null };
      days.push(day);
    }
    day.events.push(event);
    if (!day.lookEvent && (event.itemIds ?? []).length > 0) day.lookEvent = event;
  }
  return days;
}

/**
 * The event the agenda features: the first upcoming timed event, or an
 * all-day one only once it has a look (shifts and reminders aren't outfits).
 * Featured only today or tomorrow, so a quiet week doesn't lead with a card
 * about something days away. `upcoming` is sorted and starts at today.
 */
export function heroEventFor(upcoming: Event[], todayStr: string): Event | null {
  const tomorrow = new Date(`${todayStr}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toDateStr(tomorrow);
  for (const event of upcoming) {
    const day = eventDayKey(event);
    if (day > tomorrowStr) return null;
    if (day < todayStr) continue;
    if (!event.calendarMetadata?.allDay || (event.itemIds ?? []).length > 0) return event;
  }
  return null;
}
