import {
  shoppingPriceCandidates,
  parseShoppingAmount,
  suggestedShoppingCurrency,
} from '../shoppingPrices';
import { validateShoppingPatch } from '../shoppingCatalog';
import { buildShoppingEditItems } from '../shoppingGallery';
import { browseShoppingItems } from '../shoppingSearch';
import type { ShoppingSnap } from '../../types/shoppingSnap';
const snap: ShoppingSnap = {
  id: 'a',
  captureGroupId: 'a',
  imageUri: 'file:///a.jpg',
  storagePath: null,
  storeName: 'COS',
  storeLocationId: null,
  shoppingSessionId: null,
  captureRole: 'garment',
  captureSequence: 1,
  branchLabel: null,
  latitude: null,
  longitude: null,
  locationAccuracyMeters: null,
  locality: null,
  region: null,
  countryCode: null,
  locationSource: null,
  extractedPrice: 120,
  rawOcrText: '$120',
  capturedAt: '2026-09-16T10:00:00Z',
  syncStatus: 'synced',
  category: 'outerwear',
  sizeLabel: null,
  colorLabel: 'cream',
  materialLabel: null,
  notes: 'Fits well',
  isFavorite: false,
  catalogStatus: 'considering',
};
it.each([
  ['1.299,95', 1299.95],
  ['1,299.95', 1299.95],
  ['1 299,95', 1299.95],
  ['1,299', 1299],
  ['0', 0],
])('parses international price %s', (value, expected) =>
  expect(parseShoppingAmount(value)).toBe(expected),
);
it('keeps ambiguous dollars unknown without location and preserves explicit currencies', () => {
  expect(shoppingPriceCandidates('$90')[0].currencyCode).toBeNull();
  expect(shoppingPriceCandidates('$90', 'CA')[0].currencyCode).toBe('CAD');
  expect(shoppingPriceCandidates('USD 90', 'CA')[0].currencyCode).toBe('USD');
  expect(shoppingPriceCandidates('€ 1.299,95')[0]).toMatchObject({
    amount: 1299.95,
    currencyCode: 'EUR',
  });
  expect(shoppingPriceCandidates('90 GBP')[0]).toMatchObject({
    amount: 90,
    currencyCode: 'GBP',
  });
});
it('retains distinct sale/original prices and deduplicates repeated OCR', () =>
  expect(shoppingPriceCandidates('Was £120 Now £90 £90')).toHaveLength(2));
it('suggests location before home currency without storing either automatically', () =>
  expect(suggestedShoppingCurrency('CA', 'GBP')).toBe('CAD'));
it('validates editable data, allowing zero and rejecting invalid links', () => {
  expect(() =>
    validateShoppingPatch({
      priceOverride: 0,
      purchaseUrl: 'https://example.com/item',
    }),
  ).not.toThrow();
  for (const value of [-1, NaN, Infinity])
    expect(() => validateShoppingPatch({ priceOverride: value })).toThrow();
  expect(() =>
    validateShoppingPatch({ purchaseUrl: 'javascript:alert(1)' }),
  ).toThrow();
});
it('preserves correction, original OCR, cover, and legacy decisions', () => {
  const item = buildShoppingEditItems([
    {
      ...snap,
      priceOverride: 75,
      currencyCode: 'CAD',
      coverPhotoId: 'detail',
      catalogStatus: 'wishlist',
    },
    {
      ...snap,
      id: 'detail',
      captureSequence: 2,
      extractedPrice: 200,
      priceOverride: 75,
      currencyCode: 'CAD',
      coverPhotoId: 'detail',
      catalogStatus: 'wishlist',
    },
  ])[0];
  expect(item).toMatchObject({
    extractedPrice: 75,
    currencyCode: 'CAD',
    isFavorite: true,
    catalogStatus: 'considering',
  });
  expect(item.primarySnap.id).toBe('detail');
  expect(item.snaps[0].extractedPrice).toBe(120);
  expect(
    buildShoppingEditItems([{ ...snap, catalogStatus: 'closet' }])[0]
      .wardrobeItemId,
  ).toBeNull();
});
it('searches across fields and never compares prices across currencies', () => {
  const items = buildShoppingEditItems([
    { ...snap, currencyCode: 'CAD', productName: 'Cream jacket' },
    {
      ...snap,
      id: 'b',
      captureGroupId: 'b',
      currencyCode: 'EUR',
      productName: 'Cream jacket',
    },
  ]);
  const filters = {
    query: 'cream COS',
    favorites: false,
    category: '',
    currency: 'CAD',
    min: '100',
    max: '130',
    oldest: false,
  };
  expect(browseShoppingItems(items, filters).map((item) => item.id)).toEqual([
    'a',
  ]);
  expect(
    browseShoppingItems(items, { ...filters, currency: '', min: '999' }),
  ).toHaveLength(2);
});
it('does not flag missing optional store or price as review work', () =>
  expect(
    buildShoppingEditItems([
      { ...snap, storeName: null, extractedPrice: null, rawOcrText: '' },
    ])[0].needsReview,
  ).toBe(false));
