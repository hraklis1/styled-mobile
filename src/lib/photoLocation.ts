import * as Location from 'expo-location';

/**
 * Parse decimal GPS coords out of EXIF data.
 * Handles both iOS ({GPS}.Latitude/LatitudeRef) and Android
 * (top-level GPSLatitude/GPSLatitudeRef) formats.
 */
function extractGpsCoords(
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
};

async function reverseGeocode(coords: { latitude: number; longitude: number }): Promise<CapturedLocation> {
  try {
    const results = await Location.reverseGeocodeAsync(coords);
    if (!results.length) return { ...coords, label: null, address: null };
    const r = results[0];
    const label = r.name || r.street || r.city || r.subregion || r.region || null;
    const address = r.formattedAddress
      || [r.name, r.street, r.city, r.region, r.postalCode].filter(Boolean).join(', ')
      || null;
    return { ...coords, label, address };
  } catch {
    return { ...coords, label: null, address: null };
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
    if (coords) return reverseGeocode(coords);
  }

  // 2. Current device position (camera captures only)
  if (fallbackToCurrentLocation) {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return reverseGeocode(pos.coords);
    } catch {
      return null;
    }
  }

  return null;
}
