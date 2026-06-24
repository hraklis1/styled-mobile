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
  originalCaptureGroupId: string;
  createGroupId: () => string;
};

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

  const reusableStageIndex = normalizedStages.reduce((bestIndex, stage, index) => {
    const best = normalizedStages[bestIndex];
    if (stage.snapIds.length > best.snapIds.length) return index;
    return bestIndex;
  }, 0);

  const groupIds = normalizedStages.map((_, index) => (
    index === reusableStageIndex ? options.originalCaptureGroupId : options.createGroupId()
  ));

  return normalizedStages.flatMap((stage, stageIndex) => {
    const stageSnaps = stage.snapIds
      .map((snapId) => snapById.get(snapId))
      .filter((snap): snap is ShoppingSnap => Boolean(snap))
      .sort((a, b) => (
        a.captureSequence - b.captureSequence
        || new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      ));
    const groupStartedAt = Math.min(
      ...stageSnaps.map((snap) => new Date(snap.capturedAt).getTime()),
    );

    return stageSnaps.map((snap, index) => ({
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
