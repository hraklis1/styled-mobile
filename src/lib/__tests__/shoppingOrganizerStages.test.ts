import {
  applySelection,
  moveSnapToStage,
  partitionKey,
  seedStages,
  selectionAction,
  splitStage,
  type ShoppingOrganizerStage,
} from '../shoppingOrganizerStages';
import type { ShoppingSnap } from '../../types/shoppingSnap';

const start = Date.parse('2026-08-24T14:00:00.000Z');

function snap(id: string, captureGroupId: string): ShoppingSnap {
  return {
    id,
    imageUri: `file:///${id}.jpg`,
    storagePath: null,
    storeName: 'Aritzia',
    storeLocationId: null,
    shoppingSessionId: 'visit-1',
    captureGroupId,
    captureRole: 'garment',
    captureSequence: 1,
    branchLabel: null,
    latitude: null,
    longitude: null,
    locationAccuracyMeters: null,
    locality: null,
    region: null,
    countryCode: null,
    locationHint: null,
    locationSource: null,
    extractedPrice: null,
    rawOcrText: '',
    capturedAt: new Date(start).toISOString(),
    syncStatus: 'pending',
    category: null,
    sizeLabel: null,
    colorLabel: null,
    materialLabel: null,
    notes: null,
    isFavorite: false,
    catalogStatus: 'considering',
  };
}

let minted = 0;
const createStageId = () => {
  minted += 1;
  return `new-${minted}`;
};

beforeEach(() => {
  minted = 0;
});

const stages: ShoppingOrganizerStage[] = [
  { id: 'group-a', snapIds: ['a1', 'a2', 'a3'] },
  { id: 'group-b', snapIds: ['b1'] },
  { id: 'group-c', snapIds: ['c1', 'c2'] },
];

describe('seedStages', () => {
  it('partitions snaps by capture group, keeping first-seen order', () => {
    expect(seedStages([snap('a1', 'g-a'), snap('b1', 'g-b'), snap('a2', 'g-a')])).toEqual([
      { id: 'g-a', snapIds: ['a1', 'a2'] },
      { id: 'g-b', snapIds: ['b1'] },
    ]);
  });
});

describe('selectionAction', () => {
  it('is none for an empty selection, an unknown id, or one whole item', () => {
    expect(selectionAction(stages, new Set())).toBe('none');
    expect(selectionAction(stages, new Set(['ghost']))).toBe('none');
    expect(selectionAction(stages, new Set(['b1']))).toBe('none');
    expect(selectionAction(stages, new Set(['c1', 'c2']))).toBe('none');
  });

  it('is pull-out for part of one item, even a single photo', () => {
    expect(selectionAction(stages, new Set(['a2']))).toBe('pull-out');
    expect(selectionAction(stages, new Set(['a1', 'a2']))).toBe('pull-out');
  });

  it('is merge as soon as the selection spans two items', () => {
    expect(selectionAction(stages, new Set(['a1', 'b1']))).toBe('merge');
    expect(selectionAction(stages, new Set(['c1', 'c2', 'b1']))).toBe('merge');
  });
});

