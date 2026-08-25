import type { ShoppingSnap } from '../types/shoppingSnap';
import type { ShoppingSnapOrganizationStage } from './shoppingSnapOrganizer';

export type ShoppingOrganizerStage = ShoppingSnapOrganizationStage;

/**
 * What the current selection can usefully do. The organizer shows a single
 * primary action rather than a pair of half-lit buttons, because from the
 * shopper's side "these three are one thing" and "this one isn't part of that"
 * are the same gesture — pick photos, then say what they are.
 *
 * - `merge`    — the selection spans more than one item, so it becomes one.
 * - `pull-out` — the selection is part of a single item, so it leaves it.
 * - `none`     — nothing selected, or the selection is exactly one whole item,
 *                which would rebuild the partition it already has.
 */
export type ShoppingOrganizerSelectionAction = 'merge' | 'pull-out' | 'none';

export function seedStages(snaps: ShoppingSnap[]): ShoppingOrganizerStage[] {
  const stages: ShoppingOrganizerStage[] = [];
  const byGroup = new Map<string, ShoppingOrganizerStage>();

  for (const snap of snaps) {
    const existing = byGroup.get(snap.captureGroupId);
    if (existing) {
      existing.snapIds.push(snap.id);
      continue;
    }
    const stage = { id: snap.captureGroupId, snapIds: [snap.id] };
    byGroup.set(snap.captureGroupId, stage);
    stages.push(stage);
  }

  return stages;
}

/** Order-insensitive fingerprint of a partition, for change detection. */
export function partitionKey(stages: ShoppingOrganizerStage[]): string {
  return stages
    .map((stage) => [...stage.snapIds].sort().join(','))
    .sort()
    .join('|');
}

function stageIndexesTouching(
  stages: ShoppingOrganizerStage[],
  selectedIds: ReadonlySet<string>,
): number[] {
  return stages.reduce<number[]>((indexes, stage, index) => {
    if (stage.snapIds.some((snapId) => selectedIds.has(snapId))) indexes.push(index);
    return indexes;
  }, []);
}

export function selectionAction(
  stages: ShoppingOrganizerStage[],
  selectedIds: ReadonlySet<string>,
): ShoppingOrganizerSelectionAction {
  if (selectedIds.size === 0) return 'none';
  const touched = stageIndexesTouching(stages, selectedIds);
  if (touched.length === 0) return 'none';
  if (touched.length > 1) return 'merge';
  // Everything selected lives in one item: only worth doing if something in
  // that item is staying behind.
  const stage = stages[touched[0]];
  return stage.snapIds.every((snapId) => selectedIds.has(snapId)) ? 'none' : 'pull-out';
}

function withoutEmpty(stages: ShoppingOrganizerStage[]): ShoppingOrganizerStage[] {
  return stages.filter((stage) => stage.snapIds.length > 0);
}

/**
 * The selected photos leave whichever items they were in and become one.
 *
 * Merging across items lands the new item where the earliest contributing item
 * was; pulling a subset out of one item lands it directly beneath the remnant.
 * Either way the list does not reshuffle under the user's finger, and the
 * photos they just acted on stay on screen.
 */
export function applySelection(
  stages: ShoppingOrganizerStage[],
  selectedIds: ReadonlySet<string>,
  createStageId: () => string,
): ShoppingOrganizerStage[] {
  if (selectionAction(stages, selectedIds) === 'none') return stages;

  const touched = stageIndexesTouching(stages, selectedIds);
  const ordered = stages.flatMap((stage) => stage.snapIds.filter((snapId) => selectedIds.has(snapId)));
  const moved: ShoppingOrganizerStage = { id: createStageId(), snapIds: ordered };

  const remaining = withoutEmpty(stages.map((stage) => ({
    ...stage,
    snapIds: stage.snapIds.filter((snapId) => !selectedIds.has(snapId)),
  })));

  const anchorStageId = stages[touched[0]].id;
  const anchorIndex = remaining.findIndex((stage) => stage.id === anchorStageId);
  // Sit under the first item the selection came out of, so every item that
  // survived keeps its place in the list and only the new one appears. When
  // that item was consumed whole, take the slot it vacated instead.
  const insertAt = anchorIndex >= 0 ? anchorIndex + 1 : Math.min(touched[0], remaining.length);

  return [...remaining.slice(0, insertAt), moved, ...remaining.slice(insertAt)];
}

/** Every photo in the item becomes an item of its own. */
export function splitStage(
  stages: ShoppingOrganizerStage[],
  stageId: string,
  createStageId: () => string,
): ShoppingOrganizerStage[] {
  return stages.flatMap((stage) => (stage.id === stageId && stage.snapIds.length > 1
    ? stage.snapIds.map((snapId, index) => ({
      // The first fragment keeps the stage id so the item that stays on screen
      // keeps its identity — and, downstream, its catalog row.
      id: index === 0 ? stage.id : createStageId(),
      snapIds: [snapId],
    }))
    : [stage]));
}

/**
 * Drop one photo into another item — or, with a null target, into a brand new
 * item placed right after the one it left. Dropping a photo back where it
 * already is changes nothing.
 */
export function moveSnapToStage(
  stages: ShoppingOrganizerStage[],
  snapId: string,
  targetStageId: string | null,
  createStageId: () => string,
): ShoppingOrganizerStage[] {
  const sourceIndex = stages.findIndex((stage) => stage.snapIds.includes(snapId));
  if (sourceIndex < 0) return stages;
  const source = stages[sourceIndex];
  if (targetStageId === source.id) return stages;
  if (targetStageId === null && source.snapIds.length === 1) return stages;
  if (targetStageId !== null && !stages.some((stage) => stage.id === targetStageId)) return stages;

  const stripped = stages.map((stage) => (stage.snapIds.includes(snapId)
    ? { ...stage, snapIds: stage.snapIds.filter((id) => id !== snapId) }
    : stage));

  if (targetStageId !== null) {
    return withoutEmpty(stripped.map((stage) => (stage.id === targetStageId
      ? { ...stage, snapIds: [...stage.snapIds, snapId] }
      : stage)));
  }

  const remaining = withoutEmpty(stripped);
  const insertAt = remaining.findIndex((stage) => stage.id === source.id) + 1;
  const created: ShoppingOrganizerStage = { id: createStageId(), snapIds: [snapId] };
  return [...remaining.slice(0, insertAt), created, ...remaining.slice(insertAt)];
}
