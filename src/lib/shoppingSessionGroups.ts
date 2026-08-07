import { dateGroupLabel, type ShoppingEditItem } from './shoppingGallery';
import { formatShoppingPlaceLabel } from './shoppingLocations';

/**
 * One shopping trip: everything photographed at a single store, on a single
 * day, at a single location. The shortlist bundles items this way so a visit
 * reads as one object on the screen instead of a loose run of cards.
 */
export type ShoppingSessionGroup = {
  key: string;
  dateLabel: string;
  storeName: string;
  placeLabel: string | null;
  items: ShoppingEditItem[];
  itemCount: number;
  photoCount: number;
  knownSpend: number | null;
  capturedAt: string;
  needsPriceCount: number;
  pendingCount: number;
  favoriteCount: number;
  unsortedCount: number;
};

function itemPlaceLabel(item: ShoppingEditItem): string | null {
  const label = formatShoppingPlaceLabel(item);
  return label === 'Location not set' ? null : label;
}

export function buildShoppingSessionGroups(
  items: ShoppingEditItem[],
  now = new Date(),
): ShoppingSessionGroup[] {
  const grouped = new Map<string, ShoppingEditItem[]>();

  for (const item of items) {
    const date = new Date(item.capturedAt);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const placeLabel = itemPlaceLabel(item);
    const key = `${dateKey}:${item.storeName ?? 'Store not set'}:${placeLabel ?? ''}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return [...grouped.entries()]
    .map(([key, groupItems]) => {
      const sorted = [...groupItems].sort(
        (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
      );
      const pricedItems = sorted.filter((item) => item.extractedPrice !== null);

      return {
        key,
        dateLabel: dateGroupLabel(new Date(sorted[0].capturedAt), now),
        storeName: sorted[0].storeName ?? 'Store not set',
        placeLabel: itemPlaceLabel(sorted[0]),
        items: sorted,
        itemCount: sorted.length,
        photoCount: sorted.reduce((count, item) => count + item.photoCount, 0),
        knownSpend: pricedItems.length > 0
          ? pricedItems.reduce((total, item) => total + (item.extractedPrice ?? 0), 0)
          : null,
        capturedAt: sorted[0].capturedAt,
        needsPriceCount: sorted.length - pricedItems.length,
        pendingCount: sorted.filter((item) => item.syncStatus === 'pending').length,
        favoriteCount: sorted.filter((item) => item.isFavorite).length,
        unsortedCount: sorted.filter((item) => item.reviewReasons.includes('Unsorted photo')).length,
      };
    })
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
}

/**
 * The short status line under a collapsed trip — what still wants attention,
 * so nothing is hidden by the bundle itself.
 */
export function shoppingSessionHighlights(group: ShoppingSessionGroup): string[] {
  const highlights: string[] = [];

  if (group.pendingCount > 0) highlights.push(`${group.pendingCount} saved locally`);
  if (group.needsPriceCount > 0) highlights.push(`${group.needsPriceCount} needs price`);
  if (group.unsortedCount > 0) highlights.push(`${group.unsortedCount} to sort`);
  if (group.favoriteCount > 0) highlights.push(`${group.favoriteCount} favorite`);
  if (highlights.length === 0) highlights.push('All catalogued');

  return highlights.slice(0, 2);
}
