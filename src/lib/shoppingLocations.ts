import { FASHION_BRANDS } from './fashionBrands';
import type { ShoppingSessionContext } from '../stores/useShoppingSessionStore';

export type ShoppingLocationLike = {
  storeName?: string | null;
  branchLabel?: string | null;
  locality?: string | null;
  region?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationSource?: string | null;
};

export type ShoppingStoreSuggestion = {
  id: string;
  storeName: string;
  branchLabel: string | null;
  locality: string | null;
  region: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  source: 'recent' | 'popular' | 'free-text';
  score: number;
};

export const POPULAR_FASHION_STORES = [
  'Abercrombie & Fitch',
  'Adidas',
  'Alo Yoga',
  'American Eagle',
  'Anthropologie',
  'Aritzia',
  'Athleta',
  'Banana Republic',
  'Bloomingdale\'s',
  'Burberry',
  'Canada Goose',
  'Chanel',
  'Coach',
  'COS',
  'Dior',
  'Everlane',
  'Foot Locker',
  'Free People',
  'Gap',
  'Gucci',
  'H&M',
  'Hermes',
  'Holt Renfrew',
  'J. Crew',
  'Levi\'s',
  'Louis Vuitton',
  'Lululemon',
  'Madewell',
  'Mango',
  'Michael Kors',
  'Muji',
  'Neiman Marcus',
  'Nike',
  'Nordstrom',
  'Old Navy',
  'Patagonia',
  'Prada',
  'Ralph Lauren',
  'Reformation',
  'Saks Fifth Avenue',
  'Sephora',
  'SSENSE',
  'The North Face',
  'Theory',
  'Tory Burch',
  'Uniqlo',
  'Urban Outfitters',
  'Victoria\'s Secret',
  'Vuori',
  'Zara',
].sort((a, b) => a.localeCompare(b));

export function normalizeStoreName(storeName: string): string {
  return storeName.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function compactParts(values: Array<string | null | undefined>): string[] {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => (
      values.findIndex((candidate) => candidate.toLocaleLowerCase() === value.toLocaleLowerCase()) === index
    ));
}

export function formatShoppingPlaceLabel(
  value: ShoppingLocationLike,
  options: { fallback?: string; maxParts?: number } = {},
): string {
  const parts = compactParts([value.locality, value.branchLabel, value.region]);
  return parts.slice(0, options.maxParts ?? 2).join(' · ') || options.fallback || 'Location not set';
}

export function formatShoppingDetailLocation(value: ShoppingLocationLike): string {
  return compactParts([value.locality, value.branchLabel, value.region, value.countryCode]).join(' · ')
    || 'Location not set';
}

export function buildShoppingLocationKey(value: ShoppingLocationLike): string {
  return [
    normalizeStoreName(value.storeName ?? ''),
    value.branchLabel ?? '',
    value.locality ?? '',
    value.region ?? '',
    value.countryCode ?? '',
  ].map((part) => part.trim().toLocaleLowerCase()).join('|');
}

export function shoppingFilterKey(value: ShoppingLocationLike): string {
  return `location:${buildShoppingLocationKey(value)}`;
}

function distanceMeters(
  a: { latitude: number | null; longitude: number | null },
  b: { latitude: number | null; longitude: number | null },
): number | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) return null;
  const radiusMeters = 6371000;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const deltaLat = (b.latitude - a.latitude) * Math.PI / 180;
  const deltaLon = (b.longitude - a.longitude) * Math.PI / 180;
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function queryScore(storeName: string, query: string): number {
  if (!query) return 0;
  const normalizedStore = normalizeStoreName(storeName);
  const normalizedQuery = normalizeStoreName(query);
  if (normalizedStore === normalizedQuery) return 80;
  if (normalizedStore.startsWith(normalizedQuery)) return 60;
  if (normalizedStore.includes(normalizedQuery)) return 35;
  return -Infinity;
}

