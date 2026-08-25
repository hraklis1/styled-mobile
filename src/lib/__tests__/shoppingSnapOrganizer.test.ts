import { buildShoppingSnapOrganizationUpdates } from '../shoppingSnapOrganizer';
import type { ShoppingSnap } from '../../types/shoppingSnap';

const start = Date.parse('2026-08-24T14:00:00.000Z');

function snap(overrides: Partial<ShoppingSnap> = {}): ShoppingSnap {
  return {
    id: 'snap-a',
    imageUri: 'file:///snap-a.jpg',
    storagePath: null,
    storeName: 'Aritzia',
    storeLocationId: null,
    shoppingSessionId: 'visit-1',
    captureGroupId: 'group-a',
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
    ...overrides,
  };
}

const snaps = [
  snap({ id: 's1', capturedAt: new Date(start).toISOString() }),
  snap({ id: 's2', capturedAt: new Date(start + 2_000).toISOString() }),
  snap({ id: 's3', captureRole: 'tag', capturedAt: new Date(start + 4_000).toISOString() }),
];

let minted = 0;
function options(reusableCaptureGroupIds = ['group-a']) {
  minted = 0;
  return {
    reusableCaptureGroupIds,
    createGroupId: () => {
      minted += 1;
      return `minted-${minted}`;
    },
  };
}

