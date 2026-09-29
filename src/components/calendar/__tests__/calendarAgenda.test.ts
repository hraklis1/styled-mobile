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
