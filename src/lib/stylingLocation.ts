export type StylingLocationSource = 'current' | 'home' | 'conversation';

export type DeviceStylingLocation = {
  label: string;
  coords: { lat: number; lon: number };
};

export type StylingLocationContext = {
  source: StylingLocationSource;
  label?: string;
  coords?: { lat: number; lon: number };
  isFallback: boolean;
  fallbackReason?: string;
};

export function resolveStylingLocation(
  homeLocation?: string,
  deviceLocation?: DeviceStylingLocation,
  permissionStatus?: 'granted' | 'denied' | 'undetermined',
): StylingLocationContext {
  const home = homeLocation?.trim() || undefined;

  if (deviceLocation) {
    return { source: 'current', ...deviceLocation, isFallback: false };
  }
  if (home) {
    return {
      source: 'home',
      label: home,
      isFallback: true,
      fallbackReason: permissionStatus === 'granted'
        ? 'Using Home while current location is unavailable.'
        : 'Using Home because current location is off.',
    };
  }

  return {
    source: 'current',
    isFallback: true,
    fallbackReason: permissionStatus === 'granted'
      ? 'Current location is unavailable. Add a Home city as a fallback.'
      : 'Enable current location or add a Home city for weather-aware styling.',
  };
}

export function conversationLocation(label: string): StylingLocationContext {
  return {
    source: 'conversation',
    label: label.trim(),
    isFallback: false,
  };
}
