import * as Location from 'expo-location';

/**
 * Parse decimal GPS coords out of EXIF data.
 * Handles both iOS ({GPS}.Latitude/LatitudeRef) and Android
 * (top-level GPSLatitude/GPSLatitudeRef) formats.
 */
export function extractGpsCoords(
  exif: Record<string, unknown>,
): { latitude: number; longitude: number } | null {
  // iOS: exif['{GPS}'] or exif['GPS']
  const gpsBlock = (exif['{GPS}'] ?? exif['GPS']) as Record<string, unknown> | null | undefined;
  if (gpsBlock && typeof gpsBlock === 'object') {
    const lat = gpsBlock['Latitude'] as number | undefined;
    const latRef = gpsBlock['LatitudeRef'] as string | undefined;
    const lon = gpsBlock['Longitude'] as number | undefined;
    const lonRef = gpsBlock['LongitudeRef'] as string | undefined;
    if (lat != null && lon != null) {
      return {
        latitude: latRef === 'S' ? -lat : lat,
        longitude: lonRef === 'W' ? -lon : lon,
      };
    }
  }

  // Android: top-level GPSLatitude / GPSLongitude
  const lat = exif['GPSLatitude'] as number | undefined;
  const latRef = exif['GPSLatitudeRef'] as string | undefined;
  const lon = exif['GPSLongitude'] as number | undefined;
  const lonRef = exif['GPSLongitudeRef'] as string | undefined;
  if (lat != null && lon != null) {
    return {
      latitude: latRef === 'S' ? -lat : lat,
      longitude: lonRef === 'W' ? -lon : lon,
    };
  }

  return null;
}

export type CapturedLocation = {
  latitude: number;
  longitude: number;
  label: string | null;
  address: string | null;
  placeId?: string | null;
  accuracyMeters?: number | null;
  branchLabel?: string | null;
  locality?: string | null;
  region?: string | null;
  countryCode?: string | null;
  capturedAt?: number;
};

async function reverseGeocode(
  coords: { latitude: number; longitude: number },
  accuracyMeters: number | null,
  capturedAt: number,
): Promise<CapturedLocation> {
  try {
    const results = await Location.reverseGeocodeAsync(coords);
    if (!results.length) {
      return {
        ...coords,
        label: null,
        accuracyMeters,
        branchLabel: null,
        locality: null,
        region: null,
        countryCode: null,
        address: null,
        capturedAt,
      };
    }
    const r = results[0];
    const address = r.formattedAddress
      || [r.name, r.street, r.city, r.region, r.postalCode].filter(Boolean).join(', ')
      || null;
    return {
      ...coords,
      label: r.name || r.street || r.city || r.subregion || r.region || null,
      accuracyMeters,
      branchLabel: r.name || null,
      locality: r.city || r.district || r.subregion || null,
      region: r.region || null,
      countryCode: r.isoCountryCode || null,
      address,
      capturedAt,
    };
  } catch {
    return {
      ...coords,
      label: null,
      accuracyMeters,
      branchLabel: null,
      locality: null,
      region: null,
      countryCode: null,
      address: null,
      capturedAt,
    };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Location timed out')), timeoutMs);
    }),
  ]);
}

/**
 * Resolve a store-visit location without ever participating in photo capture.
 * A recent, reasonably accurate cached fix is preferred for instant indoor use;
 * otherwise a fresh high-accuracy fix gets a short window to resolve.
 */
export async function resolveShoppingSessionLocation(): Promise<CapturedLocation | null> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status === Location.PermissionStatus.UNDETERMINED) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return null;

    const cached = await Location.getLastKnownPositionAsync({
      maxAge: 2 * 60 * 1000,
      requiredAccuracy: 100,
    });
    const position = cached ?? await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      7000,
    );

    return reverseGeocode(
      { latitude: position.coords.latitude, longitude: position.coords.longitude },
      Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      position.timestamp,
    );
  } catch {
    return null;
  }
}

/**
 * Derive a human-readable location name from a photo.
 *
 * 1. If the EXIF block contains GPS coordinates, reverse-geocode them.
 * 2. Otherwise, if `fallbackToCurrentLocation` is true (use for camera
 *    captures — the user is physically at the location right now), get the
 *    device's current position instead.
 * 3. Returns null when no location can be determined.
 *
 * This never requests permissions; callers must already hold them.
 */
export async function capturePhotoLocation(
  exif: Record<string, unknown> | null | undefined,
  fallbackToCurrentLocation: boolean,
): Promise<string | null> {
  const result = await capturePhotoLocationData(exif, fallbackToCurrentLocation);
  return result?.label ?? null;
}

export async function capturePhotoLocationData(
  exif: Record<string, unknown> | null | undefined,
  fallbackToCurrentLocation: boolean,
): Promise<CapturedLocation | null> {
  // 1. EXIF GPS
  if (exif) {
    const coords = extractGpsCoords(exif);
    if (coords) return reverseGeocode(coords, null, Date.now());
  }

  // 2. Current device position (camera captures only)
  if (fallbackToCurrentLocation) {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return reverseGeocode(pos.coords, pos.coords.accuracy, pos.timestamp);
    } catch {
      return null;
    }
  }

  return null;
}
