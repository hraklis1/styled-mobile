import type { WishlistEntry } from '../wishlist';
import {
  countWishlistFilters,
  filterWishlist,
  getWishlistFilterOptions,
  type WishlistFilters,
} from '../shopWishlistFilters';

const entries: WishlistEntry[] = [
  {
    id: 'new-event',
    savedAt: '2026-06-19T12:00:00.000Z',
    eventContext: { id: 1, title: 'Summer wedding' },
    outfit: {
      intro: 'A polished warm-weather look',
      city: 'Toronto',
      totalBudget: '$200–$300 CAD',
      audioSummary: '',
      items: [
        { name: 'Linen blazer', category: 'Outerwear', brand: 'Aritzia', priceRange: '$120', whyItFitsYou: 'Lightweight', imageQuery: '' },
        { name: 'Silk skirt', category: 'Bottom', brand: 'COS', priceRange: '$90', whyItFitsYou: 'Elegant', imageQuery: '' },
      ],
    },
  },
  {
    id: 'old-general',
    savedAt: '2026-06-18T12:00:00.000Z',
    eventContext: null,
    outfit: {
      intro: 'Easy everyday layers',
      city: 'San Francisco',
      totalBudget: '$100–$180 USD',
      audioSummary: '',
      items: [
        { name: 'Crew sweater', category: 'Top', brand: 'Uniqlo', priceRange: '$50', whyItFitsYou: 'Earthy colour', imageQuery: '' },
      ],
    },
  },
];

const defaults: WishlistFilters = {
  query: '', scope: 'all', categories: [], cities: [], brands: [], sortOrder: 'newest',
};

describe('shop wishlist filters', () => {
  it('searches outfit, product, brand, city, and event fields', () => {
    for (const query of ['polished', 'blazer', 'aritzia', 'toronto', 'wedding']) {
      expect(filterWishlist(entries, { ...defaults, query }).map((entry) => entry.id)).toEqual(['new-event']);
    }
  });

  it('combines scope and facet filters', () => {
    expect(filterWishlist(entries, {
      ...defaults,
      scope: 'general',
      categories: ['Top'],
      cities: ['San Francisco'],
      brands: ['Uniqlo'],
    }).map((entry) => entry.id)).toEqual(['old-general']);
  });

  it('sorts oldest first without mutating the source array', () => {
    const result = filterWishlist(entries, { ...defaults, sortOrder: 'oldest' });
    expect(result.map((entry) => entry.id)).toEqual(['old-general', 'new-event']);
    expect(entries.map((entry) => entry.id)).toEqual(['new-event', 'old-general']);
  });

  it('builds unique sorted facet options and counts active filters', () => {
    expect(getWishlistFilterOptions(entries)).toEqual({
      categories: ['Bottom', 'Outerwear', 'Top'],
      cities: ['San Francisco', 'Toronto'],
      brands: ['Aritzia', 'COS', 'Uniqlo'],
    });
    expect(countWishlistFilters({
      ...defaults,
      scope: 'event',
      categories: ['Top'],
      brands: ['COS'],
      sortOrder: 'oldest',
    })).toBe(4);
  });
});
