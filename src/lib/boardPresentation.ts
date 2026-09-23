import { resolveImageUri } from './resolveImageUri';
import { itemThumbUri } from './itemImage';
import { CATEGORY_LABELS } from '../types/item';
import { filterVisibleBoards } from './legacyBoards';
import type { Board, BoardFeedItem } from '../types/board';
import type { Item } from '../types/item';
import type { Outfit } from '../types/outfit';
import type { WishlistEntry } from './wishlist';
import type { BoardEntryRef } from '../hooks/useBoards';

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
  wishlistMap: Map<string, WishlistEntry> = new Map(),
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
  // Wishlist product imagery only fills leftover slots, mirroring the server's
  // cover bake, so a wishlist-only board is not left on the empty placeholder.
  board.wishlistIds.forEach((id) => {
    const entry = wishlistMap.get(id);
    if (!entry) return;
    entry.outfit.items.forEach((piece) => add(piece.imageUrl));
    entry.outfit.shoppingBrief?.targets?.forEach((target) =>
      add(target.offers?.find((offer) => Boolean(offer.imageUrl))?.imageUrl ?? target.imageUrl));
  });
  return uris.slice(0, 4);
}

/**
 * A board's owned pieces, resolved from the whole closet in board order.
 *
 * The board feed is paginated, so anything derived from it only sees the pages
 * loaded so far. Insights and styling gates use this instead, which covers
 * every saved piece.
 */
export function getBoardPieces(board: Pick<Board, 'itemIds'>, closet: Item[]): Item[] {
  const byId = new Map(closet.map((item) => [item.id, item]));
  return board.itemIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

/** Count per filter chip, taken from the board's own membership rather than loaded pages. */
export function getBoardFilterCount(board: Pick<Board, 'itemIds' | 'outfitIds' | 'wishlistIds'>, filter: BoardFilter): number {
  if (filter === 'item') return board.itemIds.length;
  if (filter === 'outfit') return board.outfitIds.length;
  if (filter === 'wishlist') return board.wishlistIds.length;
  return board.itemIds.length + board.outfitIds.length + board.wishlistIds.length;
}

/** Feed keys (`i12`, `o3`, `wabc`) back into typed board references. */
export function parseBoardEntryKeys(keys: Iterable<string>): BoardEntryRef[] {
  const refs: BoardEntryRef[] = [];
  for (const key of keys) {
    if (key.startsWith('i')) refs.push({ type: 'item', id: Number(key.slice(1)) });
    else if (key.startsWith('o')) refs.push({ type: 'outfit', id: Number(key.slice(1)) });
    else if (key.startsWith('w')) refs.push({ type: 'wishlist', id: key.slice(1) });
  }
  return refs;
}

/** The board's membership with the given references taken out. */
export function withoutBoardEntries(
  board: Pick<Board, 'itemIds' | 'outfitIds' | 'wishlistIds'>,
  refs: BoardEntryRef[],
): Pick<Board, 'itemIds' | 'outfitIds' | 'wishlistIds'> {
  const itemIds = new Set<number>();
  const outfitIds = new Set<number>();
  const wishlistIds = new Set<string>();
  for (const ref of refs) {
    if (ref.type === 'item') itemIds.add(ref.id);
    else if (ref.type === 'outfit') outfitIds.add(ref.id);
    else wishlistIds.add(ref.id);
  }
  return {
    itemIds: board.itemIds.filter((id) => !itemIds.has(id)),
    outfitIds: board.outfitIds.filter((id) => !outfitIds.has(id)),
    wishlistIds: board.wishlistIds.filter((id) => !wishlistIds.has(id)),
  };
}

export function getBoardInsights(items: Item[]) {
  const colors: string[] = [];
  const categoryCounts = new Map<string, number>();
  for (const item of items) {
    for (const color of item.colorPalette ?? []) {
      if (color && !colors.includes(color) && colors.length < 5) colors.push(color);
    }
    if (colors.length < 5 && item.colorNormalized && !colors.includes(item.colorNormalized)) {
      colors.push(item.colorNormalized);
    }
    const category = item.category ? CATEGORY_LABELS[item.category] : 'Other';
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  return {
    colors: colors.slice(0, 5),
    categories: [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
  };
}
