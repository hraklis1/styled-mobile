/**
 * The order pieces are put on and read in a look: outer layer first, then a
 * one-piece or top, bottom, shoes, then bags and accessories. Shared by Home's
 * Today's Look and every stylist surface that lays an outfit out.
 */
const CATEGORY_RANK: Record<string, number> = {
  outerwear: 0, full_body: 1, dress: 1, top: 2, bottom: 3, shoes: 4, bag: 5, accessory: 6, accessories: 6, valuables: 6,
};

export function categoryRank(category: string | null | undefined): number {
  return CATEGORY_RANK[(category ?? '').toLowerCase()] ?? 7;
}

/** Stable sort into wear order; pieces in the same category keep their given order. */
export function sortByWearOrder<T>(pieces: readonly T[], categoryOf: (piece: T) => string | null | undefined): T[] {
  return pieces
    .map((piece, index) => ({ piece, index }))
    .sort((a, b) => categoryRank(categoryOf(a.piece)) - categoryRank(categoryOf(b.piece)) || a.index - b.index)
    .map(({ piece }) => piece);
}
