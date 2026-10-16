import { eventDestination, eventTripSpan, isTripLikeEvent, linkableEventsForTrip } from '../eventTrips';
import type { Event } from '../../../types/event';

const event = (over: Partial<Event> & { meta?: Partial<NonNullable<Event['calendarMetadata']>> }): Event => {
  const { meta, ...rest } = over;
  return {
    id: 1, userId: 1, title: 'Lisbon', date: '2026-10-18T00:00:00Z', occasion: 'casual', location: null, notes: null,
    environment: null, itemIds: null, outfitId: null, externalSource: 'google',
    calendarMetadata: { calendarId: 'c', calendarName: 'C', allDay: true, allDayDate: '2026-10-18', endDate: '2026-10-23', cancelled: false, syncedAt: '', ...meta },
    ...rest,
  };
};

describe('event trips', () => {
  it('spans an all-day stay with an exclusive end', () => {
    expect(eventTripSpan(event({}))).toEqual({ startDate: '2026-10-18', endDate: '2026-10-22' });
  });

  it('treats overnight events and travel-worded all-day events as trips, not single-day meetings', () => {
    expect(isTripLikeEvent(event({}))).toBe(true);
    expect(isTripLikeEvent(event({ title: 'Flight to Rome', meta: { endDate: '2026-10-19' } }))).toBe(true);
    expect(isTripLikeEvent(event({ title: 'Team offsite', meta: { endDate: '2026-10-19' } }))).toBe(false);
    expect(isTripLikeEvent(event({ meta: { cancelled: true } }))).toBe(false);
  });

  it('reads a destination from location, then "to X", then the title', () => {
    expect(eventDestination({ title: 'Trip', location: 'Lisbon, Portugal' })).toBe('Lisbon, Portugal');
    expect(eventDestination({ title: 'Flight to Rome', location: null })).toBe('Rome');
    expect(eventDestination({ title: 'Lisbon trip', location: null })).toBe('Lisbon');
    expect(eventDestination({ title: 'APS week', location: null })).toBe('');
  });

  it('suggests overlapping events only when they look like this trip', () => {
    const trip = { id: 1, destination: 'Lisbon, Portugal', startDate: '2026-10-18', endDate: '2026-10-22' };
    const trips = [{ id: 2, eventId: 9 } as never];
    const found = linkableEventsForTrip(trip, [
      event({ id: 5, title: 'Lisbon' }),                                                            // names the place
      event({ id: 6, title: 'Flight to Porto', meta: { allDayDate: '2026-10-18', endDate: '2026-10-19' } }), // travel
      event({ id: 7, title: 'Simona away', meta: { allDayDate: '2026-10-19', endDate: '2026-10-23' } }),     // overlap only
      event({ id: 8, title: 'Conference', meta: { allDayDate: '2026-10-18', endDate: '2026-10-23' } }),      // same days
      event({ id: 9, title: 'Lisbon' }),                                                            // linked elsewhere
      event({ id: 10, title: 'Lisbon', meta: { allDayDate: '2026-11-01', endDate: '2026-11-03' } }),         // no overlap
    ], trips);
    expect(found.map((e) => e.id)).toEqual([5, 6, 8]);
  });
});
