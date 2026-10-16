import { pastTrips, tripCountdown, tripProgressLabel, upcomingTrips } from '../presentation';

const trip = (startDate: string, endDate: string) => ({ startDate, endDate });

describe('trip shelf helpers', () => {
  const today = '2026-10-16';

  it('splits upcoming (soonest first, incl. under way) from past (latest first)', () => {
    const trips = [trip('2026-11-01', '2026-11-04'), trip('2026-10-01', '2026-10-03'), trip('2026-10-14', '2026-10-18'), trip('2026-09-01', '2026-09-02')];
    expect(upcomingTrips(trips, today).map((t) => t.startDate)).toEqual(['2026-10-14', '2026-11-01']);
    expect(pastTrips(trips, today).map((t) => t.startDate)).toEqual(['2026-10-01', '2026-09-01']);
  });

  it('counts down, then counts days once under way', () => {
    expect(tripCountdown(trip('2026-10-14', '2026-10-18'), today)).toBe('Day 3 of 5');
    expect(tripCountdown(trip('2026-10-17', '2026-10-18'), today)).toBe('Tomorrow');
    expect(tripCountdown(trip('2026-10-20', '2026-10-22'), today)).toBe('In 4 days');
    expect(tripCountdown(trip('2026-12-05', '2026-12-08'), today)).toBe('Sat 5 Dec');
  });

  it('prefers packing progress over look count', () => {
    expect(tripProgressLabel({ looks: 4, packed: 3, packable: 12 })).toBe('3 of 12 packed');
    expect(tripProgressLabel({ looks: 4, packed: 12, packable: 12 })).toBe('All packed');
    expect(tripProgressLabel({ looks: 1, packed: 0, packable: 0 })).toBe('1 look');
  });
});
