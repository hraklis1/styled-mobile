import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useProfile } from './useProfile';
import {
  applyLocationOverride,
  resolveStylingLocation,
  type DeviceStylingLocation,
} from '../lib/stylingLocation';
import {
  clearLocationOverride,
  loadLocationOverride,
  saveLocationOverride,
  type LocationOverride,
} from '../lib/stylingLocationOverride';
import {
  getOverrideSnapshot,
  setOverrideSnapshot,
  subscribeOverride,
} from '../lib/locationOverrideStore';
export type { StylingLocationContext, StylingLocationSource } from '../lib/stylingLocation';
export type { LocationOverride } from '../lib/stylingLocationOverride';

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
  const [permissionCanAskAgain, setPermissionCanAskAgain] = useState(true);
  const [lastKnownLocation, setLastKnownLocation] = useState<DeviceStylingLocation>();
  const override = useSyncExternalStore(subscribeOverride, getOverrideSnapshot);
  const userKey = profile?.userId != null ? String(profile.userId) : undefined;

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
    setPermissionCanAskAgain(permission.canAskAgain);
    return permission;
  }, []);

  const requestCurrentLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(permission.status);
    setPermissionCanAskAgain(permission.canAskAgain);
    if (permission.status === 'granted') {
      const result = await device.refetch();
      return result.isSuccess && Boolean(result.data);
    }
    return false;
  }, [device]);

  const refreshCurrentLocation = useCallback(async () => {
    const result = await device.refetch();
    return result.isSuccess && Boolean(result.data);
  }, [device]);

  const reloadOverride = useCallback(() => {
    if (!userKey) {
      setOverrideSnapshot(null);
      return;
    }
    loadLocationOverride(userKey)
      .then(setOverrideSnapshot)
      .catch(() => setOverrideSnapshot(null));
  }, [userKey]);

  useEffect(() => {
    reloadOverride();
  }, [reloadOverride]);

  const setLocationOverride = useCallback(async (next: LocationOverride) => {
    const resolved: LocationOverride | null = next.mode === 'current' ? null : next;
    setOverrideSnapshot(resolved);
    if (!userKey) return;
    try {
      if (resolved) await saveLocationOverride(userKey, resolved);
      else await clearLocationOverride(userKey);
    } catch {
      // Persistence is best-effort; the in-memory override still applies this session.
    }
  }, [userKey]);

  useEffect(() => {
    refreshPermission().catch(() => {
      setPermissionStatus('denied');
      setPermissionCanAskAgain(false);
    });
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

  const activeLocation = useMemo(() => {
    const auto = resolveStylingLocation(homeLocation, device.data ?? lastKnownLocation, permissionStatus);
    return applyLocationOverride(auto, override, homeLocation);
  }, [device.data, homeLocation, lastKnownLocation, override, permissionStatus]);
  const refetchCurrentLocation = device.refetch;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      reloadOverride();
      refreshPermission().then((permission) => {
        if (permission.status === 'granted') refetchCurrentLocation();
      }).catch(() => {});
    });
    return () => subscription.remove();
  }, [refreshPermission, refetchCurrentLocation, reloadOverride]);

  return {
    activeLocation,
    homeLocation,
    override,
    setLocationOverride,
    permissionStatus,
    permissionCanAskAgain,
    isLoading: profileLoading || (permissionStatus === 'granted' && device.isLoading && !homeLocation),
    refetchCurrentLocation,
    refreshCurrentLocation,
    requestCurrentLocation,
  };
}
