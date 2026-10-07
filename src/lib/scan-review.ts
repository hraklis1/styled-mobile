import { containedShare, iou, type Box } from './cropGeometry';
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
  // One piece at a time: the gap is at least the side padding, so the
  // neighbour waits fully off-screen instead of showing as a grey sliver.
  const sidePadding = 24;
  const gap = 32;
  const cardWidth = Math.max(240, viewportWidth - sidePadding * 2);
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
    return { lead: null, hint: 'Uncheck pieces you don’t want. Tap a photo to inspect or add a brand.' };
  }
  if (summary.check > 0) {
    return { lead: reviewSummaryLabel(summary), hint: 'Pieces marked “Check details” are worth a look.' };
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

/**
 * Whole-outfit detections ("Brown Outfit Set") that only frame a top and a
 * bottom found on their own. The server drops these; this catches older or
 * cached scans, which then start unticked rather than vanish. A dress never
 * has its own top and bottom inside it, so it is never caught.
 */
export function compositePieceIds(pieces: readonly { id: string; category: string | null; bbox: Box | null }[]): Set<string> {
  const ids = new Set<string>();
  for (const piece of pieces) {
    if (piece.category !== 'full_body' || !piece.bbox) continue;
    const inside = pieces.filter(other => other !== piece && other.bbox && containedShare(other.bbox, piece.bbox!) >= 0.8);
    if (inside.some(p => p.category === 'top' || p.category === 'outerwear') && inside.some(p => p.category === 'bottom')) ids.add(piece.id);
  }
  return ids;
}

export type OverlapFlag = { of: string; strong: boolean };

/**
 * Detections that frame the same garment as an earlier one in the same
 * category. The server already merges boxes at IoU ≥ 0.6, so what reaches
 * here is the near-miss tail: a strong overlap (one box mostly inside the
 * other, or IoU ≥ 0.5) is almost surely a repeat and starts unticked; a
 * moderate one (IoU ≥ 0.3) only earns a quiet note. The earlier piece always
 * stays — detection order puts the more confident box first.
 */
export function overlapDuplicates(pieces: readonly { id: string; category: string | null; bbox: Box | null }[]): Map<string, OverlapFlag> {
  const flags = new Map<string, OverlapFlag>();
  pieces.forEach((piece, index) => {
    // An unknown category can't vouch for "same garment".
    if (!piece.bbox || !piece.category) return;
    for (const earlier of pieces.slice(0, index)) {
      if (!earlier.bbox || earlier.category !== piece.category || flags.has(earlier.id)) continue;
      const overlap = iou(piece.bbox, earlier.bbox);
      const contained = Math.max(containedShare(piece.bbox, earlier.bbox), containedShare(earlier.bbox, piece.bbox));
      if (contained >= 0.85 || overlap >= 0.5) { flags.set(piece.id, { of: earlier.id, strong: true }); return; }
      if (overlap >= 0.3 && !flags.has(piece.id)) flags.set(piece.id, { of: earlier.id, strong: false });
    }
  });
  return flags;
}

/**
 * Included pieces that repeat an earlier one: same category and the same
 * name. The first stays; each repeat is flagged as a possible duplicate.
 */
export function duplicatePieceIds(pieces: readonly { id: string; name: string; category: string | null; included?: boolean }[]): Set<string> {
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const piece of pieces) {
    if (piece.included === false) continue;
    const key = `${piece.category ?? ''}|${piece.name.trim().toLocaleLowerCase()}`;
    if (!piece.name.trim()) continue;
    if (seen.has(key)) ids.add(piece.id);
    else seen.add(key);
  }
  return ids;
}

/**
 * Trial: skip "Choose pieces" and extract every kept detection straight
 * away, so a scan has one review instead of two. Costs extraction on pieces
 * the user might have dropped, and a crop changed afterwards re-extracts.
 * Off unless EXPO_PUBLIC_SINGLE_PASS_SCAN=1.
 */
export const SINGLE_PASS_SCAN = process.env.EXPO_PUBLIC_SINGLE_PASS_SCAN === '1';

/** Included pieces other than `exceptId` that still carry no brand. */
export function piecesMissingBrand<T extends { id: string; brand: string; included?: boolean }>(pieces: readonly T[], exceptId: string): T[] {
  return pieces.filter(piece => piece.id !== exceptId && piece.included !== false && !piece.brand.trim());
}

/** The singular noun for a category, naming a piece the user adds by hand. */
export const PIECE_NOUN: Record<string, string> = {
  top: 'Top',
  bottom: 'Bottoms',
  full_body: 'Dress',
  shoes: 'Shoes',
  outerwear: 'Jacket',
  accessory: 'Accessory',
  valuables: 'Valuable',
};

/** The review blurb: how many pieces were found, and what a tap does. */
export function reviewBlurb(count: number): string {
  if (count === 0) return 'I couldn’t pick out any pieces in this look. Add one below.';
  return `I found ${count === 1 ? '1 piece' : `${count} pieces`} in this look. Tap a piece to make adjustments.`;
}

/** The stylist line once details are read: how many, and how many deserve a look. */
export function readyBlurb(count: number, check: number): string {
  const pieces = count === 1 ? '1 piece' : `${count} pieces`;
  if (check === 0) return `I read the details on ${pieces}. Tap one to fine-tune, or add them as they are.`;
  return `I read the details on ${pieces}. ${check === 1 ? '1 is' : `${check} are`} worth a quick look.`;
}
