import type { CalendarPreviewEvent } from '../../../hooks/useCalendarSync';
import {
  createDefaultSelection,
  filterPreviewEvents,
  groupPreviewEventsByDate,
  partitionPreviewEvents,
  updateVisibleSelection,
} from '../calendarSyncUtils';

const now = new Date('2026-06-12T00:00:00.000Z');

const events: CalendarPreviewEvent[] = [
  {
    externalId: 'later',
    title: 'Later event',
    date: '2026-07-20T17:30:00.000Z',
    location: 'Country Club',
    occasion: 'casual',
    alreadyImported: false,
  },
  {
    externalId: 'synced',
    title: 'Synced event',
    date: '2026-06-12T20:00:00.000Z',
    location: null,
    occasion: 'other',
    alreadyImported: true,
  },
  {
    externalId: 'earlier',
    title: 'Team dinner',
    date: '2026-06-13T10:00:00.000Z',
    location: 'Downtown',
    occasion: 'business',
    alreadyImported: false,
  },
  {
    externalId: 'next-week',
    title: 'Birthday party',
    date: '2026-06-22T20:00:00.000Z',
    location: null,
    occasion: 'party',
    alreadyImported: false,
  },
];

describe('calendar sync review helpers', () => {
  it('partitions new and previously synced events', () => {
    const result = partitionPreviewEvents(events);

    expect(result.newEvents.map((event) => event.externalId)).toEqual(['later', 'earlier', 'next-week']);
    expect(result.syncedEvents.map((event) => event.externalId)).toEqual(['synced']);
  });

  it('selects only new events in the next 30 days by default', () => {
    expect(Array.from(createDefaultSelection(events, now))).toEqual(['earlier', 'next-week']);
  });

  it('groups events chronologically by local date', () => {
    const sections = groupPreviewEventsByDate(events);

    expect(sections).toHaveLength(4);
    expect(sections[0].data.map((event) => event.externalId)).toEqual(['synced']);
    expect(sections[1].data.map((event) => event.externalId)).toEqual(['earlier']);
    expect(sections[2].data.map((event) => event.externalId)).toEqual(['next-week']);
    expect(sections[3].data.map((event) => event.externalId)).toEqual(['later']);
  });

  it('filters by title or location case-insensitively', () => {
    const byTitle = filterPreviewEvents(events, { search: 'DINNER', dateRange: 'all', occasions: [] }, now);
    const byLocation = filterPreviewEvents(events, { search: 'country', dateRange: 'all', occasions: [] }, now);

    expect(byTitle.map((event) => event.externalId)).toEqual(['earlier']);
    expect(byLocation.map((event) => event.externalId)).toEqual(['later']);
  });

  it('filters by date range, occasion, and combined criteria', () => {
    const nextSeven = filterPreviewEvents(events, { search: '', dateRange: 7, occasions: [] }, now);
    const party = filterPreviewEvents(events, { search: '', dateRange: 'all', occasions: ['party'] }, now);
    const combined = filterPreviewEvents(events, { search: 'birthday', dateRange: 30, occasions: ['party'] }, now);

    expect(nextSeven.map((event) => event.externalId)).toEqual(['synced', 'earlier']);
    expect(party.map((event) => event.externalId)).toEqual(['next-week']);
    expect(combined.map((event) => event.externalId)).toEqual(['next-week']);
  });

  it('selects and clears only visible events', () => {
    const selected = new Set(['hidden', 'earlier']);
    const visible = events.filter((event) => ['earlier', 'next-week'].includes(event.externalId));

    expect(Array.from(updateVisibleSelection(selected, visible, 'select'))).toEqual([
      'hidden',
      'earlier',
      'next-week',
    ]);
    expect(Array.from(updateVisibleSelection(selected, visible, 'clear'))).toEqual(['hidden']);
  });
});
