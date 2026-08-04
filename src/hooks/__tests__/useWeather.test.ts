import * as Location from 'expo-location';
import { api } from '../../lib/api';
import { fetchEventWeatherForecast, fetchStylingWeatherToday } from '../useWeather';

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

describe('fetchEventWeatherForecast', () => {
  const forecast = {
    condition: 'mild' as const,
    tempMaxC: 23,
    tempMinC: 14,
    tempMaxF: 73,
    tempMinF: 57,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers the event destination over current coordinates', async () => {
    mockGeocodeAsync.mockResolvedValue([{ latitude: 43.6435, longitude: -79.3791 }]);
    mockApiGet.mockResolvedValue({ data: forecast });

    const result = await fetchEventWeatherForecast(
      'Scotiabank Arena, Toronto',
      { source: 'current', label: 'London, Ontario', coords: { lat: 42.98, lon: -81.24 }, isFallback: false },
      '2026-08-10',
    );

    expect(mockGeocodeAsync).toHaveBeenCalledWith('Scotiabank Arena, Toronto');
    expect(mockApiGet).toHaveBeenCalledWith('/api/weather/forecast?lat=43.6435&lon=-79.3791&date=2026-08-10');
    expect(result).toEqual({
      ...forecast,
      locationLabel: 'Scotiabank Arena, Toronto',
      locationSource: 'destination',
    });
  });

  it('labels a fallback when the event destination cannot be resolved', async () => {
    mockGeocodeAsync.mockResolvedValue([]);
    mockApiGet.mockResolvedValue({ data: forecast });

    const result = await fetchEventWeatherForecast(
      'Unknown venue',
      { source: 'home', label: 'London, Ontario', coords: { lat: 42.98, lon: -81.24 }, isFallback: true },
      '2026-08-10',
    );

    expect(mockApiGet).toHaveBeenCalledWith('/api/weather/forecast?lat=42.98&lon=-81.24&date=2026-08-10');
    expect(result.locationSource).toBe('fallback');
    expect(result.locationLabel).toBe('London, Ontario');
  });
});
