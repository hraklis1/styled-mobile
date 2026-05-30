import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { api } from '../lib/api';

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
