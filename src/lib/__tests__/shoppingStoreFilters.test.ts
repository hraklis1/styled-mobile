import type { ShoppingEditItem } from '../shoppingGallery';
import {
  buildShoppingStoreOptions,
  countItemsWithoutStore,
  quickShoppingStoreOptions,
  searchShoppingStoreOptions,
  shoppingStoreFilterLabel,
} from '../shoppingStoreFilters';

let sequence = 0;

function item(overrides: Partial<ShoppingEditItem> = {}): ShoppingEditItem {
  sequence += 1;
  return {
    id: `item-${sequence}`,
    captureGroupId: `group-${sequence}`,
    snaps: [],
    primarySnap: {} as ShoppingEditItem['primarySnap'],
    tagSnaps: [],
    photoCount: 1,
    storeName: 'Aritzia',
    storeLocationId: null,
    branchLabel: null,
    locality: null,
    region: null,
    extractedPrice: null,
    capturedAt: '2026-06-20T12:00:00.000Z',
    syncStatus: 'synced',
    needsReview: false,
    reviewReasons: [],
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

describe('shoppingStoreFilters', () => {
  const items = [
    item({ storeName: 'COS', locality: 'San Francisco' }),
    item({ storeName: 'COS', locality: 'San Francisco' }),
    item({ storeName: 'COS', locality: 'Oakland' }),
    item({ storeName: 'Aritzia' }),
    item({ storeName: 'Zara' }),
    item({ storeName: 'Zara' }),
    item({ storeName: 'Everlane' }),
    item({ storeName: null }),
  ];

  it('ranks stores by item count and nests multi-location stores', () => {
    const options = buildShoppingStoreOptions(items);

    expect(options.map((option) => [option.label, option.itemCount])).toEqual([
      ['COS', 3],
      ['Zara', 2],
      ['Aritzia', 1],
      ['Everlane', 1],
    ]);
    expect(options[0].locations.map((location) => [location.label, location.itemCount])).toEqual([
      ['San Francisco', 2],
      ['Oakland', 1],
    ]);
    expect(options[1].locations).toEqual([]);
  });

  it('treats casing and spacing variants as one store', () => {
    const options = buildShoppingStoreOptions([
      item({ storeName: 'COS' }),
      item({ storeName: ' cos ' }),
    ]);

    expect(options).toHaveLength(1);
    expect(options[0].itemCount).toBe(2);
  });

  it('counts finds with no store attached', () => {
    expect(countItemsWithoutStore(items)).toBe(1);
  });

  it('searches by store name and by location', () => {
    const options = buildShoppingStoreOptions(items);

    expect(searchShoppingStoreOptions(options, 'zar').map((option) => option.label)).toEqual(['Zara']);
    expect(searchShoppingStoreOptions(options, '  ').map((option) => option.label))
      .toEqual(options.map((option) => option.label));

    const byLocation = searchShoppingStoreOptions(options, 'oak');
    expect(byLocation.map((option) => option.label)).toEqual(['COS']);
    expect(byLocation[0].locations.map((location) => location.label)).toEqual(['Oakland']);
  });

  it('keeps every location when the store name itself matches', () => {
    const options = buildShoppingStoreOptions(items);
    expect(searchShoppingStoreOptions(options, 'cos')[0].locations).toHaveLength(2);
  });

  it('shows the busiest stores as quick chips', () => {
    const options = buildShoppingStoreOptions(items);
    expect(quickShoppingStoreOptions(options, 'all').map((option) => option.label))
      .toEqual(['COS', 'Zara', 'Aritzia']);
  });

  it('appends the selected store when it falls outside the quick window', () => {
    const options = buildShoppingStoreOptions(items);
    const everlane = options.find((option) => option.label === 'Everlane')!;

    expect(quickShoppingStoreOptions(options, everlane.value).map((option) => option.label))
      .toEqual(['COS', 'Zara', 'Aritzia', 'Everlane']);
  });

  it('appends the selected store when a nested location is selected', () => {
    const options = buildShoppingStoreOptions([
      ...items,
      item({ storeName: 'Everlane', locality: 'Berkeley' }),
    ]);
    const berkeley = options
      .find((option) => option.label === 'Everlane')!
      .locations.find((location) => location.label === 'Berkeley')!;

    expect(quickShoppingStoreOptions(options, berkeley.value, 1).map((option) => option.label))
      .toEqual(['COS', 'Everlane']);
  });

  it('labels the active filter for the picker trigger', () => {
    const options = buildShoppingStoreOptions(items);
    const cos = options[0];

    expect(shoppingStoreFilterLabel(options, 'all')).toBe('All stores');
    expect(shoppingStoreFilterLabel(options, 'none')).toBe('Store not set');
    expect(shoppingStoreFilterLabel(options, cos.value)).toBe('COS');
    expect(shoppingStoreFilterLabel(options, cos.locations[1].value)).toBe('COS · Oakland');
  });

  it('falls back to all stores when the selected store disappears', () => {
    expect(shoppingStoreFilterLabel(buildShoppingStoreOptions(items), 'store:gone')).toBe('All stores');
  });
});
