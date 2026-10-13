import { findAgendaDateIndex, monthHeading, monthKey, type AgendaDateItem } from '../calendarAgenda';

describe('calendar agenda presentation', () => {
  it('uses one month key for all dates in a month and includes a different year', () => {
    expect(monthKey('2026-11-01')).toBe('2026-11');
    expect(monthKey('2026-11-30')).toBe('2026-11');
    expect(monthKey('2027-01-01')).toBe('2027-01');
    expect(monthHeading('2026-11-16', 2026)).toBe('November');
    expect(monthHeading('2027-01-02', 2026)).toBe('January 2027');
  });

  it('lands on the hero before another event on the same day', () => {
    const items: AgendaDateItem[] = [
      { kind: 'week-strip' },
      { kind: 'month-heading' },
      { kind: 'hero', event: { date: '2026-10-11T09:00:00' } },
      { kind: 'event', event: { date: '2026-10-11T19:00:00' } },
    ];
    expect(findAgendaDateIndex(items, '2026-10-11')).toBe(2);
  });

  it('finds an event after its collapsed section is expanded', () => {
    const collapsed: AgendaDateItem[] = [
      { kind: 'week-strip' },
      { kind: 'hero', event: { date: '2026-10-11T09:00:00' } },
      { kind: 'show-upcoming' },
    ];
    expect(findAgendaDateIndex(collapsed, '2026-12-01')).toBe(-1);
    const expanded = [...collapsed, { kind: 'event', event: { date: '2026-12-01T19:00:00' } }];
    expect(findAgendaDateIndex(expanded, '2026-12-01')).toBe(3);
  });

  it('targets past events and empty dates without relying on visible headings', () => {
    const items: AgendaDateItem[] = [
      { kind: 'week-strip' },
      { kind: 'past-toggle' },
      { kind: 'past-event', event: { date: '2026-08-05T20:00:00' } },
      { kind: 'day-placeholder', date: '2026-08-04' },
    ];
    expect(findAgendaDateIndex(items, '2026-08-05')).toBe(2);
    expect(findAgendaDateIndex(items, '2026-08-04')).toBe(3);
  });
});

describe('unified agenda window', () => {
  const { buildAgendaWindow, buildPlanningStatusMap, windowCountsForDate } = require('../calendarAgenda');
  const ev = (id: number, date: string, extra: Record<string, unknown> = {}) => ({
    id, userId: 1, title: `Event ${id}`, date, occasion: 'casual', location: null,
    notes: null, environment: null, itemIds: null, outfitId: null, ...extra,
  });
  const events = [
    ev(1, '2026-10-01T09:00:00'),
    ev(2, '2026-10-05T09:00:00'),
    ev(3, '2026-10-13T09:00:00', { itemIds: [1] }),
    ev(4, '2026-10-14T09:00:00'),
    ev(5, '2026-10-14T23:00:00Z', { calendarMetadata: { calendarId: 'w', calendarName: 'W', allDay: true, allDayDate: '2026-10-14', cancelled: false, syncedAt: '' } }),
    ev(6, '2026-10-20T09:00:00', { itemIds: [2] }),
  ];
  const today = '2026-10-13';

  it('starts at today, hides past days and splits all-day from timed events', () => {
    const window = buildAgendaWindow(events, { todayStr: today, pastDayCount: 0, futureDayCount: 2 });
    expect(window.days.map((d: any) => d.date)).toEqual(['2026-10-13', '2026-10-14']);
    expect(window.days[1].allDay.map((e: any) => e.id)).toEqual([5]);
    expect(window.days[1].timed.map((e: any) => e.id)).toEqual([4]);
    expect(window.earlierCount).toBe(2);
    expect(window.laterCount).toBe(1);
  });

  it('loads the most recent past days first and keeps a pinned empty day', () => {
    const window = buildAgendaWindow(events, { todayStr: today, pastDayCount: 1, futureDayCount: 1, pinnedDate: '2026-10-16' });
    expect(window.days.map((d: any) => d.date)).toEqual(['2026-10-05', '2026-10-13', '2026-10-16']);
    expect(window.days[2]).toEqual({ date: '2026-10-16', allDay: [], timed: [] });
    expect(window.earlierCount).toBe(1);
  });

  it('marks a day as needing a look until every event on it is planned', () => {
    const status = buildPlanningStatusMap(events);
    expect(status.get('2026-10-13')).toBe('planned');
    expect(status.get('2026-10-14')).toBe('needs');
    expect(status.get('2026-10-20')).toBe('planned');
    expect(status.has('2026-10-15')).toBe(false);
  });

  it('counts the event days needed to include a jump target', () => {
    expect(windowCountsForDate(events, '2026-10-01', today)).toEqual({ past: 2, future: 0 });
    expect(windowCountsForDate(events, '2026-10-20', today)).toEqual({ past: 0, future: 3 });
  });
});

describe('all-day planning rule', () => {
  const { buildPlanningStatusMap } = require('../calendarAgenda');
  const allDay = (date: string) => ({ calendarId: 'w', calendarName: 'W', allDay: true, allDayDate: date, cancelled: false, syncedAt: '' });
  const ev = (id: number, date: string, extra: Record<string, unknown> = {}) => ({
    id, userId: 1, title: `E${id}`, date, occasion: 'casual', location: null,
    notes: null, environment: null, itemIds: null, outfitId: null, ...extra,
  });

  it('never marks a day as needing a look for unplanned all-day events alone', () => {
    const status = buildPlanningStatusMap([
      ev(1, '2026-10-13T00:00:00Z', { calendarMetadata: allDay('2026-10-13') }),
      ev(2, '2026-10-14T00:00:00Z', { calendarMetadata: allDay('2026-10-14'), itemIds: [1] }),
      ev(3, '2026-10-15T00:00:00Z', { calendarMetadata: allDay('2026-10-15') }),
      ev(4, '2026-10-15T09:00:00'),
    ]);
    expect(status.has('2026-10-13')).toBe(false);
    expect(status.get('2026-10-14')).toBe('planned');
    expect(status.get('2026-10-15')).toBe('needs');
  });
});

describe('Home upcoming days', () => {
  const { buildUpcomingDays } = require('../calendarAgenda');
  const ev = (id: number, date: string, extra: Record<string, unknown> = {}) => ({
    id, userId: 1, title: `E${id}`, date, occasion: 'casual', location: null,
    notes: null, environment: null, itemIds: null, outfitId: null, ...extra,
  });

  it('groups by day from today, keeps all-day events, and picks the planned look', () => {
    const days = buildUpcomingDays([
      ev(1, '2026-10-12T09:00:00'),
      ev(2, '2026-10-14T16:00:00'),
      ev(3, '2026-10-14T04:00:00', { itemIds: [5] }),
      ev(4, '2026-10-14T00:00:00Z', { calendarMetadata: { calendarId: 'w', calendarName: 'W', allDay: true, allDayDate: '2026-10-14', cancelled: false, syncedAt: '' } }),
      ev(5, '2026-10-13T10:00:00'),
      ev(6, '2026-10-20T10:00:00'),
    ], '2026-10-13', 2);
    expect(days.map((d: any) => d.date)).toEqual(['2026-10-13', '2026-10-14']);
    expect(days[1].events.map((e: any) => e.id)).toEqual([4, 3, 2]);
    expect(days[1].lookEvent.id).toBe(3);
    expect(days[0].lookEvent).toBeNull();
  });
});
