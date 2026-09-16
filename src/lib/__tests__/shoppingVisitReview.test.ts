import { buildVisitReviewHeader } from '../shoppingVisitReview';
import type { ShoppingSnap } from '../../types/shoppingSnap';

const snap: ShoppingSnap = {
  id: 'a', imageUri: 'https://example.com/a.jpg', storagePath: 'user/a.jpg', storeName: 'Aritzia',
  storeLocationId: null, shoppingSessionId: 'visit-1', branchLabel: null,
  captureGroupId: 'group-a', captureRole: 'garment', captureSequence: 1,
  latitude: null, longitude: null, extractedPrice: null, rawOcrText: '',
  locationAccuracyMeters: null, locality: null, region: null, countryCode: 'US',
  locationSource: null,
  capturedAt: '2026-06-22T16:10:00.000Z', syncStatus: 'synced',
  category: null, sizeLabel: null, colorLabel: null, materialLabel: null, notes: null,
  isFavorite: false, catalogStatus: 'considering',
};

const now = new Date('2026-06-22T18:00:00.000Z');

describe('buildVisitReviewHeader', () => {
  it('titles the visit after the store on its photos', () => {
    const header = buildVisitReviewHeader([snap, { ...snap, id: 'b', storeName: null }], { isLiveVisit: true, now });
    expect(header.eyebrow).toBe('THIS VISIT');
    expect(header.title).toBe('Aritzia');
    expect(header.meta.startsWith('Today · ')).toBe(true);
  });

  it('falls back to the session store, then to the day', () => {
    const untagged = { ...snap, storeName: null };
    expect(buildVisitReviewHeader([untagged], { isLiveVisit: true, fallbackStoreName: 'COS', now }).title).toBe('COS');
    expect(buildVisitReviewHeader([untagged], { isLiveVisit: true, now }).title).toBe("Today's visit");
    const older = buildVisitReviewHeader(
      [{ ...untagged, capturedAt: '2026-06-01T10:00:00.000Z' }], { isLiveVisit: false, now },
    );
    expect(older.eyebrow).toBe('EARLIER VISIT');
    expect(older.title).toBe('Earlier visit');
    expect(older.meta.startsWith('June 1 · ')).toBe(true);
  });
});
