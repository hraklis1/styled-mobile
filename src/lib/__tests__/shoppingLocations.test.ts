import {
  buildShoppingLocationKey,
  buildShoppingStoreSuggestions,
  formatShoppingPlaceLabel,
  shoppingFilterKey,
} from '../shoppingLocations';
import type { ShoppingSessionContext } from '../../stores/useShoppingSessionStore';

const torontoLululemon: ShoppingSessionContext = {
  id: 'session-toronto',
  storeLocationId: 'loc-toronto',
  storeName: 'Lululemon',
  branchLabel: 'Yorkdale',
  latitude: 43.725,
  longitude: -79.452,
  locationAccuracyMeters: 30,
  locality: 'Toronto',
  region: 'ON',
  countryCode: 'CA',
  locationSource: 'device',
  locationStatus: 'resolved',
  locationCapturedAt: Date.parse('2026-06-22T12:00:00.000Z'),
  startedAt: Date.parse('2026-06-22T12:00:00.000Z'),
};

describe('shoppingLocations', () => {
  it('formats repeated stores with distinct city and branch labels', () => {
    const vancouverLululemon = {
      ...torontoLululemon,
      id: 'session-vancouver',
      storeLocationId: 'loc-vancouver',
      branchLabel: 'Robson',
      locality: 'Vancouver',
      region: 'BC',
    };

    expect(formatShoppingPlaceLabel(torontoLululemon)).toBe('Toronto · Yorkdale');
    expect(formatShoppingPlaceLabel(vancouverLululemon)).toBe('Vancouver · Robson');
    expect(shoppingFilterKey(torontoLululemon)).not.toBe(shoppingFilterKey(vancouverLululemon));
  });

  it('deduplicates repeated location parts and falls back when missing', () => {
    expect(formatShoppingPlaceLabel({
      storeName: 'COS',
      branchLabel: 'Toronto',
      locality: 'Toronto',
      region: 'ON',
    })).toBe('Toronto · ON');
    expect(formatShoppingPlaceLabel({ storeName: 'COS' })).toBe('Location not set');
  });

  it('builds stable location keys from normalized store and branch parts', () => {
    expect(buildShoppingLocationKey({
      storeName: '  LULULEMON ',
      branchLabel: 'Yorkdale',
      locality: 'Toronto',
      region: 'ON',
      countryCode: 'CA',
    })).toBe('lululemon|yorkdale|toronto|on|ca');
  });

  it('ranks recent branch matches ahead of seeded stores', () => {
    const suggestions = buildShoppingStoreSuggestions({
      query: 'lul',
      recentSessions: [torontoLululemon],
      recentStores: [],
      currentLocation: torontoLululemon,
    });

    expect(suggestions[0]).toMatchObject({
      storeName: 'Lululemon',
      source: 'recent',
      locality: 'Toronto',
    });
  });

  it('filters suggestions case-insensitively and offers free text', () => {
    const suggestions = buildShoppingStoreSuggestions({
      query: 'small local boutique',
      recentSessions: [],
      recentStores: [],
      limit: 5,
    });

    expect(suggestions).toEqual([
      expect.objectContaining({
        storeName: 'small local boutique',
        source: 'free-text',
      }),
    ]);
  });
});
