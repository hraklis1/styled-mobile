import { useCallback, useMemo } from 'react';
import * as Crypto from 'expo-crypto';

import {
  buildRegroupUpdates,
  findPreviousCapture,
  shouldAutoAttachTag,
  type CaptureGroupingCandidate,
} from '../lib/shoppingCaptureGrouping';
import { useShoppingSessionStore, type ShoppingVisitPreview } from '../stores/useShoppingSessionStore';
import { useShoppingItemActions } from './useShoppingItemActions';

function toCandidate(preview: ShoppingVisitPreview): CaptureGroupingCandidate {
  return {
    id: preview.id,
    shoppingSessionId: preview.shoppingSessionId,
    captureGroupId: preview.captureGroupId,
    captureRole: preview.captureRole,
    captureSequence: preview.captureSequence,
    timestamp: preview.timestamp,
  };
}

function currentCandidates(sessionId: string | null): CaptureGroupingCandidate[] {
  return useShoppingSessionStore.getState().visitPreviews
    .filter((preview) => preview.shoppingSessionId === sessionId)
    .map(toCandidate);
}

/**
 * Merging and splitting captures while the visit is still open.
 *
 * Every regroup is applied locally first so the rail restacks on the same
 * frame, then persisted through `saveOrganization`, which already knows how to
 * route each capture by sync status. Callbacks read the store imperatively
 * rather than closing over rendered state: auto-attach fires from the OCR
 * queue, long after the render that scheduled it.
 */
export function useShoppingCaptureGrouping(sessionId: string | null) {
  const applyCaptureRegroup = useShoppingSessionStore((state) => state.applyCaptureRegroup);
  const allVisitPreviews = useShoppingSessionStore((state) => state.visitPreviews);
  const { saveOrganization } = useShoppingItemActions();

  const regroup = useCallback((captureId: string, targetGroupId: string): boolean => {
    const updates = buildRegroupUpdates(currentCandidates(sessionId), captureId, targetGroupId);
    if (updates.length === 0) return false;

    applyCaptureRegroup(updates);
    void saveOrganization(updates).catch((error: unknown) => {
      // The local regroup stands; the sync manager re-sends group membership
      // with the upload, so a failure here costs a retry, not the grouping.
      console.warn('Shopping capture regroup did not persist', error);
    });
    return true;
  }, [applyCaptureRegroup, saveOrganization, sessionId]);

  /**
   * Called once OCR has classified a capture. A price tag shot moments after a
   * garment joins that garment automatically — the single biggest reason a
   * visit arrives at review already sorted.
   */
  const autoAttachTag = useCallback((captureId: string): boolean => {
    const candidates = currentCandidates(sessionId);
    const capture = candidates.find((candidate) => candidate.id === captureId);
    const previous = findPreviousCapture(candidates, captureId);
    if (!capture || !previous || !shouldAutoAttachTag(capture, previous)) return false;
    return regroup(captureId, previous.captureGroupId);
  }, [regroup, sessionId]);

  const sessionPreviews = useMemo(
    () => allVisitPreviews
      .filter((preview) => preview.shoppingSessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp || a.captureSequence - b.captureSequence),
    [allVisitPreviews, sessionId],
  );

  const lastCapture = sessionPreviews[sessionPreviews.length - 1] ?? null;
  const previousCapture = lastCapture
    ? findPreviousCapture(sessionPreviews.map(toCandidate), lastCapture.id)
    : null;

  const canAttachLast = Boolean(
    lastCapture && previousCapture && previousCapture.captureGroupId !== lastCapture.captureGroupId,
  );
  const canDetachLast = Boolean(
    lastCapture && sessionPreviews.filter(
      (preview) => preview.captureGroupId === lastCapture.captureGroupId,
    ).length > 1,
  );

  /** "Same item" — folds the photo just taken into the one before it. */
  const attachLastToPrevious = useCallback((): boolean => {
    if (!lastCapture || !previousCapture) return false;
    return regroup(lastCapture.id, previousCapture.captureGroupId);
  }, [lastCapture, previousCapture, regroup]);

  /** The undo for both "Same item" and an auto-attach that guessed wrong. */
  const detachLast = useCallback((): boolean => {
    if (!lastCapture) return false;
    return regroup(lastCapture.id, Crypto.randomUUID());
  }, [lastCapture, regroup]);

  return {
    autoAttachTag,
    attachLastToPrevious,
    detachLast,
    canAttachLast,
    canDetachLast,
    lastCapture,
  };
}
