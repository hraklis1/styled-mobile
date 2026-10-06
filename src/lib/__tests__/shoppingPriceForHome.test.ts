import { formatShoppingPriceForHome } from '../shoppingPresentation';
import { nearestVisitedStore, type ShoppingStoreSuggestion } from '../shoppingLocations';

describe('formatShoppingPriceForHome', () => {
  it('names a foreign dollar currency', () => {
    expect(formatShoppingPriceForHome(75, 'CAD', 'USD')).toBe('CA$75');
    expect(formatShoppingPriceForHome(60, 'USD', 'CAD')).toBe('US$60');
  });

  it('leaves the home currency and non-dollar currencies alone', () => {
    expect(formatShoppingPriceForHome(60, 'USD', 'USD')).toBe('$60');
    expect(formatShoppingPriceForHome(52, 'GBP', 'USD')).toBe('£52');
    expect(formatShoppingPriceForHome(null, 'CAD', 'USD')).toBeNull();
  });
});

describe('nearestVisitedStore', () => {
  const store = (id: string, latitude: number | null, source: ShoppingStoreSuggestion['source'] = 'recent'): ShoppingStoreSuggestion => ({
    id, storeName: id, branchLabel: null, locality: null, region: null, countryCode: null,
    latitude, longitude: latitude === null ? null : -81.27, source, score: 0,
  });
  const here = { latitude: 43.0255, longitude: -81.27 };

  it('picks the closest visited store within range', () => {
    expect(nearestVisitedStore([store('far', 43.03), store('near', 43.0256)], here)?.id).toBe('near');
  });

  it('ignores stores out of range, without coordinates, or never visited', () => {
    expect(nearestVisitedStore([store('far', 43.04), store('none', null), store('popular', 43.0255, 'popular')], here)).toBeNull();
    expect(nearestVisitedStore([store('near', 43.0256)], null)).toBeNull();
  });
});
