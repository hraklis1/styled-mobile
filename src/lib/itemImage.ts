import { resolveImageUri } from './resolveImageUri';
import type { Item } from '../types/item';
import type { CoverImageVariant } from '../types/item';

/** An item-shaped object with just the image fields — lets callers pass partials. */
type ItemImageFields = Pick<
  Item,
  'imageUrl' | 'cutoutUrl' | 'polishedUrl' | 'thumbUrl' | 'coverImageVariant'
>;

export type ItemCoverPresentation = {
  uri: string | undefined;
  variant: CoverImageVariant;
  contentFit: 'cover' | 'contain';
  isCatalogStyle: boolean;
};

/**
 * True when the item has a background-removed thumbnail to display.
 *
 * Presentation differs for cutouts — they need padding and a uniform surface
 * behind them, where a plain photo crop should fill its frame — so cards branch
 * on this rather than assuming one treatment.
 */
export function hasCutout(item: Partial<ItemImageFields> | null | undefined): boolean {
  return !!item?.cutoutUrl;
}

/** True when the item is currently displaying a generatively polished image. */
export function hasPolished(item: Partial<ItemImageFields> | null | undefined): boolean {
  return !!item?.polishedUrl;
}

/**
 * Resolve the selected cover and its presentation treatment. A missing
 * preference is supported during rolling mobile/backend releases: legacy items
 * with a polish keep it, while every other legacy item defaults to its photo.
 * If the selected asset has disappeared, the original is the first fallback.
 */
export function itemCoverPresentation(
  item: Partial<ItemImageFields> | null | undefined,
  opts?: { preferThumb?: boolean },
): ItemCoverPresentation {
  if (!item) {
    return { uri: undefined, variant: 'original', contentFit: 'cover', isCatalogStyle: false };
  }

  const preferred: CoverImageVariant = item.coverImageVariant
    ?? (item.polishedUrl ? 'polished' : 'original');
  const candidates: Array<[CoverImageVariant, string | null | undefined]> = [
    [preferred, preferred === 'original'
      ? item.imageUrl
      : preferred === 'cutout'
        ? item.cutoutUrl
        : item.polishedUrl],
    ['original', item.imageUrl],
    ['polished', item.polishedUrl],
    ['cutout', item.cutoutUrl],
  ];
  const selected = candidates.find(([, value]) => !!value);
  const variant = selected?.[0] ?? 'original';
  const isCatalogStyle = variant === 'cutout' || variant === 'polished';

  // Thumbnails only exist for the original photo — cutout/polished are
  // already small (≤512-1024px) — so only substitute when the resolved
  // variant is 'original' and a thumb was actually generated. Older items
  // and generation failures fall through to imageUrl unchanged.
  const uri = opts?.preferThumb && variant === 'original' && item.thumbUrl
    ? resolveImageUri(item.thumbUrl)
    : resolveImageUri(selected?.[1]);

  return {
    uri,
    variant,
    contentFit: isCatalogStyle ? 'contain' : 'cover',
    isCatalogStyle,
  };
}

/** URI for the cover selected by the user, with a safe original-first fallback. */
export function itemImageUri(
  item: Partial<ItemImageFields> | null | undefined,
): string | undefined {
  return itemCoverPresentation(item).uri;
}

/** Like itemImageUri, but prefers the small list/grid thumbnail when available. */
export function itemThumbUri(
  item: Partial<ItemImageFields> | null | undefined,
): string | undefined {
  return itemCoverPresentation(item, { preferThumb: true }).uri;
}

export function itemImageContentFit(
  item: Partial<ItemImageFields> | null | undefined,
): 'cover' | 'contain' {
  return itemCoverPresentation(item).contentFit;
}

export function coverImageVariantLabel(variant: CoverImageVariant): string {
  if (variant === 'cutout') return 'Cutout';
  if (variant === 'polished') return 'AI polished';
  return 'Photo';
}
