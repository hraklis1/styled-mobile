export type ScanReviewPrimaryAction = 'next' | 'extract';

// Cycling status copy for the Detect step — no real per-item progress exists
// until the single pose-scan request resolves, so this is deliberately
// vibes-based rather than tied to actual detection events.
export const SCAN_MESSAGES = [
  'Analyzing your outfit…',
  'Identifying clothing items…',
  'Detecting colors & patterns…',
  'Reading style details…',
  'Almost there…',
];

export type ReviewCarouselMetrics = {
  cardWidth: number;
  gap: number;
  sidePadding: number;
  snapInterval: number;
};

export function reviewCarouselMetrics(viewportWidth: number): ReviewCarouselMetrics {
  const sidePadding = 24;
  const gap = 12;
  const cardWidth = Math.max(240, viewportWidth - 64);
  return { cardWidth, gap, sidePadding, snapInterval: cardWidth + gap };
}

// The hero is the subject at pre-extract, where the job is judging the crop.
// Once the job becomes form-filling it steps back so the fields get the room.
export function reviewHeroHeight(viewportHeight: number, compact = false): number {
  if (compact) return Math.round(Math.max(196, Math.min(248, viewportHeight * 0.24)));
  return Math.round(Math.max(248, Math.min(318, viewportHeight * 0.31)));
}

export function reviewCarouselIndex(offset: number, snapInterval: number, itemCount: number): number {
  if (itemCount <= 0 || snapInterval <= 0) return 0;
  return Math.max(0, Math.min(itemCount - 1, Math.round(offset / snapInterval)));
}

export function filterBrandSuggestions(
  suggestions: string[],
  query: string,
  limit = 30,
): string[] {
  const normalized = query.trim().toLocaleLowerCase();
  const seen = new Set<string>();
  const unique = suggestions.filter((brand) => {
    const key = brand.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!normalized) return unique.slice(0, limit);
  return unique
    .filter((brand) => brand.toLocaleLowerCase().includes(normalized))
    .sort((a, b) => {
      const aStarts = a.toLocaleLowerCase().startsWith(normalized) ? 0 : 1;
      const bStarts = b.toLocaleLowerCase().startsWith(normalized) ? 0 : 1;
      return aStarts - bStarts || a.localeCompare(b);
    })
    .slice(0, limit);
}

export function unreviewedPieceIds(pieceIds: string[], reviewedIds: ReadonlySet<string>): string[] {
  return pieceIds.filter((id) => !reviewedIds.has(id));
}

export function scanReviewPrimaryAction(
  pieceIds: string[],
  reviewedIds: ReadonlySet<string>,
  activeId: string | null,
): ScanReviewPrimaryAction {
  if (pieceIds.length <= 1) return 'extract';
  const remaining = unreviewedPieceIds(pieceIds, reviewedIds);
  if (remaining.length === 0) return 'extract';
  if (remaining.length === 1 && remaining[0] === activeId) return 'extract';
  return 'next';
}

export function scanReviewPrimaryLabel(
  pieceIds: string[],
  reviewedIds: ReadonlySet<string>,
  activeId: string | null,
): string {
  if (pieceIds.length <= 1) return 'Extract details';
  if (scanReviewPrimaryAction(pieceIds, reviewedIds, activeId) === 'extract') {
    return `Extract details for all ${pieceIds.length}`;
  }
  return activeId && reviewedIds.has(activeId) ? 'Next unreviewed piece' : 'Next piece';
}

export function nextUnreviewedPieceId(
  pieceIds: string[],
  reviewedIds: ReadonlySet<string>,
  activeId: string | null,
): string | null {
  if (pieceIds.length === 0) return null;
  const start = Math.max(0, pieceIds.indexOf(activeId ?? pieceIds[0]));
  for (let offset = 1; offset <= pieceIds.length; offset += 1) {
    const candidate = pieceIds[(start + offset) % pieceIds.length];
    if (!reviewedIds.has(candidate)) return candidate;
  }
  return null;
}

export function resolvedActivePieceId(pieceIds: string[], activeId: string | null): string | null {
  if (pieceIds.length === 0) return null;
  return activeId && pieceIds.includes(activeId) ? activeId : pieceIds[0];
}

export function resolveExtractedIdentity({
  initialName,
  nameEdited,
  brandHint,
  extractedName,
  extractedBrand,
}: {
  initialName: string;
  nameEdited: boolean;
  brandHint: string;
  extractedName: string | null | undefined;
  extractedBrand: string | null | undefined;
}): { name: string; brand: string | null } {
  return {
    name: nameEdited ? initialName : (extractedName || initialName || 'Unknown Item'),
    brand: brandHint.trim() || extractedBrand || null,
  };
}
