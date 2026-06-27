import type { PendingShoppingUpload } from '../stores/useShoppingSessionStore';
import type { ShoppingSnap } from '../types/shoppingSnap';
import { buildShoppingLocationKey, normalizeStoreName, shoppingFilterKey } from './shoppingLocations';

export type ShoppingDateFilter = 'all' | 'today' | '7d' | '30d';
export type ShoppingSyncFilter = 'all' | 'pending' | 'synced';
export type ShoppingReviewFilter = 'all' | 'needs-review';

export type ShoppingEditItem = {
  id: string;
  captureGroupId: string;
  snaps: ShoppingSnap[];
  primarySnap: ShoppingSnap;
  tagSnaps: ShoppingSnap[];
  photoCount: number;
  storeName: string | null;
  storeLocationId: string | null;
  branchLabel: string | null;
  locality: string | null;
  region: string | null;
  extractedPrice: number | null;
  capturedAt: string;
  syncStatus: 'pending' | 'synced';
  needsReview: boolean;
  reviewReasons: string[];
};

export type ShoppingEditSummary = {
  itemCount: number;
  storeCount: number;
  missingPriceItemCount: number;
  pendingItemCount: number;
  missingPricePhotoCount: number;
  pendingPhotoCount: number;
};

function choosePrimarySnap(snaps: ShoppingSnap[]): ShoppingSnap {
  return [...snaps].sort((a, b) => {
    if (a.captureRole === 'garment' && b.captureRole !== 'garment') return -1;
    if (a.captureRole !== 'garment' && b.captureRole === 'garment') return 1;
    if (a.captureRole === 'tag' && b.captureRole !== 'tag') return 1;
    if (a.captureRole !== 'tag' && b.captureRole === 'tag') return -1;
    return a.captureSequence - b.captureSequence
      || new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
  })[0];
}

function itemReviewReasons(snaps: ShoppingSnap[], price: number | null, storeName: string | null): string[] {
  const reasons: string[] = [];
  if (price === null) reasons.push('Missing price');
  if (!storeName) reasons.push('Missing store');
  if (snaps.some((snap) => snap.captureRole === 'unknown')) reasons.push('Unsorted photo');
  if (snaps.some((snap) => snap.rawOcrText.trim().length > 0 && snap.extractedPrice === null)) {
    reasons.push('Text needs price check');
  }
  return reasons;
}

export function buildShoppingEditItems(snaps: ShoppingSnap[]): ShoppingEditItem[] {
  const grouped = new Map<string, ShoppingSnap[]>();

  for (const snap of snaps) {
    const key = snap.captureGroupId || snap.id;
    grouped.set(key, [...(grouped.get(key) ?? []), snap]);
  }

  return [...grouped.entries()]
    .map(([captureGroupId, groupSnaps]) => {
      const sortedSnaps = [...groupSnaps].sort((a, b) => (
        a.captureSequence - b.captureSequence
        || new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      ));
      const primarySnap = choosePrimarySnap(sortedSnaps);
      const priceSnap = sortedSnaps.find((snap) => snap.captureRole === 'tag' && snap.extractedPrice !== null)
        ?? sortedSnaps.find((snap) => snap.extractedPrice !== null);
      const storeSnap = sortedSnaps.find((snap) => snap.storeName);
      const locationSnap = sortedSnaps.find((snap) => snap.branchLabel || snap.locality || snap.region) ?? primarySnap;
      const newestSnap = [...sortedSnaps].sort(
        (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
      )[0];
      const extractedPrice = priceSnap?.extractedPrice ?? null;
      const storeName = storeSnap?.storeName ?? null;
      const reviewReasons = itemReviewReasons(sortedSnaps, extractedPrice, storeName);
      const syncStatus: ShoppingEditItem['syncStatus'] = sortedSnaps.some((snap) => snap.syncStatus === 'pending')
        ? 'pending'
        : 'synced';

      return {
        id: captureGroupId,
        captureGroupId,
        snaps: sortedSnaps,
        primarySnap,
        tagSnaps: sortedSnaps.filter((snap) => snap.captureRole === 'tag' && snap.id !== primarySnap.id),
        photoCount: sortedSnaps.length,
        storeName,
        storeLocationId: storeSnap?.storeLocationId ?? locationSnap.storeLocationId ?? null,
        branchLabel: locationSnap.branchLabel,
        locality: locationSnap.locality,
        region: locationSnap.region,
        extractedPrice,
        capturedAt: newestSnap.capturedAt,
        syncStatus,
        needsReview: reviewReasons.length > 0,
        reviewReasons,
      };
    })
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
}

export function summarizeShoppingEditItems(items: ShoppingEditItem[]): ShoppingEditSummary {
  const stores = new Set(
    items.map((item) => item.storeName).filter((store): store is string => Boolean(store)),
  );

  return {
    itemCount: items.length,
    storeCount: stores.size,
    missingPriceItemCount: items.filter((item) => item.extractedPrice === null).length,
    pendingItemCount: items.filter((item) => item.syncStatus === 'pending').length,
    missingPricePhotoCount: items.reduce(
      (count, item) => count + item.snaps.filter((snap) => snap.extractedPrice === null).length,
      0,
    ),
    pendingPhotoCount: items.reduce(
      (count, item) => count + item.snaps.filter((snap) => snap.syncStatus === 'pending').length,
      0,
    ),
  };
}

export function mergeShoppingSnaps(
  remoteSnaps: ShoppingSnap[],
  pendingUploads: PendingShoppingUpload[],
): ShoppingSnap[] {
  const merged = new Map(remoteSnaps.map((snap) => [snap.id, snap]));

  for (const upload of pendingUploads) {
    merged.set(upload.id, {
      id: upload.id,
      imageUri: upload.localFileUri,
      storagePath: null,
      storeName: upload.storeName,
      storeLocationId: upload.storeLocationId ?? null,
      shoppingSessionId: upload.shoppingSessionId ?? null,
      captureGroupId: upload.captureGroupId ?? upload.id,
      captureRole: upload.captureRole ?? 'unknown',
      captureSequence: upload.captureSequence ?? 0,
      branchLabel: upload.branchLabel ?? null,
      latitude: upload.latitude,
      longitude: upload.longitude,
      locationAccuracyMeters: upload.locationAccuracyMeters ?? null,
      locality: upload.locality ?? null,
      region: upload.region ?? null,
      countryCode: upload.countryCode ?? null,
      locationSource: upload.locationSource ?? null,
      extractedPrice: upload.extractedPrice,
      rawOcrText: upload.rawOcrText,
      capturedAt: new Date(upload.timestamp).toISOString(),
      syncStatus: 'pending',
    });
  }

  return [...merged.values()].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );
}