describe('applySelection', () => {
  it('pulls a subset out and parks it directly under the item it left', () => {
    expect(applySelection(stages, new Set(['a1', 'a3']), createStageId)).toEqual([
      { id: 'group-a', snapIds: ['a2'] },
      { id: 'new-1', snapIds: ['a1', 'a3'] },
      { id: 'group-b', snapIds: ['b1'] },
      { id: 'group-c', snapIds: ['c1', 'c2'] },
    ]);
  });

  it('merges across items into the position of the earliest one', () => {
    expect(applySelection(stages, new Set(['a3', 'c1']), createStageId)).toEqual([
      { id: 'group-a', snapIds: ['a1', 'a2'] },
      { id: 'new-1', snapIds: ['a3', 'c1'] },
      { id: 'group-b', snapIds: ['b1'] },
      { id: 'group-c', snapIds: ['c2'] },
    ]);
  });

  it('takes the anchor slot when the merge consumes the item it started in', () => {
    expect(applySelection(stages, new Set(['b1', 'c1']), createStageId)).toEqual([
      { id: 'group-a', snapIds: ['a1', 'a2', 'a3'] },
      { id: 'new-1', snapIds: ['b1', 'c1'] },
      { id: 'group-c', snapIds: ['c2'] },
    ]);
  });

  it('keeps the selection in list order, not tap order', () => {
    const merged = applySelection(stages, new Set(['c2', 'a1']), createStageId);
    expect(merged.find((stage) => stage.id === 'new-1')?.snapIds).toEqual(['a1', 'c2']);
  });

  it('leaves the partition alone when the action would be a no-op', () => {
    expect(applySelection(stages, new Set(['c1', 'c2']), createStageId)).toBe(stages);
    expect(minted).toBe(0);
  });
});

describe('splitStage', () => {
  it('breaks an item into one item per photo, the first keeping the id', () => {
    expect(splitStage(stages, 'group-a', createStageId)).toEqual([
      { id: 'group-a', snapIds: ['a1'] },
      { id: 'new-1', snapIds: ['a2'] },
      { id: 'new-2', snapIds: ['a3'] },
      { id: 'group-b', snapIds: ['b1'] },
      { id: 'group-c', snapIds: ['c1', 'c2'] },
    ]);
  });

  it('does nothing to a single-photo item or an unknown one', () => {
    expect(splitStage(stages, 'group-b', createStageId)).toEqual(stages);
    expect(splitStage(stages, 'ghost', createStageId)).toEqual(stages);
  });
});

describe('moveSnapToStage', () => {
  it('appends a dragged photo to the item it was dropped on', () => {
    expect(moveSnapToStage(stages, 'a1', 'group-c', createStageId)).toEqual([
      { id: 'group-a', snapIds: ['a2', 'a3'] },
      { id: 'group-b', snapIds: ['b1'] },
      { id: 'group-c', snapIds: ['c1', 'c2', 'a1'] },
    ]);
  });

  it('drops the source item once its last photo is dragged away', () => {
    expect(moveSnapToStage(stages, 'b1', 'group-a', createStageId)).toEqual([
      { id: 'group-a', snapIds: ['a1', 'a2', 'a3', 'b1'] },
      { id: 'group-c', snapIds: ['c1', 'c2'] },
    ]);
  });

  it('spins a photo into a new item placed right after the one it left', () => {
    expect(moveSnapToStage(stages, 'a2', null, createStageId)).toEqual([
      { id: 'group-a', snapIds: ['a1', 'a3'] },
      { id: 'new-1', snapIds: ['a2'] },
      { id: 'group-b', snapIds: ['b1'] },
      { id: 'group-c', snapIds: ['c1', 'c2'] },
    ]);
  });

  it('ignores drops that would change nothing', () => {
    expect(moveSnapToStage(stages, 'a1', 'group-a', createStageId)).toBe(stages);
    expect(moveSnapToStage(stages, 'b1', null, createStageId)).toBe(stages);
    expect(moveSnapToStage(stages, 'ghost', 'group-a', createStageId)).toBe(stages);
    expect(moveSnapToStage(stages, 'a1', 'ghost', createStageId)).toBe(stages);
    expect(minted).toBe(0);
  });
});

describe('partitionKey', () => {
  it('ignores item order and photo order within an item', () => {
    expect(partitionKey([{ id: 'x', snapIds: ['b', 'a'] }, { id: 'y', snapIds: ['c'] }]))
      .toBe(partitionKey([{ id: 'y', snapIds: ['c'] }, { id: 'x', snapIds: ['a', 'b'] }]));
  });

  it('changes when a photo moves between items', () => {
    expect(partitionKey(stages)).not.toBe(partitionKey(moveSnapToStage(stages, 'a1', 'group-b', createStageId)));
  });
});
