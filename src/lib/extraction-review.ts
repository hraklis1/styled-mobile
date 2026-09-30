/** Inclusion is independent of processing and metadata review. */
export type InclusionChange = { id: string; included: boolean };
export type ReviewSubmission = { sessionId: string; revision: number; pieceIds: readonly string[] };
export type Includable = { id: string; included?: boolean };
export function applyInclusionChanges<T extends Includable>(pieces: T[], changes: readonly InclusionChange[]): T[] {
  const values = new Map(changes.map(change => [change.id, change.included]));
  return pieces.map(piece => values.has(piece.id) ? { ...piece, included: values.get(piece.id)! } : piece);
}
export function includedPieces<T extends Includable>(pieces: readonly T[]): T[] {
  return pieces.filter(piece => piece.included !== false);
}
export function reviewColumns(width: number, fontScale: number): number {
  if (fontScale >= 1.5 || width < 340) return 1;
  return width >= 536 ? 3 : 2;
}
