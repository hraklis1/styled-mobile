import {
  buildShoppingEditItems,
  filterShoppingEditItems,
  filterShoppingSnaps,
  mergeShoppingSnaps,
  summarizeShoppingEditItems,
} from '../shoppingGallery';
import {
  buildShoppingReviewReasonOptions,
  itemRoleSummary,
  shoppingCatalogChips,
  shoppingCatalogStatusLabel,
  shoppingItemBadges,
} from '../shoppingPresentation';
import { buildShoppingSnapOrganizationUpdates } from '../shoppingSnapOrganizer';
import type { ShoppingSnap } from '../../types/shoppingSnap';

const synced: ShoppingSnap = {
  id: 'synced', imageUri: 'https://example.com/synced.jpg', storagePath: 'user/synced.jpg', storeName: 'Aritzia',
  storeLocationId: null, shoppingSessionId: null, branchLabel: null,
  captureGroupId: 'group-synced', captureRole: 'garment', captureSequence: 1,
  latitude: null, longitude: null, extractedPrice: 120, rawOcrText: '$120.00',
  locationAccuracyMeters: null, locality: null, region: null, countryCode: null,
  locationSource: null,
  capturedAt: '2026-06-20T12:00:00.000Z', syncStatus: 'synced',
  category: null, sizeLabel: null, colorLabel: null, materialLabel: null, notes: null,
  isFavorite: false, catalogStatus: 'considering',
};

