jest.mock('expo-location', () => ({
  geocodeAsync: jest.fn(),
}));

jest.mock('../../lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

import { isWithinForecastHorizon } from '../useWeather';

describe('isWithinForecastHorizon', () => {
  const today = '2026-07-28';

  it('accepts today and dates inside the 16-day forecast window', () => {
    expect(isWithinForecastHorizon('2026-07-28', today)).toBe(true);
    expect(isWithinForecastHorizon('2026-08-05', today)).toBe(true);
    expect(isWithinForecastHorizon('2026-08-12', today)).toBe(true);
  });

  it('rejects dates beyond the forecast horizon', () => {
    expect(isWithinForecastHorizon('2026-08-13', today)).toBe(false);
    expect(isWithinForecastHorizon('2026-10-11', today)).toBe(false);
  });

  it('accepts recent past dates but rejects distant ones', () => {
    expect(isWithinForecastHorizon('2026-07-01', today)).toBe(true);
    expect(isWithinForecastHorizon('2025-12-25', today)).toBe(false);
  });

  it('rejects malformed dates', () => {
    expect(isWithinForecastHorizon('', today)).toBe(false);
    expect(isWithinForecastHorizon('2026-8-5', today)).toBe(false);
  });
});