export function buildShoppingStoreSuggestions({
  query,
  visitedLocations = [],
  recentSessions,
  recentStores,
  currentLocation,
  limit = 12,
}: {
  query: string;
  visitedLocations?: ShoppingLocationLike[];
  recentSessions: ShoppingSessionContext[];
  recentStores: string[];
  currentLocation?: { latitude: number | null; longitude: number | null } | null;
  limit?: number;
}): ShoppingStoreSuggestion[] {
  const trimmedQuery = query.trim();
  const suggestions = new Map<string, ShoppingStoreSuggestion>();

  for (const location of visitedLocations) {
    if (!location.storeName) continue;
    const score = 180 + queryScore(location.storeName, trimmedQuery);
    if (!Number.isFinite(score)) continue;
    const distance = currentLocation ? distanceMeters({
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
    }, currentLocation) : null;
    const locationBoost = distance === null ? 0 : Math.max(0, 30 - Math.round(distance / 500));
    const suggestion: ShoppingStoreSuggestion = {
      id: `recent:${buildShoppingLocationKey(location)}`,
      storeName: location.storeName,
      branchLabel: location.branchLabel ?? null,
      locality: location.locality ?? null,
      region: location.region ?? null,
      countryCode: location.countryCode ?? null,
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
      source: 'recent',
      score: score + locationBoost,
    };
    suggestions.set(suggestion.id, suggestion);
  }

  for (const session of recentSessions) {
    const score = 200 + queryScore(session.storeName, trimmedQuery);
    if (!Number.isFinite(score)) continue;
    const distance = currentLocation ? distanceMeters(session, currentLocation) : null;
    const locationBoost = distance === null ? 0 : Math.max(0, 30 - Math.round(distance / 500));
    const suggestion: ShoppingStoreSuggestion = {
      id: `recent:${buildShoppingLocationKey(session)}`,
      storeName: session.storeName,
      branchLabel: session.branchLabel,
      locality: session.locality,
      region: session.region,
      countryCode: session.countryCode,
      latitude: session.latitude,
      longitude: session.longitude,
      source: 'recent',
      score: score + locationBoost,
    };
    suggestions.set(suggestion.id, suggestion);
  }

  for (const storeName of recentStores) {
    const score = 140 + queryScore(storeName, trimmedQuery);
    if (!Number.isFinite(score)) continue;
    const suggestion: ShoppingStoreSuggestion = {
      id: `recent-store:${normalizeStoreName(storeName)}`,
      storeName,
      branchLabel: null,
      locality: null,
      region: null,
      countryCode: null,
      latitude: null,
      longitude: null,
      source: 'recent',
      score,
    };
    if (!suggestions.has(suggestion.id)) suggestions.set(suggestion.id, suggestion);
  }

  const popularStores = [...new Set([...POPULAR_FASHION_STORES, ...FASHION_BRANDS])];
  for (const storeName of popularStores) {
    const score = 20 + queryScore(storeName, trimmedQuery);
    if (!Number.isFinite(score)) continue;
    const suggestion: ShoppingStoreSuggestion = {
      id: `popular:${normalizeStoreName(storeName)}`,
      storeName,
      branchLabel: null,
      locality: null,
      region: null,
      countryCode: null,
      latitude: null,
      longitude: null,
      source: 'popular',
      score,
    };
    if (!suggestions.has(suggestion.id)) suggestions.set(suggestion.id, suggestion);
  }

  if (trimmedQuery) {
    const normalizedQuery = normalizeStoreName(trimmedQuery);
    const hasExact = [...suggestions.values()].some(
      (suggestion) => normalizeStoreName(suggestion.storeName) === normalizedQuery,
    );
    if (!hasExact) {
      suggestions.set(`free-text:${normalizedQuery}`, {
        id: `free-text:${normalizedQuery}`,
        storeName: trimmedQuery,
        branchLabel: null,
        locality: null,
        region: null,
        countryCode: null,
        latitude: null,
        longitude: null,
        source: 'free-text',
        score: 120,
      });
    }
  }

  return [...suggestions.values()]
    .sort((a, b) => b.score - a.score || a.storeName.localeCompare(b.storeName))
    .slice(0, limit);
}
