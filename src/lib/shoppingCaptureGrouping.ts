import type { ShoppingCaptureRole } from './classifyShoppingCapture';
import type { ShoppingSnapOrganizationUpdate } from './shoppingSnapOrganizer';

/**
 * How long after a garment shot a price tag still reads as "the tag for that
 * garment". Generous enough to cover fumbling with a label in a fitting room,
 * short enough that the next rack is a different item.
 */
export const AUTO_ATTACH_WINDOW_MS = 30 * 1000;

/**
 * The subset of a capture the grouping rules actually need. Both
 * `ShoppingVisitPreview` and `PendingShoppingUpload` structurally satisfy it,
 * so callers can pass either without adapting.
 */
export type CaptureGroupingCandidate = {
  id: string;
  shoppingSessionId: string | null;
  captureGroupId: string;
  captureRole: ShoppingCaptureRole;
  captureSequence: number;
  timestamp: number;
};

function captureOrder(a: CaptureGroupingCandidate, b: CaptureGroupingCandidate): number {
  return a.timestamp - b.timestamp || a.captureSequence - b.captureSequence;
}

/**
 * The capture taken immediately before `captureId` within the same shopping
 * session. Session scoping matters: imports carrying their own EXIF session
 * must never attach to whatever the live camera shot last.
 */
export function findPreviousCapture(
  captures: CaptureGroupingCandidate[],
  captureId: string,
): CaptureGroupingCandidate | null {
  const capture = captures.find((candidate) => candidate.id === captureId);
  if (!capture) return null;

  const earlier = captures
    .filter((candidate) => candidate.id !== captureId
      && candidate.shoppingSessionId === capture.shoppingSessionId
      && captureOrder(candidate, capture) < 0)
    .sort(captureOrder);

  return earlier[earlier.length - 1] ?? null;
}

/**
 * A price tag photographed right after a garment belongs to that garment
 * essentially always, so the capture flow attaches it without asking.
 *
 * This deliberately lets an OCR heuristic decide group membership, which
 * `classifyShoppingCapture` was originally written to stay out of. That
 * restraint was correct while a wrong group was unfixable; now that a bad
 * attach is one tap to undo in the rail — and visible again in the visit
 * review screen — a good guess beats no guess.
 */
export function shouldAutoAttachTag(
  capture: CaptureGroupingCandidate,
  previous: CaptureGroupingCandidate | null,
): boolean {
  if (!previous) return false;
  if (capture.captureRole !== 'tag') return false;
  if (previous.captureRole !== 'garment') return false;
  if (previous.captureGroupId === capture.captureGroupId) return false;
  if (previous.shoppingSessionId !== capture.shoppingSessionId) return false;
  return capture.timestamp - previous.timestamp <= AUTO_ATTACH_WINDOW_MS;
}

/**
 * Moves one capture onto `targetGroupId` and renumbers every group the move
 * touched, so `captureSequence` stays a dense 1..n run per group and each
 * group's start time still reflects its earliest photo.
 *
 * Emitting `ShoppingSnapOrganizationUpdate[]` means the in-camera attach/detach
 * and the review screen's regrouping speak one language, and both persist
 * through the same `saveOrganization` path.
 */
export function buildRegroupUpdates(
  captures: CaptureGroupingCandidate[],
  captureId: string,
  targetGroupId: string,
): ShoppingSnapOrganizationUpdate[] {
  const capture = captures.find((candidate) => candidate.id === captureId);
  if (!capture || capture.captureGroupId === targetGroupId) return [];

  const sourceGroupId = capture.captureGroupId;
  const moved = captures.map((candidate) => (candidate.id === captureId
    ? { ...candidate, captureGroupId: targetGroupId }
    : candidate));

  return [targetGroupId, sourceGroupId].flatMap((groupId) => {
    const members = moved
      .filter((candidate) => candidate.captureGroupId === groupId)
      .sort(captureOrder);
    if (members.length === 0) return [];

    const groupStartedAt = members[0].timestamp;
    return members.map((member, index) => ({
      snapId: member.id,
      captureGroupId: groupId,
      captureGroupStartedAt: groupStartedAt,
      captureRole: member.captureRole,
      captureSequence: index + 1,
    }));
  });
}
