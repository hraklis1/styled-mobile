import type { WishlistEntry } from '../wishlist';
import {
  getWishlistAccessibilityLabel,
  getWishlistBrands,
  getWishlistContext,
  getWishlistItemSummary,
  getWishlistMeta,
  getWishlistSearchText,
  getWishlistTitle,
} from '../wishlistPresentation';

const entry: WishlistEntry = {
  id: 'wish-1',
  savedAt: '2026-06-19T12:00:00.000Z',
  eventContext: { id: 7, title: 'Summer wedding' },
  outfit: {
    intro: 'Polished linen layers',
    city: 'Toronto',
    totalBudget: '$220–$340 CAD',
    audioSummary: '',
    items: [
      {
        name: 'Linen blazer',
        category: 'Outerwear',
        brand: 'Aritzia',
        priceRange: '$150',
        whyItFitsYou: 'Lightweight',
        imageQuery: '',
        imageUrl: 'https://example.com/blazer.jpg',
      },
      {
        name: 'Silk skirt',
        category: 'Bottom',
        brand: 'COS',
        priceRange: '$90',
        whyItFitsYou: 'Elegant',
        imageQuery: '',
      },
      {
        name: 'Leather sandals',
        category: 'Shoes',
        brand: 'Aritzia',
        priceRange: '$100',
        whyItFitsYou: 'Comfortable',
        imageQuery: '',
      },
    ],
  },
};

describe('wishlist presentation', () => {
  it('builds descriptive labels and de-duplicates brands', () => {
    expect(getWishlistTitle(entry)).toBe('Polished linen layers');
    expect(getWishlistContext(entry)).toBe('Summer wedding');
    expect(getWishlistBrands(entry)).toEqual(['Aritzia', 'COS']);
    expect(getWishlistItemSummary(entry)).toBe('Linen blazer · Silk skirt +1');
    expect(getWishlistMeta(entry)).toBe('3 items · $220–$340 CAD');
    expect(getWishlistAccessibilityLabel(entry)).toContain('Leather sandals');
  });

  it('includes all useful fields in normalized search metadata', () => {
    const searchText = getWishlistSearchText(entry);
    for (const term of ['polished', 'toronto', 'wedding', 'blazer', 'aritzia', 'outerwear', '$150']) {
      expect(searchText).toContain(term);
    }
  });

  it('falls back safely when an outfit has no products, images, intro, or event', () => {
    const empty: WishlistEntry = {
      id: 'empty',
      savedAt: '2026-06-19T12:00:00.000Z',
      outfit: { intro: '', city: 'Montreal', totalBudget: '', audioSummary: '', items: [] },
    };
    expect(getWishlistTitle(empty)).toBe('Montreal');
    expect(getWishlistContext(empty)).toBe('Montreal');
    expect(getWishlistItemSummary(empty)).toBe('No products listed');
    expect(getWishlistMeta(empty)).toBe('0 items');
    expect(getWishlistSearchText(empty)).toContain('montreal');
  });
});
