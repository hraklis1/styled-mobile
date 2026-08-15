import { resolveImageUri } from './resolveImageUri';
import { itemThumbUri } from './itemImage';
import { CATEGORY_LABELS } from '../types/item';
import type { ItemCategory } from '../types/item';
import type { Board, BoardFeedItem } from '../types/board';
import type { Item } from '../types/item';
import type { Outfit } from '../types/outfit';

export type BoardFilter = 'all' | BoardFeedItem['kind'];

export function getBoardSavedCount(board: Board): number {
  return board.itemIds.length + board.outfitIds.length + board.wishlistIds.length;
}

export function getBoardCoverUris(
  board: Board,
  itemMap: Map<number, Item>,
  outfitMap: Map<number, Outfit>,
): string[] {
  const uris: string[] = [];
  const add = (raw?: string | null) => {
    const uri = resolveImageUri(raw ?? undefined);
    if (uri && !uris.includes(uri)) uris.push(uri);
  };
  // The server stores both generated composites and user-selected covers here.
  // Treat either as the intentional primary cover; member imagery is the
  // resilient client-side fallback only while no cover has been generated yet.
  add(board.coverImageUrl);
  if (uris.length > 0) return uris;
  board.itemIds.forEach((id) => add(itemThumbUri(itemMap.get(id))));
  board.outfitIds.forEach((id) => add(outfitMap.get(id)?.aiGeneratedImageUrl));
  return uris.slice(0, 4);
}

export function filterBoardFeed(items: BoardFeedItem[], filter: BoardFilter): BoardFeedItem[] {
  return filter === 'all' ? items : items.filter((item) => item.kind === filter);
}

export function getBoardInsights(items: BoardFeedItem[]) {
  const colors: string[] = [];
  const categoryCounts = new Map<string, number>();
  for (const entry of items) {
    if (entry.kind !== 'item') continue;
    for (const color of entry.item.colorPalette ?? []) {
      if (color && !colors.includes(color) && colors.length < 5) colors.push(color);
    }
    if (colors.length < 5 && entry.item.colorNormalized && !colors.includes(entry.item.colorNormalized)) {
      colors.push(entry.item.colorNormalized);
    }
    const category = entry.item.category ? CATEGORY_LABELS[entry.item.category] : 'Other';
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  return {
    colors: colors.slice(0, 5),
    categories: [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
  };
}

/** The two structural silhouettes an outfit can be built from. */
const OUTFIT_PATHS: ItemCategory[][] = [
  ['full_body', 'shoes'],
  ['top', 'bottom', 'shoes'],
];

/**
 * Which slot to name when several are missing. Shoes first because a board of
 * clothes with nothing to wear on your feet is the most common near-miss.
 */
const SLOT_PRECEDENCE: ItemCategory[] = ['shoes', 'bottom', 'top', 'full_body'];

const SLOT_NOUNS: Record<ItemCategory, string> = {
  top: 'a top', bottom: 'a bottom', full_body: 'a dress or set', shoes: 'shoes',
  outerwear: 'outerwear', accessory: 'an accessory', valuables: 'a piece',
};

export type BoardGap = { text: string; missing: ItemCategory };

/** Board members the server would consider wearable, mirroring its own filter. */
function wearableItems(items: BoardFeedItem[]) {
  return items.flatMap((entry) =>
    entry.kind === 'item'
      && !entry.item.isArchived
      && entry.item.condition !== 'needs_repair'
      && entry.item.condition !== 'donate'
      ? [entry.item]
      : []);
}

/**
 * Whether this board holds a complete silhouette the stylist could actually
 * build a look from — the exact predicate the server applies in
 * canBuildOutfitFromItems.
 *
 * Distinct from `getBoardGap(items) === null`, which is also true for a board
 * holding almost nothing. Using the gap for the button gate offered to style
 * empty boards, which the server then answers with prose.
 */
export function canComposeOutfit(items: BoardFeedItem[]): boolean {
  const present = new Set(wearableItems(items).map((item) => item.category));
  return OUTFIT_PATHS.some((path) => path.every((slot) => present.has(slot)));
}

/**
 * A single deterministic sentence about what this board still needs before it
 * could become an outfit, or null when it needs nothing (or too little is
 * saved to say anything useful).
 *
 * The "needs nothing" case mirrors the server's canBuildOutfitFromItems
 * (Styled/server/stylistRouting.ts) exactly — including its wearability
 * filter — because the board detail screen uses a null gap as the gate for
 * offering to style the board. If the two disagreed, the button would appear
 * for boards the server then refuses to compose from.
 */
export function getBoardGap(items: BoardFeedItem[]): BoardGap | null {
  const wearable = wearableItems(items);

  // Below this there is nothing worth saying — every board starts here.
  if (wearable.length < 3) return null;

  const present = new Set(wearable.map((item) => item.category));
  const rank = (slots: ItemCategory[]) =>
    SLOT_PRECEDENCE.findIndex((slot) => slots.includes(slot));

  // Fewest missing slots wins; ties break on precedence so a board holding a
  // top is told to add a bottom rather than to replace it with a dress.
  const nearest = OUTFIT_PATHS
    .map((path) => path.filter((slot) => !present.has(slot)))
    .reduce((a, b) => {
      if (b.length !== a.length) return b.length < a.length ? b : a;
      return rank(b) < rank(a) ? b : a;
    });

  if (nearest.length === 0) return null;

  const missing = SLOT_PRECEDENCE.find((slot) => nearest.includes(slot)) ?? nearest[0];
  const noun = SLOT_NOUNS[missing];

  // Only promise a finished outfit when exactly one slot stands in the way.
  const text = nearest.length === 1
    ? `Add ${noun} and this board can become an outfit.`
    : `Add ${noun} to start building outfits here.`;

  return { text, missing };
}
