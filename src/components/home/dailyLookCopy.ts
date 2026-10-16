import type { DailyLookBrief, DailyLookCandidate, DailyLookMissingEssential } from '../../hooks/useDailyLook';
import type { Item } from '../../types/item';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { itemCoverPresentation } from '../../lib/itemImage';

/** Server labels arrive snake_cased ("weatherproof_layer"). */
export function gapLabel(value: string): string {
  return value.replaceAll('_', ' ').trim();
}

export function sentenceCase(value: string): string {
  const lower = gapLabel(value).toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Capitalise the first letter only, keeping proper nouns ("London") intact. */
export function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** "One Piece Away" is a status, not a name; the missing piece makes a better title. */
export function candidateTitle(candidate: DailyLookCandidate, gap: DailyLookMissingEssential | undefined): string {
  if (gap && candidate.name.trim().toLowerCase() === 'one piece away') return sentenceCase(gap.label);
  return candidate.name;
}

/** "for today's rain" style occasion line, lowercased into a phrase. */
export function gapOccasion(gap: DailyLookMissingEssential): string | null {
  const context = gap.context?.trim();
  if (!context) return null;
  return context.charAt(0).toLowerCase() + context.slice(1);
}

export { categoryRank } from '../../lib/outfitOrder';

/**
 * The piece's chosen cover, except that Today's Look never shows a
 * background-removed cutout: it falls back to the user's own photograph,
 * presented whole on a blurred matte.
 */
export function itemPhotoUri(item: Item | undefined, opts?: { thumb?: boolean }): string | undefined {
  if (!item) return undefined;
  const cover = itemCoverPresentation(item, { preferThumb: opts?.thumb });
  if (cover.variant !== 'cutout') return cover.uri;
  if (opts?.thumb && item.thumbUrl) return resolveImageUri(item.thumbUrl);
  return resolveImageUri(item.imageUrl ?? item.polishedUrl);
}

/** The look's pieces: its items, or the owned foundation of an incomplete look. */
export function candidatePieceIds(candidate: DailyLookCandidate): number[] {
  const entries = candidate.itemIds.length ? candidate.itemIds : candidate.foundationItemIds;
  return entries.map((entry) => entry.id);
}

/**
 * The server's brief when it sent one; otherwise the closest equivalent we can
 * derive, so an older backend still renders a coherent caption.
 */
export function resolveCandidateBrief(
  candidate: DailyLookCandidate,
  serverBrief: DailyLookBrief | null | undefined,
  gap: DailyLookMissingEssential | undefined,
): DailyLookBrief {
  if (serverBrief) return serverBrief;
  const hard = candidate.readinessStatus === 'priority';
  return {
    mode: !gap ? 'ready' : hard ? 'hard_gap' : 'soft_gap',
    basis: null,
    headline: candidateTitle(candidate, gap),
    line: candidate.reason || null,
    pieceIds: candidatePieceIds(candidate),
    gap: gap ? { label: sentenceCase(gap.label), category: gap.category, severity: hard ? 'hard' : 'soft' } : null,
  };
}
