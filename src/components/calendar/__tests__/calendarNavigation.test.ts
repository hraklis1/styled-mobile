import { agendaDayHeading, eventDayKey, eventsForCalendarDay, sortCalendarEvents } from '../calendarAgenda';
import type { Event } from '../../../types/event';
const event = (id: number, date: string, allDay = false): Event => ({
  id, userId: 1, title: `Event ${id}`, date, occasion: 'casual', location: null,
  notes: null, environment: null, itemIds: null, outfitId: null,
  calendarMetadata: allDay ? { calendarId: 'work', calendarName: 'Work', allDay: true, allDayDate: '2026-10-14', cancelled: false, syncedAt: date } : null,
});
describe('calendar day navigation', () => {
  it('filters the selected day without retaining the global upcoming event', () => {
    const events = [event(1, '2026-10-13T09:00:00'), event(2, '2026-10-14T10:00:00')];
    expect(eventsForCalendarDay(events, '2026-10-14').map(e => e.id)).toEqual([2]);
    expect(eventsForCalendarDay(events, '2026-10-15')).toEqual([]);
  });
  it('keeps all-day source identity even when the timestamp crosses days', () => {
    const allDay = event(3, '2026-10-13T23:00:00Z', true);
    expect(eventDayKey(allDay)).toBe('2026-10-14');
    expect(eventsForCalendarDay([allDay], '2026-10-14')).toEqual([allDay]);
  });
  it('sorts all-day first, then times with deterministic ties without mutating input', () => {
    const events = [event(5, '2026-10-14T10:00:00'), event(2, '2026-10-14T10:00:00'), event(3, '2026-10-13T23:00:00Z', true), event(4, '2026-10-14T08:00:00')];
    expect(sortCalendarEvents(events).map(e => e.id)).toEqual([3, 4, 2, 5]);
    expect(events[0].id).toBe(5);
  });
  it('labels today, tomorrow across a year boundary, and other years', () => {
    const today = new Date('2026-12-31T12:00:00');
    expect(agendaDayHeading('2026-12-31', today)).toMatch(/^Today · /);
    expect(agendaDayHeading('2027-01-01', today)).toMatch(/^Tomorrow · .*2027$/);
    expect(agendaDayHeading('2027-01-05', today)).toContain('2027');
  });
});
