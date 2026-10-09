import type { Profile, ProfilePromptKey, ProfilePrompts } from '../../types/profile';
import { normalizeBodyType, normalizeBudgetRange, normalizeStyleProfileDetails, uniqueClean } from '../../lib/profileOptions';

/**
 * Rules for the deferred profile questions (docs/onboarding-redesign.md §4).
 * Pure, so the "when do we ask" policy is testable without a sheet on screen.
 */

export const PROMPT_KEYS: ProfilePromptKey[] = ['budget', 'sizes', 'fit', 'avoids', 'retailers'];

/** A dismissal backs off this long before the question may come back. */
export const DISMISS_BACKOFF_MS = 14 * 24 * 60 * 60 * 1000;
/** After this many dismissals it's only asked from Profile. */
export const MAX_DISMISSALS = 2;

/** Whether the profile already holds an answer, however it got there. */
export function isAnswered(key: ProfilePromptKey, profile: Profile): boolean {
  const details = normalizeStyleProfileDetails(profile.styleProfileDetails);
  switch (key) {
    case 'budget':
      return normalizeBudgetRange(profile.budgetRange).length > 0;
    case 'sizes':
      return !!profile.sizeTop && !!profile.sizeShoe;
    case 'fit':
      return normalizeBodyType(profile.bodyType).length > 0 && !!profile.fitSilhouette;
    case 'avoids':
      return details.styleAvoids.length > 0 || details.avoidedColors.length > 0;
    case 'retailers':
      return uniqueClean(profile.favoriteRetailers).length > 0;
  }
}

/** Questions still open, in the order Profile's "Sharpen your stylist" asks them. */
export function remainingPrompts(profile: Profile): ProfilePromptKey[] {
  return PROMPT_KEYS.filter((key) => !isAnswered(key, profile));
}

/** May this question interrupt the user right now, unprompted? */
export function mayAsk(key: ProfilePromptKey, profile: Profile, now = Date.now()): boolean {
  if (isAnswered(key, profile)) return false;
  const state = (profile.profilePrompts as ProfilePrompts | null | undefined)?.[key];
  if (!state) return true;
  if (state.answeredAt) return false;
  if (state.dismissCount >= MAX_DISMISSALS) return false;
  if (state.dismissedAt && now - Date.parse(state.dismissedAt) < DISMISS_BACKOFF_MS) return false;
  return true;
}

/** Completeness for the Profile ring: answered / total. */
export function promptCompleteness(profile: Profile): number {
  return (PROMPT_KEYS.length - remainingPrompts(profile).length) / PROMPT_KEYS.length;
}
