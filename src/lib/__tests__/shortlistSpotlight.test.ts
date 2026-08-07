import { buildShoppingEditItems } from '../shoppingGallery';
import { buildShortlistSpotlight } from '../shortlistSpotlight';
import type { ShoppingSnap } from '../../types/shoppingSnap';

const snap: ShoppingSnap = {
  id: 'a', imageUri: 'https://example.com/a.jpg', storagePath: 'user/a.jpg', storeName: 'Aritzia',
  storeLocationId: null, shoppingSessionId: null, branchLabel: null,
  captureGroupId: 'group-a', captureRole: 'garment', captureSequence: 1,
  latitude: null, longitude: null, extractedPrice: 120, rawOcrText: '$120.00',
  locationAccuracyMeters: null, locality: null, region: null, countryCode: null,
  locationSource: null,
  capturedAt: '2026-06-20T12:00:00.000Z', syncStatus: 'synced',
  category: null, sizeLabel: null, colorLabel: null, materialLabel: null, notes: null,
  isFavorite: false, catalogStatus: 'considering',
};

const now = new Date('2026-06-22T18:00:00.000Z');

describe('shortlistSpotlight', () => {
  it('summarizes the shortlist and picks the newest trip', () => {
    const items = buildShoppingEditItems([
      snap,
      { ...snap, id: 'b', captureGroupId: 'group-b', storeName: 'COS', extractedPrice: null, rawOcrText: '', capturedAt: '2026-06-22T09:00:00.000Z' },
    ]);

    const spotlight = buildShortlistSpotlight(items, now);

    expect(spotlight.statLine).toBe('2 pieces · 2 stores · 1 needs a price');
    expect(spotlight.latestTrip?.storeName).toBe('COS');
    expect(spotlight.awaitingDecision.map((item) => item.id)).toEqual(['group-b', 'group-a']);
    expect(spotlight.decisionStores).toEqual(['COS', 'Aritzia']);
  });

  it('drops empty segments from the stat line', () => {
    const items = buildShoppingEditItems([snap]);

    expect(buildShortlistSpotlight(items, now).statLine).toBe('1 piece · 1 store');
  });

  it('counts every find waiting on a decision, not just the first few', () => {
    const items = buildShoppingEditItems(
      Array.from({ length: 7 }, (_, index) => ({
        ...snap,
        id: `snap-${index}`,
        captureGroupId: `group-${index}`,
      })),
    );

    const spotlight = buildShortlistSpotlight(items, now);

    expect(spotlight.awaitingDecision).toHaveLength(7);
    expect(spotlight.decisionStores).toEqual(['Aritzia']);
  });

  it('leads the rail with finds awaiting a decision, then the settled ones', () => {
    const items = buildShoppingEditItems([
      { ...snap, id: 'old-closet', captureGroupId: 'group-old-closet', catalogStatus: 'closet', capturedAt: '2026-06-01T12:00:00.000Z' },
      { ...snap, id: 'new-closet', captureGroupId: 'group-new-closet', catalogStatus: 'closet', capturedAt: '2026-06-21T12:00:00.000Z' },
      { ...snap, id: 'deciding', captureGroupId: 'group-deciding', capturedAt: '2026-06-10T12:00:00.000Z' },
    ]);

    const spotlight = buildShortlistSpotlight(items, now);

    expect(spotlight.railItems.map((item) => item.id))
      .toEqual(['group-deciding', 'group-new-closet', 'group-old-closet']);
  });

  it('caps the rail without capping the count behind it', () => {
    const items = buildShoppingEditItems(
      Array.from({ length: 11 }, (_, index) => ({
        ...snap,
        id: `snap-${index}`,
        captureGroupId: `group-${index}`,
      })),
    );

    const spotlight = buildShortlistSpotlight(items, now);

    expect(spotlight.railItems).toHaveLength(8);
    expect(spotlight.itemCount).toBe(11);
    expect(new Set(spotlight.railItems.map((item) => item.id)).size).toBe(8);
  });

  it('leaves nothing to show for an empty shortlist', () => {
    const spotlight = buildShortlistSpotlight([], now);

    expect(spotlight.latestTrip).toBeNull();
    expect(spotlight.awaitingDecision).toEqual([]);
    expect(spotlight.railItems).toEqual([]);
    expect(spotlight.statLine).toBe('0 pieces');
  });

  it('ignores finds that are already settled', () => {
    const items = buildShoppingEditItems([
      { ...snap, catalogStatus: 'closet' },
      { ...snap, id: 'passed', captureGroupId: 'group-passed', catalogStatus: 'passed' },
      { ...snap, id: 'wishlist', captureGroupId: 'group-wishlist', catalogStatus: 'wishlist' },
    ]);

    expect(buildShortlistSpotlight(items, now).awaitingDecision.map((item) => item.id))
      .toEqual(['group-wishlist']);
  });
});
