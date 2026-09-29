import { formatCountdown } from '../calendarUtils';

describe('formatCountdown', () => {
  const today = new Date(2026, 8, 28, 20, 0);
  const daysOut = (days: number) => new Date(2026, 8, 28 + days, 12, 0);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(today);
  });
  afterEach(() => jest.useRealTimers());

  it('leaves today and tomorrow to the date label', () => {
    expect(formatCountdown(daysOut(0))).toBeNull();
    expect(formatCountdown(daysOut(1))).toBeNull();
  });

  it('counts days inside a week', () => {
    expect(formatCountdown(daysOut(6))).toBe('in 6 days');
  });

  it('rounds to the nearest week', () => {
    expect(formatCountdown(daysOut(7))).toBe('in 1 week');
    expect(formatCountdown(daysOut(10))).toBe('in 1 week');
    expect(formatCountdown(daysOut(11))).toBe('in 2 weeks');
    expect(formatCountdown(daysOut(13))).toBe('in 2 weeks');
  });

  it('switches to months past a month out', () => {
    expect(formatCountdown(daysOut(49))).toBe('in 2 months');
  });
});
