import { resolveImageUri } from './resolveImageUri';
import { itemThumbUri } from './itemImage';
import { CATEGORY_LABELS } from '../types/item';
import type { Board, BoardFeedItem } from '../types/board';
import type { Item } from '../types/item';
import type { Outfit } from '../types/outfit';

export type BoardFilter = 'all' | BoardFeedItem['kind'];
export type BoardAIIntent = 'outfit' | 'complete' | 'capsule' | 'theme';

export function getBoardSavedCount(board: Board): number {
  return board.itemIds.length + board.outfitIds.length + board.wishlistIds.length + (board.storeFinds?.length ?? 0);
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
  (board.storeFinds ?? []).forEach((find) => add(find.imageUrls?.[0] ?? find.imageUrl));
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

export function buildBoardStylistPrompt(boardName: string, _items: BoardFeedItem[], intent: BoardAIIntent): string {
  // The action and membership are sent as hidden structured context. Keep this
  // visible chat bubble human-sized even for a board with dozens of entries.
  const action = intent === 'outfit' ? 'Create an outfit for' : intent === 'complete'
    ? 'Complete' : intent === 'capsule' ? 'Build a capsule for' : 'Set the theme for';
  return `${action} ${boardName}`;
}
