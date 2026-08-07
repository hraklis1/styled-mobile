import { buildShoppingEditItems } from '../shoppingGallery';
import { buildShoppingSessionGroups, shoppingSessionHighlights } from '../shoppingSessionGroups';
import type { ShoppingSnap } from '../../types/shoppingSnap';

const snap: ShoppingSnap = {
  id: 'a', imageUri: 'https://example.com/a.jpg', storagePath: 'user/a.jpg', storeName: 'Aritzia',
  storeLocationId: null, shoppingSessionId: null, branchLabel: 'Union Square',
  captureGroupId: 'group-a', captureRole: 'garment', captureSequence: 1,
  latitude: null, longitude: null, extractedPrice: 120, rawOcrText: '$120.00',
  locationAccuracyMeters: null, locality: 'San Francisco', region: 'CA', countryCode: 'US',
  locationSource: null,
  capturedAt: '2026-06-20T12:00:00.000Z', syncStatus: 'synced',
  category: null, sizeLabel: null, colorLabel: null, materialLabel: null, notes: null,
  isFavorite: false, catalogStatus: 'considering',
};

const now = new Date('2026-06-22T18:00:00.000Z');

describe('shoppingSessionGroups', () => {
  it('bundles a day at one store into a single trip', () => {
    const items = buildShoppingEditItems([
      snap,
      { ...snap, id: 'b', captureGroupId: 'group-b', extractedPrice: 80, capturedAt: '2026-06-20T13:00:00.000Z' },
      { ...snap, id: 'b-tag', captureGroupId: 'group-b', captureRole: 'tag', captureSequence: 2, extractedPrice: 80, capturedAt: '2026-06-20T13:01:00.000Z' },
    ]);

    const groups = buildShoppingSessionGroups(items, now);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      dateLabel: 'June 20',
      storeName: 'Aritzia',
      placeLabel: 'San Francisco · Union Square',
      itemCount: 2,
      photoCount: 3,
      knownSpend: 200,
    });
  });

  it('separates trips by day, store, and location, newest first', () => {
    const items = buildShoppingEditItems([
      snap,
      { ...snap, id: 'later', captureGroupId: 'group-later', capturedAt: '2026-06-22T09:00:00.000Z' },
      { ...snap, id: 'other-store', captureGroupId: 'group-other', storeName: 'COS' },
      { ...snap, id: 'other-branch', captureGroupId: 'group-branch', branchLabel: 'Hayes Valley' },
    ]);

    const groups = buildShoppingSessionGroups(items, now);

    expect(groups.map((group) => [group.dateLabel, group.storeName, group.placeLabel])).toEqual([
      ['Today', 'Aritzia', 'San Francisco · Union Square'],
      ['June 20', 'Aritzia', 'San Francisco · Union Square'],
      ['June 20', 'COS', 'San Francisco · Union Square'],
      ['June 20', 'Aritzia', 'San Francisco · Hayes Valley'],
    ]);
  });

  it('leaves spend unknown when no item in the trip has a price', () => {
    const items = buildShoppingEditItems([
      { ...snap, extractedPrice: null, rawOcrText: '' },
    ]);

    const groups = buildShoppingSessionGroups(items, now);

    expect(groups[0].knownSpend).toBeNull();
    expect(groups[0].needsPriceCount).toBe(1);
  });

  it('surfaces what still needs attention in a trip', () => {
    const items = buildShoppingEditItems([
      { ...snap, extractedPrice: null, rawOcrText: '', syncStatus: 'pending' },
      { ...snap, id: 'b', captureGroupId: 'group-b', captureRole: 'unknown', isFavorite: true },
    ]);

    const groups = buildShoppingSessionGroups(items, now);

    expect(groups[0]).toMatchObject({ needsPriceCount: 1, pendingCount: 1, unsortedCount: 1, favoriteCount: 1 });
    expect(shoppingSessionHighlights(groups[0])).toEqual(['1 saved locally', '1 needs price']);
  });

  it('says a trip is settled when nothing is outstanding', () => {
    const groups = buildShoppingSessionGroups(buildShoppingEditItems([snap]), now);

    expect(shoppingSessionHighlights(groups[0])).toEqual(['All catalogued']);
  });
});