describe('shoppingGallery', () => {
  it('merges pending uploads ahead of remote history', () => {
    const result = mergeShoppingSnaps([synced], [{
      id: 'pending', localFileUri: 'file:///pending.jpg', storeName: 'COS',
      storeLocationId: null, shoppingSessionId: 'session-1', sessionStartedAt: Date.parse('2026-06-21T11:55:00.000Z'), branchLabel: null,
      captureGroupId: 'group-pending', captureGroupStartedAt: Date.parse('2026-06-21T12:00:00.000Z'),
      captureSequence: 2, captureRole: 'unknown',
      latitude: null, longitude: null, extractedPrice: null, rawOcrText: '',
      locationAccuracyMeters: null, locality: null, region: null, countryCode: null,
      locationSource: 'unavailable', locationStatus: 'unavailable', locationCapturedAt: null,
      ocrStatus: 'processing', timestamp: Date.parse('2026-06-21T12:00:00.000Z'),
    }]);

    expect(result.map((snap) => snap.id)).toEqual(['pending', 'synced']);
    expect(result[0].syncStatus).toBe('pending');
  });

  it('filters by store, date, and sync state', () => {
    const snaps = [
      synced,
      { ...synced, id: 'today', storeName: 'COS', capturedAt: '2026-06-22T10:00:00.000Z', syncStatus: 'pending' as const },
    ];
    expect(filterShoppingSnaps(snaps, 'COS', 'today', 'pending', new Date('2026-06-22T18:00:00.000Z')))
      .toEqual([snaps[1]]);
  });

  it('groups garment and tag photos into shopping edit items', () => {
    const tag = {
      ...synced,
      id: 'tag',
      imageUri: 'https://example.com/tag.jpg',
      captureGroupId: 'group-synced',
      captureRole: 'tag' as const,
      captureSequence: 2,
      extractedPrice: 118,
      rawOcrText: '$118.00',
    };

    const result = buildShoppingEditItems([tag, synced]);

    expect(result).toHaveLength(1);
    expect(result[0].primarySnap.id).toBe('synced');
    expect(result[0].tagSnaps.map((snap) => snap.id)).toEqual(['tag']);
    expect(result[0].photoCount).toBe(2);
    expect(result[0].extractedPrice).toBe(118);
  });

  it('carries group catalog fields onto shopping edit items', () => {
    const catalogued = {
      ...synced,
      category: 'T-shirt',
      sizeLabel: 'M',
      colorLabel: 'Heather blue',
      materialLabel: 'Cotton blend',
      notes: 'Good with black shorts.',
      isFavorite: true,
      catalogStatus: 'wishlist' as const,
    };

    const result = buildShoppingEditItems([catalogued]);

    expect(result[0]).toMatchObject({
      category: 'T-shirt',
      sizeLabel: 'M',
      colorLabel: 'Heather blue',
      materialLabel: 'Cotton blend',
      notes: 'Good with black shorts.',
      isFavorite: true,
      catalogStatus: 'wishlist',
    });
    expect(shoppingCatalogChips(result[0])).toEqual(['T-shirt', 'Size M', 'Heather blue', 'Cotton blend']);
    expect(shoppingCatalogStatusLabel(result[0].catalogStatus)).toBe('Wishlist');
    expect(shoppingItemBadges(result[0])[0]).toEqual({ key: 'favorite', label: 'Favorite', tone: 'success' });
  });

  it('summarizes item, store, missing price, and pending counts', () => {
    const snaps = [
      synced,
      { ...synced, id: 'pending', captureGroupId: 'group-pending', storeName: 'COS', extractedPrice: null, syncStatus: 'pending' as const },
      { ...synced, id: 'tag', captureGroupId: 'group-pending', captureRole: 'tag' as const, extractedPrice: null, syncStatus: 'pending' as const },
    ];

    const summary = summarizeShoppingEditItems(buildShoppingEditItems(snaps));

    expect(summary).toEqual({
      itemCount: 2,
      storeCount: 2,
      missingPriceItemCount: 1,
      pendingItemCount: 1,
      missingPricePhotoCount: 2,
      pendingPhotoCount: 2,
    });
  });

  it('filters shopping edit items that need review', () => {
    const snaps = [
      synced,
      { ...synced, id: 'review', captureGroupId: 'group-review', storeName: null, extractedPrice: null, rawOcrText: 'SIZE M $??' },
    ];

    const result = filterShoppingEditItems(
      buildShoppingEditItems(snaps),
      'all',
      'all',
      'all',
      'needs-review',
      new Date('2026-06-22T18:00:00.000Z'),
    );

    expect(result.map((item) => item.id)).toEqual(['group-review']);
    expect(result[0].reviewReasons).toEqual(['Missing price', 'Missing store', 'Text needs price check']);
  });

  it('builds item-level review reason chips and presentation badges', () => {
    const snaps = [
      synced,
      {
        ...synced,
        id: 'review',
        captureGroupId: 'group-review',
        captureRole: 'unknown' as const,
        storeName: null,
        extractedPrice: null,
        rawOcrText: 'SIZE M $??',
        syncStatus: 'pending' as const,
      },
    ];
    const items = buildShoppingEditItems(snaps);
    const reviewItem = items.find((item) => item.id === 'group-review');

    expect(buildShoppingReviewReasonOptions(items)).toEqual([
      { key: 'missing-price', label: 'Needs price', count: 1 },
      { key: 'missing-store', label: 'Needs store', count: 1 },
      { key: 'unsorted-photo', label: 'Unsorted', count: 1 },
      { key: 'text-needs-price-check', label: 'Check text', count: 1 },
    ]);
    expect(reviewItem ? itemRoleSummary(reviewItem) : null).toBe('1 unsorted');
    expect(reviewItem ? shoppingItemBadges(reviewItem) : []).toEqual([
      { key: 'pending', label: 'Saved locally', tone: 'attention' },
      { key: 'missing-price', label: 'Needs price', tone: 'attention' },
    ]);
  });

  it('builds organization updates that split one capture group and reuse the original group', () => {
    const snaps = [
      synced,
      {
        ...synced,
        id: 'detail',
        imageUri: 'https://example.com/detail.jpg',
        captureSequence: 2,
        extractedPrice: null,
        rawOcrText: '',
      },
      {
        ...synced,
        id: 'tag',
        imageUri: 'https://example.com/tag.jpg',
        captureRole: 'unknown' as const,
        captureSequence: 3,
        extractedPrice: 118,
        rawOcrText: '$118.00',
      },
    ];

    const updates = buildShoppingSnapOrganizationUpdates(
      snaps,
      [
        { id: 'item-1', snapIds: ['synced', 'tag'] },
        { id: 'item-2', snapIds: ['detail'] },
      ],
      { synced: 'garment', detail: 'garment', tag: 'tag' },
      { originalCaptureGroupId: 'group-synced', createGroupId: () => 'group-new' },
    );

    expect(updates).toEqual([
      {
        snapId: 'synced',
        captureGroupId: 'group-synced',
        captureGroupStartedAt: Date.parse('2026-06-20T12:00:00.000Z'),
        captureRole: 'garment',
        captureSequence: 1,
      },
      {
        snapId: 'tag',
        captureGroupId: 'group-synced',
        captureGroupStartedAt: Date.parse('2026-06-20T12:00:00.000Z'),
        captureRole: 'tag',
        captureSequence: 2,
      },
      {
        snapId: 'detail',
        captureGroupId: 'group-new',
        captureGroupStartedAt: Date.parse('2026-06-20T12:00:00.000Z'),
        captureRole: 'garment',
        captureSequence: 1,
      },
    ]);
  });

  it('turns organization updates into edit items with updated roles and metadata intact', () => {
    const snaps = [
      synced,
      { ...synced, id: 'tag', captureRole: 'unknown' as const, captureSequence: 2, extractedPrice: 118 },
      { ...synced, id: 'other', captureSequence: 3, extractedPrice: null, rawOcrText: '' },
    ];
    const updates = buildShoppingSnapOrganizationUpdates(
      snaps,
      [
        { id: 'item-1', snapIds: ['synced', 'tag'] },
        { id: 'item-2', snapIds: ['other'] },
      ],
      { synced: 'garment', tag: 'tag', other: 'garment' },
      { originalCaptureGroupId: 'group-synced', createGroupId: () => 'group-new' },
    );
    const updateById = new Map(updates.map((update) => [update.snapId, update]));
    const reorganized = snaps.map((snap) => {
      const update = updateById.get(snap.id);
      return update
        ? {
          ...snap,
          captureGroupId: update.captureGroupId,
          captureRole: update.captureRole,
          captureSequence: update.captureSequence,
        }
        : snap;
    });

    const items = buildShoppingEditItems(reorganized);

    expect(items).toHaveLength(2);
    expect(items.find((item) => item.captureGroupId === 'group-synced')?.tagSnaps.map((snap) => snap.id)).toEqual(['tag']);
    expect(items.find((item) => item.captureGroupId === 'group-synced')?.storeName).toBe('Aritzia');
    expect(items.find((item) => item.captureGroupId === 'group-new')?.primarySnap.id).toBe('other');
  });
});
