import type { CalendarPreviewEvent } from '../../../hooks/useCalendarSync';
import {
  createDefaultSelection,
  groupPreviewEventsByDate,
  partitionPreviewEvents,
} from '../calendarSyncUtils';

const events: CalendarPreviewEvent[] = [
  {
    externalId: 'later',
    title: 'Later event',
    date: '2026-06-13T17:30:00.000Z',
    location: null,
    occasion: 'other',
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
    title: 'Earlier event',
    date: '2026-06-12T10:00:00.000Z',
    location: null,
    occasion: 'other',
    alreadyImported: false,
  },
];

describe('calendar sync review helpers', () => {
  it('partitions new and previously synced events', () => {
    const result = partitionPreviewEvents(events);

    expect(result.newEvents.map((event) => event.externalId)).toEqual(['later', 'earlier']);
    expect(result.syncedEvents.map((event) => event.externalId)).toEqual(['synced']);
  });

  it('selects only new events by default', () => {
    expect(Array.from(createDefaultSelection(events))).toEqual(['later', 'earlier']);
  });

  it('groups events chronologically by local date', () => {
    const sections = groupPreviewEventsByDate(events);

    expect(sections).toHaveLength(2);
    expect(sections[0].data.map((event) => event.externalId)).toEqual(['earlier', 'synced']);
    expect(sections[1].data.map((event) => event.externalId)).toEqual(['later']);
  });
});
