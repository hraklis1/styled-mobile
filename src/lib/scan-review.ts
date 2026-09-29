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

// One hero size for every stage. The spec sheet under it is a short list of
// rows now, not a stacked form, so the garment can keep ~40% of the screen
// without pushing the first rows below the fold.
export function loupeHeroHeight(viewportHeight: number): number {
  return Math.round(Math.max(280, Math.min(380, viewportHeight * 0.4)));
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

// ─── Review triage ──────────────────────────────────────────────────────────

/** The fields the review can mark "worth a look". Mirrors the server list. */
export const REVIEW_FIELDS = ['name', 'category', 'color', 'material', 'fit', 'brand'] as const;
export type ReviewField = (typeof REVIEW_FIELDS)[number];

/**
 * `ready` is silent (no mark), `check` carries the walnut dot, `confirmed`
 * the hairline tick. There is deliberately no numeric confidence anywhere a
 * user can see it.
 */
export type PieceReviewState = 'ready' | 'check' | 'confirmed';

export type TriageInput = {
  name: string;
  category: string | null;
  lowConfidenceFields?: readonly string[] | null;
  extractFailed?: boolean;
};

const PLACEHOLDER_NAMES = new Set(['', 'unknown item', 'untitled']);

/** Fields that deserve a second look, in display order. */
export function pieceFlags(piece: TriageInput): ReviewField[] {
  const flagged = new Set<string>(piece.lowConfidenceFields ?? []);
  if (PLACEHOLDER_NAMES.has(piece.name.trim().toLocaleLowerCase())) flagged.add('name');
  if (!piece.category) flagged.add('category');
  return REVIEW_FIELDS.filter((field) => flagged.has(field));
}

export function pieceReviewState(
  piece: TriageInput & { id: string },
  confirmedIds: ReadonlySet<string>,
): PieceReviewState {
  if (confirmedIds.has(piece.id)) return 'confirmed';
  if (piece.extractFailed || pieceFlags(piece).length > 0) return 'check';
  return 'ready';
}

export type ReviewSummary = { ready: number; check: number; confirmed: number };

export function reviewSummary(states: readonly PieceReviewState[]): ReviewSummary {
  const summary: ReviewSummary = { ready: 0, check: 0, confirmed: 0 };
  for (const state of states) summary[state] += 1;
  return summary;
}

/** "12 ready · 4 to check" — confirmed pieces count as ready. */
export function reviewSummaryLabel(summary: ReviewSummary): string {
  const ready = summary.ready + summary.confirmed;
  if (summary.check === 0) return ready === 1 ? 'Ready to add' : `All ${ready} ready`;
  if (ready === 0) return `${summary.check} to check`;
  return `${ready} ready · ${summary.check} to check`;
}

export type SheetGuidance = { lead: string | null; hint: string };

/**
 * The one line under the contact sheet's title. Its job changes with the
 * state: before extraction it says what to do; after, it says how things
 * stand and — the part that matters — that opening every piece is optional.
 */
export function sheetGuidance(stage: 'pre-extract' | 'review', summary: ReviewSummary): SheetGuidance {
  if (stage === 'pre-extract') {
    return { lead: null, hint: 'Remove anything that isn’t a piece, add brands you know, then extract.' };
  }
  if (summary.check > 0) {
    return { lead: reviewSummaryLabel(summary), hint: 'Pieces with a dot are worth a look.' };
  }
  const total = summary.ready + summary.confirmed;
  return {
    lead: reviewSummaryLabel(summary),
    hint: total === 1 ? 'Tap it to edit, or add it as it is.' : 'Tap a piece to edit it, or add them as they are.',
  };
}

/**
 * The next piece still worth a look after `activeId`, wrapping round. Never
 * returns `activeId` itself — confirming the last flagged piece ends the walk.
 */
export function nextFlaggedPieceId(
  pieceIds: readonly string[],
  states: Readonly<Record<string, PieceReviewState>>,
  activeId: string | null,
): string | null {
  if (pieceIds.length === 0) return null;
  const start = activeId ? pieceIds.indexOf(activeId) : -1;
  for (let offset = 1; offset <= pieceIds.length; offset += 1) {
    const candidate = pieceIds[(start + offset + pieceIds.length) % pieceIds.length];
    if (candidate !== activeId && states[candidate] === 'check') return candidate;
  }
  return null;
}

/**
 * Up to three pieces fit one screen as a pager on their own; past that an
 * overview earns its place.
 */
export function usesContactSheet(pieceCount: number): boolean {
  return pieceCount > 3;
}

export function contactSheetColumns(pieceCount: number): 2 | 3 {
  return pieceCount > 6 ? 3 : 2;
}

/**
 * The index under a finger on the scrubber rail. Called from the pan
 * gesture's callbacks on the UI thread, hence the directive.
 */
export function scrubberIndex(x: number, railWidth: number, count: number): number {
  'worklet';
  if (count <= 0 || railWidth <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor((x / railWidth) * count)));
}
