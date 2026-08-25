import type { ShoppingCaptureRole, ShoppingSnap } from '../types/shoppingSnap';

export type ShoppingSnapOrganizationStage = {
  id: string;
  snapIds: string[];
};

export type ShoppingSnapOrganizationUpdate = {
  snapId: string;
  captureGroupId: string;
  captureGroupStartedAt: number;
  captureRole: ShoppingCaptureRole;
  captureSequence: number;
};

type BuildShoppingSnapOrganizationOptions = {
  /**
   * Capture group ids the caller is willing to see survive — normally every
   * group represented in `snaps`. A stage that keeps an existing id also keeps
   * that group's `shopping_capture_groups` row, so its price, notes, category
   * and favourite state stay attached. Reorganising a whole visit therefore
   * has to offer every group here, not just one: minting fresh ids for eight
   * untouched items to merge two would silently strip all eight of their
   * catalog details.
   */
  reusableCaptureGroupIds: string[];
  createGroupId: () => string;
};

/**
 * The group a stage has the strongest claim to: whichever id most of its snaps
 * already belong to. Ties break towards the group seen first, so the result
 * does not depend on map iteration order.
 */
function preferredGroupIds(stageSnaps: ShoppingSnap[]): string[] {
  const counts = new Map<string, { count: number; firstSeen: number }>();

  stageSnaps.forEach((snap, index) => {
    const existing = counts.get(snap.captureGroupId);
    if (existing) existing.count += 1;
    else counts.set(snap.captureGroupId, { count: 1, firstSeen: index });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].firstSeen - b[1].firstSeen)
    .map(([groupId]) => groupId);
}

export function buildShoppingSnapOrganizationUpdates(
  snaps: ShoppingSnap[],
  stages: ShoppingSnapOrganizationStage[],
  rolesBySnapId: Record<string, ShoppingCaptureRole>,
  options: BuildShoppingSnapOrganizationOptions,
): ShoppingSnapOrganizationUpdate[] {
  const snapById = new Map(snaps.map((snap) => [snap.id, snap]));
  const seen = new Set<string>();
  const normalizedStages = stages
    .map((stage) => ({
      ...stage,
      snapIds: stage.snapIds.filter((snapId) => {
        if (!snapById.has(snapId) || seen.has(snapId)) return false;
        seen.add(snapId);
        return true;
      }),
    }))
    .filter((stage) => stage.snapIds.length > 0);

  if (normalizedStages.length === 0) return [];

  const stageSnaps = normalizedStages.map((stage) => stage.snapIds
    .map((snapId) => snapById.get(snapId))
    .filter((snap): snap is ShoppingSnap => Boolean(snap)));

  // Largest stages claim first, so when a group is split the biggest remnant
  // inherits the group's identity — and its catalog row — rather than whichever
  // fragment happens to be listed first.
  const claimOrder = normalizedStages
    .map((stage, index) => ({ index, size: stage.snapIds.length }))
    .sort((a, b) => b.size - a.size || a.index - b.index)
    .map((entry) => entry.index);

  const available = new Set(options.reusableCaptureGroupIds);
  const groupIds: string[] = new Array(normalizedStages.length);

  for (const stageIndex of claimOrder) {
    const claimed = preferredGroupIds(stageSnaps[stageIndex]).find((groupId) => available.has(groupId));
    if (claimed) available.delete(claimed);
    groupIds[stageIndex] = claimed ?? options.createGroupId();
  }

  // `stageSnaps` preserves the caller's snapIds order (rather than re-deriving
  // it from capture time) so a user's manual drag reorder in the organizer
  // sticks.
  return normalizedStages.flatMap((_stage, stageIndex) => {
    const snaps = stageSnaps[stageIndex];
    const groupStartedAt = Math.min(
      ...snaps.map((snap) => new Date(snap.capturedAt).getTime()),
    );

    return snaps.map((snap, index) => ({
      snapId: snap.id,
      captureGroupId: groupIds[stageIndex],
      captureGroupStartedAt: Number.isFinite(groupStartedAt)
        ? groupStartedAt
        : new Date(snap.capturedAt).getTime(),
      captureRole: rolesBySnapId[snap.id] ?? snap.captureRole,
      captureSequence: index + 1,
    }));
  });
}