describe('buildShoppingSnapOrganizationUpdates', () => {
  it('splits one group into several, reusing the original id for the largest stage', () => {
    const updates = buildShoppingSnapOrganizationUpdates(
      snaps,
      [{ id: 'stage-1', snapIds: ['s1', 's2'] }, { id: 'stage-2', snapIds: ['s3'] }],
      {},
      options(),
    );

    expect(updates.filter((update) => update.captureGroupId === 'group-a').map((u) => u.snapId))
      .toEqual(['s1', 's2']);
    expect(updates.filter((update) => update.captureGroupId === 'minted-1').map((u) => u.snapId))
      .toEqual(['s3']);
  });

  it('numbers each stage from one and stamps the stage its earliest capture time', () => {
    const updates = buildShoppingSnapOrganizationUpdates(
      snaps,
      [{ id: 'stage-1', snapIds: ['s2', 's3'] }, { id: 'stage-2', snapIds: ['s1'] }],
      {},
      options(),
    );

    const first = updates.filter((update) => update.captureGroupId === 'group-a');
    expect(first.map((update) => update.captureSequence)).toEqual([1, 2]);
    expect(first.every((update) => update.captureGroupStartedAt === start + 2_000)).toBe(true);

    const second = updates.filter((update) => update.captureGroupId === 'minted-1');
    expect(second[0].captureGroupStartedAt).toBe(start);
  });

  it('keeps the caller ordering rather than re-deriving it from capture time', () => {
    const updates = buildShoppingSnapOrganizationUpdates(
      snaps,
      [{ id: 'stage-1', snapIds: ['s3', 's1', 's2'] }],
      {},
      options(),
    );

    expect(updates.map((update) => update.snapId)).toEqual(['s3', 's1', 's2']);
    expect(updates.map((update) => update.captureSequence)).toEqual([1, 2, 3]);
  });

  it('applies staged role overrides and falls back to the snap role', () => {
    const updates = buildShoppingSnapOrganizationUpdates(
      snaps,
      [{ id: 'stage-1', snapIds: ['s1', 's3'] }],
      { s1: 'tag' },
      options(),
    );

    expect(updates.find((update) => update.snapId === 's1')?.captureRole).toBe('tag');
    expect(updates.find((update) => update.snapId === 's3')?.captureRole).toBe('tag');
  });

  it('drops unknown ids and keeps only the first mention of a duplicate', () => {
    const updates = buildShoppingSnapOrganizationUpdates(
      snaps,
      [
        { id: 'stage-1', snapIds: ['s1', 'ghost'] },
        { id: 'stage-2', snapIds: ['s1', 's2'] },
      ],
      {},
      options(),
    );

    expect(updates.filter((update) => update.snapId === 's1')).toHaveLength(1);
    expect(updates.some((update) => update.snapId === 'ghost')).toBe(false);
    expect(updates.filter((update) => update.captureGroupId === 'minted-1').map((u) => u.snapId))
      .toEqual(['s2']);
  });

  it('returns nothing when no stage holds a known snap', () => {
    expect(buildShoppingSnapOrganizationUpdates(snaps, [], {}, options())).toEqual([]);
    expect(buildShoppingSnapOrganizationUpdates(
      snaps,
      [{ id: 'stage-1', snapIds: ['ghost'] }],
      {},
      options(),
    )).toEqual([]);
  });

  describe('across several existing groups', () => {
    const multi = [
      snap({ id: 'a1', captureGroupId: 'group-a', capturedAt: new Date(start).toISOString() }),
      snap({ id: 'a2', captureGroupId: 'group-a', capturedAt: new Date(start + 1_000).toISOString() }),
      snap({ id: 'b1', captureGroupId: 'group-b', capturedAt: new Date(start + 2_000).toISOString() }),
      snap({ id: 'c1', captureGroupId: 'group-c', capturedAt: new Date(start + 3_000).toISOString() }),
    ];
    const reusable = ['group-a', 'group-b', 'group-c'];

    it('leaves untouched groups on their original id, so their catalog rows stay attached', () => {
      const updates = buildShoppingSnapOrganizationUpdates(
        multi,
        [
          { id: 'stage-1', snapIds: ['a1', 'a2'] },
          { id: 'stage-2', snapIds: ['b1'] },
          { id: 'stage-3', snapIds: ['c1'] },
        ],
        {},
        options(reusable),
      );

      expect(updates.find((update) => update.snapId === 'a1')?.captureGroupId).toBe('group-a');
      expect(updates.find((update) => update.snapId === 'b1')?.captureGroupId).toBe('group-b');
      expect(updates.find((update) => update.snapId === 'c1')?.captureGroupId).toBe('group-c');
      expect(minted).toBe(0);
    });

    it('merges two groups onto the id the majority of the merged snaps already had', () => {
      const updates = buildShoppingSnapOrganizationUpdates(
        multi,
        [
          { id: 'stage-1', snapIds: ['a1', 'a2', 'b1'] },
          { id: 'stage-2', snapIds: ['c1'] },
        ],
        {},
        options(reusable),
      );

      const merged = updates.filter((update) => update.snapId !== 'c1');
      expect(merged.every((update) => update.captureGroupId === 'group-a')).toBe(true);
      expect(merged.map((update) => update.captureSequence)).toEqual([1, 2, 3]);
      expect(updates.find((update) => update.snapId === 'c1')?.captureGroupId).toBe('group-c');
      expect(minted).toBe(0);
    });

    it('gives the contested id to the stage holding more of it', () => {
      const updates = buildShoppingSnapOrganizationUpdates(
        multi,
        [
          { id: 'stage-1', snapIds: ['a1'] },
          { id: 'stage-2', snapIds: ['a2', 'b1'] },
        ],
        {},
        options(reusable),
      );

      expect(updates.find((update) => update.snapId === 'a2')?.captureGroupId).toBe('group-a');
      expect(updates.find((update) => update.snapId === 'a1')?.captureGroupId).toBe('minted-1');
    });

    it('mints an id only when every group a stage could claim is taken', () => {
      const updates = buildShoppingSnapOrganizationUpdates(
        multi,
        [
          { id: 'stage-1', snapIds: ['a1', 'a2'] },
          { id: 'stage-2', snapIds: ['b1', 'c1'] },
        ],
        {},
        options(['group-a']),
      );

      expect(updates.find((update) => update.snapId === 'a1')?.captureGroupId).toBe('group-a');
      expect(updates.find((update) => update.snapId === 'b1')?.captureGroupId).toBe('minted-1');
      expect(minted).toBe(1);
    });
  });
});
