import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import type { StylingLocationContext } from './useActiveStylingLocation';

export type WeatherCondition = 'sunny' | 'rainy' | 'cold' | 'mild';

export type CurrentWeather = {
  condition: WeatherCondition;
  temperatureC: number;
  temperatureF: number;
  summary: string;
  locationLabel?: string;
};

export type ForecastWeather = {
  condition: WeatherCondition;
  tempMaxC: number;
  tempMinC: number;
  tempMaxF: number;
  tempMinF: number;
};

async function getDeviceCoords(): Promise<{ lat: number; lon: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude };
}

export const WEATHER_CURRENT_KEY = ['weather', 'current'] as const;

export function useWeatherCurrent(enabled = true) {
  return useQuery<CurrentWeather, Error>({
    queryKey: WEATHER_CURRENT_KEY,
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { lat, lon } = await getDeviceCoords();
      const res = await api.get<CurrentWeather>(
        `/api/weather?lat=${lat}&lon=${lon}`,
      );
      return res.data;
    },
  });
}

// Combined current + today's forecast in a single hook (fetches coords once)
export type TodayWeather = {
  current: CurrentWeather;
  forecast: ForecastWeather;
};

export const WEATHER_TODAY_KEY = ['weather', 'today'] as const;

async function getWeatherForCoords(
  lat: number,
  lon: number,
  date: string,
  locationLabel?: string,
): Promise<TodayWeather> {
  const [currentRes, forecastRes] = await Promise.all([
    api.get<CurrentWeather>(`/api/weather?lat=${lat}&lon=${lon}`),
    api.get<ForecastWeather>(`/api/weather/forecast?lat=${lat}&lon=${lon}&date=${date}`),
  ]);
  return {
    current: {
      ...currentRes.data,
      locationLabel: locationLabel ?? currentRes.data.locationLabel,
    },
    forecast: forecastRes.data,
  };
}

export function useWeatherToday(enabled = true) {
  return useQuery<TodayWeather, Error>({
    queryKey: WEATHER_TODAY_KEY,
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { lat, lon } = await getDeviceCoords();
      const today = new Date().toISOString().slice(0, 10);
      return getWeatherForCoords(lat, lon, today);
    },
  });
}

function stylingWeatherKey(location: StylingLocationContext) {
  return [
    'weather',
    'styling',
    location.source,
    location.label ?? null,
    location.coords?.lat ?? null,
    location.coords?.lon ?? null,
  ] as const;
}

export async function fetchStylingWeatherToday(
  location: StylingLocationContext,
  today = new Date().toISOString().slice(0, 10),
): Promise<TodayWeather> {
  if (location.coords) {
    const { lat, lon } = location.coords;
    return getWeatherForCoords(lat, lon, today, location.label);
  }

  const [geocoded] = await Location.geocodeAsync(location.label!);
  if (!geocoded) throw new Error(`Could not find weather location "${location.label}"`);
  return getWeatherForCoords(geocoded.latitude, geocoded.longitude, today, location.label);
}

export function useStylingWeatherToday(location: StylingLocationContext) {
  return useQuery<TodayWeather, Error>({
    queryKey: stylingWeatherKey(location),
    enabled: !!location.coords || !!location.label,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: () => fetchStylingWeatherToday(location),
  });
}

export function useWeatherForecast(
  lat: number | null,
  lon: number | null,
  dateStr: string | null,
) {
  return useQuery<ForecastWeather, Error>({
    queryKey: ['weather', 'forecast', lat, lon, dateStr],
    enabled: lat !== null && lon !== null && !!dateStr && dateStr.length === 10,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const res = await api.get<ForecastWeather>(
        `/api/weather/forecast?lat=${lat}&lon=${lon}&date=${dateStr}`,
      );
      return res.data;
    },
  });
}
