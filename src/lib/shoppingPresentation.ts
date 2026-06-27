import type { ShoppingEditItem } from './shoppingGallery';
import type { ShoppingCaptureRole, ShoppingFindCatalog, ShoppingFindCatalogStatus, ShoppingSnap } from '../types/shoppingSnap';

export type ShoppingReviewReasonKey = 'missing-price' | 'missing-store' | 'unsorted-photo' | 'text-needs-price-check';

export type ShoppingReviewReasonOption = {
  key: ShoppingReviewReasonKey;
  label: string;
  count: number;
};

export type ShoppingItemBadge = {
  key: string;
  label: string;
  tone: 'neutral' | 'attention' | 'success';
};

export const SHOPPING_CATALOG_STATUS_OPTIONS: { value: ShoppingFindCatalogStatus; label: string }[] = [
  { value: 'considering', label: 'Deciding' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'closet', label: 'Closet' },
  { value: 'passed', label: 'Passed' },
];

const REVIEW_REASON_LABELS: Record<ShoppingReviewReasonKey, string> = {
  'missing-price': 'Needs price',
  'missing-store': 'Needs store',
  'unsorted-photo': 'Unsorted',
  'text-needs-price-check': 'Check text',
};

export function formatShoppingPrice(price: number | null): string | null {
  if (price === null) return null;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(price);
}

function reviewReasonKey(reason: string): ShoppingReviewReasonKey | null {
  if (reason === 'Missing price') return 'missing-price';
  if (reason === 'Missing store') return 'missing-store';
  if (reason === 'Unsorted photo') return 'unsorted-photo';
  if (reason === 'Text needs price check') return 'text-needs-price-check';
  return null;
}

export function buildShoppingReviewReasonOptions(items: ShoppingEditItem[]): ShoppingReviewReasonOption[] {
  const counts = new Map<ShoppingReviewReasonKey, number>();

  for (const item of items) {
    const itemKeys = new Set(item.reviewReasons.map(reviewReasonKey).filter((key): key is ShoppingReviewReasonKey => key !== null));
    for (const key of itemKeys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return (Object.keys(REVIEW_REASON_LABELS) as ShoppingReviewReasonKey[])
    .map((key) => ({
      key,
      label: REVIEW_REASON_LABELS[key],
      count: counts.get(key) ?? 0,
    }))
    .filter((option) => option.count > 0);
}

export function itemHasShoppingReviewReason(item: ShoppingEditItem, key: ShoppingReviewReasonKey): boolean {
  return item.reviewReasons.some((reason) => reviewReasonKey(reason) === key);
}

export function itemRoleSummary(item: ShoppingEditItem): string {
  const garmentCount = item.snaps.filter((snap) => snap.captureRole === 'garment').length;
  const tagCount = item.snaps.filter((snap) => snap.captureRole === 'tag').length;
  const unknownCount = item.snaps.filter((snap) => snap.captureRole === 'unknown').length;
  const parts: string[] = [];

  if (garmentCount > 0) parts.push(`${garmentCount} garment${garmentCount === 1 ? '' : 's'}`);
  if (tagCount > 0) parts.push(`${tagCount} tag${tagCount === 1 ? '' : 's'}`);
  if (unknownCount > 0) parts.push(`${unknownCount} unsorted`);
  return parts.length > 0 ? parts.join(' · ') : `${item.photoCount} photo${item.photoCount === 1 ? '' : 's'}`;
}

export function shoppingItemBadges(item: ShoppingEditItem): ShoppingItemBadge[] {
  const badges: ShoppingItemBadge[] = [];

  if (item.isFavorite) {
    badges.push({ key: 'favorite', label: 'Favorite', tone: 'success' });
  }
  if (item.catalogStatus === 'wishlist') {
    badges.push({ key: 'wishlist', label: 'Wishlist', tone: 'success' });
  }
  if (item.catalogStatus === 'closet') {
    badges.push({ key: 'closet', label: 'In closet', tone: 'success' });
  }
  if (item.catalogStatus === 'passed') {
    badges.push({ key: 'passed', label: 'Passed', tone: 'neutral' });
  }
  if (item.syncStatus === 'pending') {
    badges.push({ key: 'pending', label: 'Saved locally', tone: 'attention' });
  }
  if (item.extractedPrice === null) {
    badges.push({ key: 'missing-price', label: 'Needs price', tone: 'attention' });
  }
  if (item.reviewReasons.includes('Missing store')) {
    badges.push({ key: 'missing-store', label: 'Needs store', tone: 'attention' });
  }
  if (item.reviewReasons.includes('Unsorted photo')) {
    badges.push({ key: 'unsorted', label: 'Sort photos', tone: 'neutral' });
  }
  if (badges.length === 0) {
    badges.push({ key: 'catalogued', label: 'Catalogued', tone: 'success' });
  }

  return badges.slice(0, 2);
}

export function snapRoleLabel(role: ShoppingCaptureRole): string {
  if (role === 'tag') return 'Tag';
  if (role === 'garment') return 'Garment';
  return 'Unsorted';
}

export function shoppingCatalogStatusLabel(status: ShoppingFindCatalogStatus): string {
  return SHOPPING_CATALOG_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Deciding';
}

export function shoppingCatalogChips(value: ShoppingFindCatalog): string[] {
  return [
    value.category,
    value.sizeLabel ? `Size ${value.sizeLabel}` : null,
    value.colorLabel,
    value.materialLabel,
  ].filter((chip): chip is string => Boolean(chip));
}

export function garmentFriendlyContentFit(snap: ShoppingSnap): 'cover' | 'contain' {
  return snap.captureRole === 'garment' ? 'contain' : 'cover';
}
