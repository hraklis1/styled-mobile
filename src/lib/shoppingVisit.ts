import type { ShoppingSessionContext } from '../stores/useShoppingSessionStore';

export const SHOPPING_VISIT_RESUME_PROMPT_MS = 15 * 60 * 1000;
export const SHOPPING_VISIT_EXPIRY_MS = 4 * 60 * 60 * 1000;

export type ShoppingVisitResumeDecision = 'resume' | 'prompt' | 'expire' | 'none';

export function shoppingVisitHasContent(
  visit: ShoppingSessionContext,
  captureCount: number,
): boolean {
  return captureCount > 0 || Boolean(visit.storeName);
}

/**
 * Resume eligibility is deliberately based on persisted timestamps instead of
 * an in-memory timer. This makes backgrounding, force-quits, and stale prompts
 * converge on the same answer when the camera becomes active again.
 */
export function evaluateShoppingVisitResume(
  visit: ShoppingSessionContext | null,
  captureCount: number,
  now = Date.now(),
): ShoppingVisitResumeDecision {
  if (!visit || visit.lifecycleStatus !== 'paused') return 'none';
  if (!shoppingVisitHasContent(visit, captureCount)) return 'expire';

  const pausedAt = visit.pausedAt ?? visit.lastActivityAt;
  const elapsed = Math.max(0, now - pausedAt);
  if (elapsed >= SHOPPING_VISIT_EXPIRY_MS) return 'expire';
  if (elapsed >= SHOPPING_VISIT_RESUME_PROMPT_MS) return 'prompt';
  return 'resume';
}

export function isShoppingVisitExpired(
  visit: ShoppingSessionContext | null,
  now = Date.now(),
): boolean {
  if (!visit || visit.lifecycleStatus === 'ended') return false;
  const reference = visit.pausedAt ?? visit.lastActivityAt;
  return now - reference >= SHOPPING_VISIT_EXPIRY_MS;
}