export function filterShoppingSnaps(
  snaps: ShoppingSnap[],
  storeFilter: string,
  dateFilter: ShoppingDateFilter,
  syncFilter: ShoppingSyncFilter,
  now = new Date(),
): ShoppingSnap[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const minimumTimestamp = dateFilter === 'today'
    ? startOfToday
    : dateFilter === '7d'
      ? startOfToday - 6 * 24 * 60 * 60 * 1000
      : dateFilter === '30d'
        ? startOfToday - 29 * 24 * 60 * 60 * 1000
        : null;

  return snaps.filter((snap) => {
    const storeMatches = storeFilter === 'all'
      || (storeFilter === 'none' ? !snap.storeName : storeFilterMatchesSnap(storeFilter, snap));
    const dateMatches = minimumTimestamp === null
      || new Date(snap.capturedAt).getTime() >= minimumTimestamp;
    const syncMatches = syncFilter === 'all' || snap.syncStatus === syncFilter;
    return storeMatches && dateMatches && syncMatches;
  });
}

export function filterShoppingEditItems(
  items: ShoppingEditItem[],
  storeFilter: string,
  dateFilter: ShoppingDateFilter,
  syncFilter: ShoppingSyncFilter,
  reviewFilter: ShoppingReviewFilter,
  now = new Date(),
): ShoppingEditItem[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const minimumTimestamp = dateFilter === 'today'
    ? startOfToday
    : dateFilter === '7d'
      ? startOfToday - 6 * 24 * 60 * 60 * 1000
      : dateFilter === '30d'
        ? startOfToday - 29 * 24 * 60 * 60 * 1000
        : null;

  return items.filter((item) => {
    const storeMatches = storeFilter === 'all'
      || (storeFilter === 'none' ? !item.storeName : storeFilterMatchesItem(storeFilter, item));
    const dateMatches = minimumTimestamp === null
      || new Date(item.capturedAt).getTime() >= minimumTimestamp;
    const syncMatches = syncFilter === 'all' || item.syncStatus === syncFilter;
    const reviewMatches = reviewFilter === 'all' || item.needsReview;
    return storeMatches && dateMatches && syncMatches && reviewMatches;
  });
}

function storeFilterMatchesSnap(storeFilter: string, snap: ShoppingSnap): boolean {
  if (!snap.storeName) return false;
  if (storeFilter.startsWith('store:')) {
    return normalizeStoreName(snap.storeName) === storeFilter.slice('store:'.length);
  }
  if (storeFilter.startsWith('location:')) {
    return shoppingFilterKey(snap) === storeFilter;
  }
  return snap.storeName === storeFilter;
}

function storeFilterMatchesItem(storeFilter: string, item: ShoppingEditItem): boolean {
  if (!item.storeName) return false;
  if (storeFilter.startsWith('store:')) {
    return normalizeStoreName(item.storeName) === storeFilter.slice('store:'.length);
  }
  if (storeFilter.startsWith('location:')) {
    return `location:${buildShoppingLocationKey(item)}` === storeFilter;
  }
  return item.storeName === storeFilter;
}

export function dateGroupLabel(date: Date, now = new Date()): string {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const difference = Math.round((today - day) / (24 * 60 * 60 * 1000));

  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}
