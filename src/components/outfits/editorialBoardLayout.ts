import type { Item } from '../../types/item';
import { itemCoverPresentation } from '../../lib/itemImage';
import { resolveImageUri } from '../../lib/resolveImageUri';

export type BoardPiece = { id: number; category: string; item?: Item };
/** A shoppable stand-in for the suggestion tile, when one is in stock. */
export type BoardSuggestionOffer = { imageUrl: string; formattedPrice?: string | null; brand?: string | null };
export type BoardSuggestion = { label: string; category: string; offer?: BoardSuggestionOffer };
export type BoardTile = { kind: 'owned'; piece: BoardPiece } | { kind: 'suggestion'; suggestion: BoardSuggestion };

/** Suggestions occupy supporting rows only and never acquire a wardrobe ID. */
export function editorialBoardDisplayRows(pieces: readonly BoardPiece[], suggestion?: BoardSuggestion): { pieces: BoardTile[]; foundation: boolean }[] {
  const owned = editorialBoardRows(pieces);
  if (!suggestion) return owned.map(row => ({ ...row, pieces: row.pieces.map(piece => ({ kind: 'owned' as const, piece })) }));
  const rows = owned.filter(row => row.foundation).map(row => ({ ...row, pieces: row.pieces.map(piece => ({ kind: 'owned' as const, piece }) as BoardTile) }));
  const supporting: BoardTile[] = owned.filter(row => !row.foundation).flatMap(row => row.pieces.map(piece => ({ kind: 'owned' as const, piece })));
  supporting.push({ kind: 'suggestion', suggestion });
  while (supporting.length) {
    const count = supporting.length === 4 ? 2 : Math.min(3, supporting.length);
    rows.push({ foundation: false, pieces: supporting.splice(0, count) });
  }
  return rows;
}
const foundationOrder = ['full_body', 'dress', 'top', 'bottom', 'outerwear'];
const supportingOrder = [...foundationOrder, 'shoes', 'bag', 'accessory', 'accessories', 'valuables'];
export function resolveBoardPieces(entries: readonly { id: number; category: string }[], items: readonly Item[]): BoardPiece[] {
  const map = new Map(items.map(item => [item.id, item]));
  return entries.map(entry => ({ ...entry, item: map.get(entry.id), category: map.get(entry.id)?.category ?? entry.category }));
}
export function boardPhotoUri(item?: Item): string | undefined {
  if (!item) return undefined;
  const cover = itemCoverPresentation(item);
  return cover.variant === 'cutout' ? resolveImageUri(item.imageUrl ?? item.polishedUrl) : cover.uri;
}
export function editorialBoardRows(pieces: readonly BoardPiece[]): { pieces: BoardPiece[]; foundation: boolean }[] {
  const rank = (category: string) => { const index = supportingOrder.indexOf(category); return index < 0 ? 99 : index; };
  const sorted = [...pieces].sort((a, b) => rank(a.category) - rank(b.category));
  const foundation = sorted.filter(piece => foundationOrder.includes(piece.category)).slice(0, 2);
  const selected = new Set(foundation);
  const supporting = sorted.filter(piece => !selected.has(piece));
  const rows = foundation.length ? [{ pieces: foundation, foundation: true }] : [];
  while (supporting.length) {
    const count = supporting.length === 4 ? 2 : Math.min(3, supporting.length);
    rows.push({ pieces: supporting.splice(0, count), foundation: false });
  }
  return rows;
}
