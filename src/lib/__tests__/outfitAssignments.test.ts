import {
  getUpcomingAssignmentSummaries,
  getUpcomingEvents,
  getUpcomingOutfitEvents,
  parseEventDate,
} from '../outfitAssignments';
import type { Event } from '../../types/event';

const now = new Date('2026-06-12T12:00:00.000Z');
const events: Event[] = [
  { id: 1, userId: 1, title: 'Past', date: '2026-06-11T12:00:00.000Z', occasion: 'casual', location: null, notes: null, environment: null, itemIds: [1], outfitId: 10 },
  { id: 2, userId: 1, title: 'Soon', date: '2026-06-12T12:00:00.000Z', occasion: 'casual', location: null, notes: null, environment: null, itemIds: [1], outfitId: 10 },
  { id: 3, userId: 1, title: 'Later', date: '2026-06-13T12:00:00.000Z', occasion: 'casual', location: null, notes: null, environment: null, itemIds: [2], outfitId: 10 },
  { id: 4, userId: 1, title: 'Unassigned', date: '2026-06-14T12:00:00.000Z', occasion: 'casual', location: null, notes: null, environment: null, itemIds: null, outfitId: null },
];

describe('outfit assignment helpers', () => {
  it('parses backend event timestamps as local wall-clock time', () => {
    const date = parseEventDate('2026-06-12T16:45:00.000Z');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(12);
    expect(date.getHours()).toBe(16);
    expect(date.getMinutes()).toBe(45);
  });

  it('sorts and returns upcoming events including events at the current time', () => {
    expect(getUpcomingEvents(events, now).map((event) => event.id)).toEqual([2, 3, 4]);
  });

  it('returns only upcoming events assigned to an outfit', () => {
    expect(getUpcomingOutfitEvents(events, 10, now).map((event) => event.id)).toEqual([2, 3]);
  });

  it('summarizes upcoming assignments without past or unassigned events', () => {
    const summaries = getUpcomingAssignmentSummaries(events, now);

    expect(summaries.get(10)).toEqual({ nextEvent: events[1], count: 2 });
    expect(summaries.has(0)).toBe(false);
  });

  it('selects the earliest upcoming event regardless of input order', () => {
    const summaries = getUpcomingAssignmentSummaries([events[2], events[0], events[1]], now);

    expect(summaries.get(10)?.nextEvent.id).toBe(2);
    expect(summaries.get(10)?.count).toBe(2);
  });
});
