import { resolveImageUri } from './resolveImageUri';
import type { Item } from '../types/item';

/** An item-shaped object with just the image fields — lets callers pass partials. */
type ItemImageFields = Pick<Item, 'imageUrl' | 'cutoutUrl' | 'polishedUrl'>;

/**
 * True when the item has a background-removed thumbnail to display.
 *
 * Presentation differs for cutouts — they need padding and a uniform surface
 * behind them, where a plain photo crop should fill its frame — so cards branch
 * on this rather than assuming one treatment.
 */
export function hasCutout(item: Partial<ItemImageFields> | null | undefined): boolean {
  // A polished image is a cutout for presentation purposes: it too sits on
  // transparency and wants the padded, uniform treatment rather than filling
  // its frame like a photo crop.
  return !!(item?.polishedUrl ?? item?.cutoutUrl);
}

/** True when the item is currently displaying a generatively polished image. */
export function hasPolished(item: Partial<ItemImageFields> | null | undefined): boolean {
  return !!item?.polishedUrl;
}

/**
 * The URI to display for an item: its polished catalog shot if it has one,
 * else its cutout, else the original photo.
 *
 * Every closet surface should use this rather than reaching for `imageUrl`
 * directly, so "which image represents this item" is decided in one place.
 * Use `resolveImageUri(item.imageUrl)` explicitly where the *original* photo is
 * genuinely wanted — the detail screen's full-resolution view, for example.
 */
export function itemImageUri(
  item: Partial<ItemImageFields> | null | undefined,
): string | undefined {
  if (!item) return undefined;
  return resolveImageUri(item.polishedUrl ?? item.cutoutUrl ?? item.imageUrl);
}
