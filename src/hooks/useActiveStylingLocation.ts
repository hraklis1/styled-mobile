import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useProfile } from './useProfile';
import {
  resolveStylingLocation,
  type DeviceStylingLocation,
} from '../lib/stylingLocation';
export type { StylingLocationContext, StylingLocationSource } from '../lib/stylingLocation';

function formatAddress(address: Location.LocationGeocodedAddress): string {
  const city = address.city || address.subregion || address.district;
  return [city, address.region, address.isoCountryCode].filter(Boolean).join(', ');
}

async function locationFromPosition(position: Location.LocationObject): Promise<DeviceStylingLocation> {
  const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
  const addresses = await Location.reverseGeocodeAsync({
    latitude: coords.lat,
    longitude: coords.lon,
  }).catch(() => []);
  const label = addresses[0] ? formatAddress(addresses[0]) : '';
  return { coords, label: label || 'Current location' };
}

async function getDeviceLocation(): Promise<DeviceStylingLocation> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Location access is unavailable');

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return locationFromPosition(position);
}

export function useActiveStylingLocation() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const homeLocation = profile?.location ?? undefined;
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [lastKnownLocation, setLastKnownLocation] = useState<DeviceStylingLocation>();

  const device = useQuery<DeviceStylingLocation, Error>({
    queryKey: ['styling-location', 'device', profile?.userId ?? null],
    enabled: !profileLoading && permissionStatus === 'granted',
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: getDeviceLocation,
  });

  const refreshPermission = useCallback(async () => {
    const permission = await Location.getForegroundPermissionsAsync();
    setPermissionStatus(permission.status);
    return permission.status;
  }, []);

  const requestCurrentLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(permission.status);
    if (permission.status === 'granted') {
      await device.refetch();
    }
    return permission.status;
  }, [device]);

  useEffect(() => {
    refreshPermission().catch(() => setPermissionStatus('denied'));
  }, [refreshPermission]);

  useEffect(() => {
    if (permissionStatus !== 'granted') {
      setLastKnownLocation(undefined);
      return;
    }
    Location.getLastKnownPositionAsync({
      maxAge: 10 * 60 * 1000,
      requiredAccuracy: 5000,
    })
      .then((position) => position && locationFromPosition(position))
      .then((location) => {
        if (location) setLastKnownLocation(location);
      })
      .catch(() => {});
  }, [permissionStatus]);

  const activeLocation = useMemo(
    () => resolveStylingLocation(homeLocation, device.data ?? lastKnownLocation, permissionStatus),
    [device.data, homeLocation, lastKnownLocation, permissionStatus],
  );
  const refetchCurrentLocation = device.refetch;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refreshPermission().then((status) => {
        if (status === 'granted') refetchCurrentLocation();
      }).catch(() => {});
    });
    return () => subscription.remove();
  }, [refreshPermission, refetchCurrentLocation]);

  return {
    activeLocation,
    homeLocation,
    permissionStatus,
    isLoading: profileLoading || (permissionStatus === 'granted' && device.isLoading && !homeLocation),
    refetchCurrentLocation,
    requestCurrentLocation,
  };
}
