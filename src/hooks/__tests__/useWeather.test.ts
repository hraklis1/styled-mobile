import * as Location from 'expo-location';
import { api } from '../../lib/api';
import { fetchStylingWeatherToday } from '../useWeather';

jest.mock('expo-location', () => ({
  geocodeAsync: jest.fn(),
}));

jest.mock('../../lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockGeocodeAsync = jest.mocked(Location.geocodeAsync);
const mockApiGet = jest.mocked(api.get);

describe('fetchStylingWeatherToday', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('geocodes label-only locations before fetching coordinate weather', async () => {
    mockGeocodeAsync.mockResolvedValue([
      {
        latitude: 42.9849,
        longitude: -81.2453,
      },
    ]);
    mockApiGet
      .mockResolvedValueOnce({
        data: {
          condition: 'mild',
          temperatureC: 20,
          temperatureF: 68,
          summary: 'Currently 20°C.',
        },
      })
      .mockResolvedValueOnce({
        data: {
          condition: 'mild',
          tempMaxC: 23,
          tempMinC: 14,
          tempMaxF: 73,
          tempMinF: 57,
        },
      });

    const result = await fetchStylingWeatherToday(
      {
        source: 'home',
        label: 'London, Ontario, CA',
        isFallback: true,
      },
      '2026-06-14',
    );

    expect(mockGeocodeAsync).toHaveBeenCalledWith('London, Ontario, CA');
    expect(mockApiGet).toHaveBeenNthCalledWith(1, '/api/weather?lat=42.9849&lon=-81.2453');
    expect(mockApiGet).toHaveBeenNthCalledWith(
      2,
      '/api/weather/forecast?lat=42.9849&lon=-81.2453&date=2026-06-14',
    );
    expect(mockApiGet).not.toHaveBeenCalledWith(expect.stringContaining('geocode-forecast'));
    expect(result.current.locationLabel).toBe('London, Ontario, CA');
  });
});
