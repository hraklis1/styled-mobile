import type { WishlistEntry } from '../wishlist';
import { getWishlistRecommendationType } from '../wishlistType';
import {
  getWishlistAccessibilityLabel,
  getWishlistBrands,
  getWishlistBoardLabel,
  getWishlistBoardTitle,
  getWishlistContext,
  getWishlistItemSummary,
  getWishlistMeta,
  getWishlistSearchText,
  getWishlistTitle,
  getWishlistTypeLabel,
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
    expect(getWishlistBoardLabel(entry)).toBe('Shopping edit');
    expect(getWishlistBoardTitle(entry)).toBe('Linen blazer');
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

  it('keeps semantic shopping types distinct from legacy item-count fallbacks', () => {
    const piece: WishlistEntry = {
      id: 'piece',
      savedAt: '2026-06-19T12:00:00.000Z',
      recommendationType: 'piece',
      outfit: {
        intro: 'A merino sweater to consider',
        city: 'Toronto',
        totalBudget: '$120 CAD',
        audioSummary: '',
        items: [{ name: 'Merino sweater', category: 'Top', brand: 'COS', priceRange: '$120', whyItFitsYou: 'Adds useful texture', imageQuery: '' }],
      },
    };
    const list: WishlistEntry = {
      id: 'list',
      savedAt: '2026-06-19T12:00:00.000Z',
      recommendationType: 'list',
      outfit: {
        intro: 'Sweaters to compare',
        city: 'Toronto',
        totalBudget: '$100–$180 CAD',
        audioSummary: '',
        items: [
          { name: 'Merino sweater', category: 'Top', brand: 'COS', priceRange: '$120', whyItFitsYou: 'Adds useful texture', imageQuery: '' },
          { name: 'Cashmere sweater', category: 'Top', brand: 'Uniqlo', priceRange: '$160', whyItFitsYou: 'Soft neutral layer', imageQuery: '' },
        ],
      },
    };

    expect(getWishlistRecommendationType(piece)).toBe('piece');
    expect(getWishlistBoardLabel(piece)).toBe('Saved piece');
    expect(getWishlistBoardTitle(piece)).toBe('Merino sweater');
    expect(getWishlistTypeLabel(piece)).toBe('Saved piece');
    expect(getWishlistMeta(piece)).toBe('1 piece · $120 CAD');
    expect(getWishlistRecommendationType(list)).toBe('list');
    expect(getWishlistBoardLabel(list)).toBe('Shopping edit');
    expect(getWishlistBoardTitle(list)).toBe('Merino sweater');
    expect(getWishlistTypeLabel(list)).toBe('Saved list');
    expect(getWishlistMeta(list)).toBe('2 options · $100–$180 CAD');
  });

  it('falls back safely when an outfit has no products, images, intro, or event', () => {
    const empty: WishlistEntry = {
      id: 'empty',
      savedAt: '2026-06-19T12:00:00.000Z',
      outfit: { intro: '', city: 'Montreal', totalBudget: '', audioSummary: '', items: [] },
    };
    expect(getWishlistTitle(empty)).toBe('Montreal');
    expect(getWishlistBoardLabel(empty)).toBe('Shopping edit');
    expect(getWishlistBoardTitle(empty)).toBe('Montreal');
    expect(getWishlistContext(empty)).toBe('Montreal');
    expect(getWishlistItemSummary(empty)).toBe('No products listed');
    expect(getWishlistMeta(empty)).toBe('0 items');
    expect(getWishlistSearchText(empty)).toContain('montreal');
  });

  it('shortens an intro to its first sentence when product names are unavailable', () => {
    const introOnly: WishlistEntry = {
      id: 'intro-only',
      savedAt: '2026-06-19T12:00:00.000Z',
      outfit: {
        intro: 'A polished neutral edit for everyday layering. Add texture with a soft knit.',
        city: 'Toronto',
        totalBudget: '',
        audioSummary: '',
        items: [{ name: '', category: 'Top', brand: '', priceRange: '', whyItFitsYou: '', imageQuery: '' }],
      },
    };

    expect(getWishlistBoardTitle(introOnly)).toBe('A polished neutral edit for everyday layering.');
  });
});
