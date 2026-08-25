import { dateGroupLabel, type ShoppingEditItem } from './shoppingGallery';
import { formatShoppingPlaceLabel } from './shoppingLocations';
import { SHORTLIST_COPY } from './shoppingVocabulary';

/**
 * One shopping trip: everything photographed at a single store, on a single
 * day, at a single location. The shortlist bundles items this way so a visit
 * reads as one object on the screen instead of a loose run of cards.
 */
export type ShoppingSessionGroup = {
  key: string;
  shoppingSessionId: string | null;
  dateLabel: string;
  storeName: string | null;
  placeLabel: string | null;
  locationHint: string | null;
  coverSnap: ShoppingEditItem['primarySnap'];
  items: ShoppingEditItem[];
  itemCount: number;
  photoCount: number;
  knownSpend: number | null;
  capturedAt: string;
  needsPriceCount: number;
  pendingCount: number;
  favoriteCount: number;
  unsortedCount: number;
  /** Modal colorLabel across the visit's items, ties broken by the cover item.
   *  Null when nothing in the visit has been classified — the card's spine then
   *  renders unpainted rather than guessing at a colour. */
  dominantColorLabel: string | null;
};

/** The colour the visit reads as: whichever label the most items share. */
function dominantColorLabel(
  items: ShoppingEditItem[],
  coverItem: ShoppingEditItem,
): string | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = item.colorLabel?.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const coverLabel = coverItem.colorLabel?.trim() || null;
  let best: string | null = null;
  let bestCount = 0;
  for (const [label, count] of counts) {
    // A tie goes to the cover item, so the spine matches the photo that
    // represents the visit everywhere else.
    if (count > bestCount || (count === bestCount && label === coverLabel)) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

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
    const sessionId = item.snaps.find((snap) => snap.shoppingSessionId)?.shoppingSessionId ?? null;
    const key = sessionId
      ? `session:${sessionId}`
      : `${dateKey}:${item.storeName ?? 'Store not set'}:${placeLabel ?? ''}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return [...grouped.entries()]
    .map(([key, groupItems]) => {
      const sorted = [...groupItems].sort(
        (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
      );
      const pricedItems = sorted.filter((item) => item.extractedPrice !== null);
      const earliest = [...sorted].sort(
        (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
      );
      const coverItem = earliest.find((item) => item.primarySnap.captureRole === 'garment') ?? earliest[0];
      const shoppingSessionId = sorted.flatMap((item) => item.snaps)
        .find((snap) => snap.shoppingSessionId)?.shoppingSessionId ?? null;

      return {
        key,
        shoppingSessionId,
        dateLabel: dateGroupLabel(new Date(sorted[0].capturedAt), now),
        storeName: sorted.find((item) => item.storeName)?.storeName ?? null,
        placeLabel: sorted.some((item) => item.storeName) ? itemPlaceLabel(sorted[0]) : null,
        locationHint: sorted.find((item) => item.locationHint)?.locationHint ?? null,
        coverSnap: coverItem.primarySnap,
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
        dominantColorLabel: dominantColorLabel(sorted, coverItem),
      };
    })
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
}

export type ShoppingSessionAttentionKey =
  | 'needs-store'
  | 'on-this-phone'
  | 'needs-price'
  | 'unsorted'
  | 'favorite'
  | 'settled';

export type ShoppingSessionAttention = {
  key: ShoppingSessionAttentionKey;
  label: string;
};

/**
 * Everything about a trip that still wants attention, keyed and in priority
 * order. The card renders the first one or two of these as a status line, but
 * skips whichever it is already offering as a button — hence the keys: it must
 * be able to drop 'needs-store' without matching on the English.
 */
export function shoppingSessionAttention(group: ShoppingSessionGroup): ShoppingSessionAttention[] {
  const attention: ShoppingSessionAttention[] = [];

  if (!group.storeName) {
    attention.push({ key: 'needs-store', label: SHORTLIST_COPY.needsStore });
  }
  if (group.pendingCount > 0) {
    attention.push({ key: 'on-this-phone', label: `${group.pendingCount} ${SHORTLIST_COPY.onThisPhone.toLowerCase()}` });
  }
  if (group.needsPriceCount > 0) {
    attention.push({ key: 'needs-price', label: `${group.needsPriceCount} ${SHORTLIST_COPY.needsPrice.toLowerCase()}` });
  }
  if (group.unsortedCount > 0) {
    attention.push({ key: 'unsorted', label: `${group.unsortedCount} ${SHORTLIST_COPY.unsorted.toLowerCase()}` });
  }
  if (group.favoriteCount > 0) {
    attention.push({ key: 'favorite', label: `${group.favoriteCount} favorite` });
  }
  if (attention.length === 0) {
    attention.push({ key: 'settled', label: SHORTLIST_COPY.allSettled });
  }

  return attention;
}

/**
 * The short status line under a collapsed trip — what still wants attention,
 * so nothing is hidden by the bundle itself.
 */
export function shoppingSessionHighlights(group: ShoppingSessionGroup): string[] {
  return shoppingSessionAttention(group).map((entry) => entry.label).slice(0, 2);
}
