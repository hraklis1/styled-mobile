import { resolveImageUri } from './resolveImageUri';
import { itemThumbUri } from './itemImage';
import { CATEGORY_LABELS } from '../types/item';
import { filterVisibleBoards } from './legacyBoards';
import type { ItemCategory } from '../types/item';
import type { Board, BoardFeedItem } from '../types/board';
import type { Item } from '../types/item';
import type { Outfit } from '../types/outfit';

export type BoardFilter = 'all' | BoardFeedItem['kind'];

export function getBoardSavedCount(board: Board): number {
  return board.itemIds.length + board.outfitIds.length + board.wishlistIds.length;
}

/** Compact editorial metadata for board cards and the board identity rail. */
export function getBoardContentSummary(
  board: Pick<Board, 'itemIds' | 'outfitIds' | 'wishlistIds'>,
): string {
  const pieces = board.itemIds.length;
  const looks = board.outfitIds.length + board.wishlistIds.length;
  const segments: string[] = [];

  if (pieces > 0) segments.push(`${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`);
  if (looks > 0) segments.push(`${looks} ${looks === 1 ? 'look' : 'looks'}`);

  return segments.join(' · ') || 'Empty board';
}

/** Search is a stable affordance once the visible collection is large enough. */
export function shouldShowBoardSearch(boards: Pick<Board, 'name'>[]): boolean {
  return filterVisibleBoards(boards).length >= 6;
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
 */
export function canComposeOutfit(items: BoardFeedItem[]): boolean {
  const present = new Set(wearableItems(items).map((item) => item.category));
  return OUTFIT_PATHS.some((path) => path.every((slot) => present.has(slot)));
}
