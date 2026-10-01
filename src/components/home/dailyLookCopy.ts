import type { DailyLookCandidate, DailyLookMissingEssential } from '../../hooks/useDailyLook';
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

const CATEGORY_RANK: Record<string, number> = {
  outerwear: 0, dress: 1, top: 2, bottom: 3, shoes: 4, bag: 5, accessory: 6, accessories: 6,
};

export function categoryRank(category: string | null | undefined): number {
  return CATEGORY_RANK[(category ?? '').toLowerCase()] ?? 7;
}

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
