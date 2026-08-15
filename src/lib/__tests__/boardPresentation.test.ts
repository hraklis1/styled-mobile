jest.mock('../api', () => ({ API_BASE_URL: 'https://api.styled.test' }));

import {
  canComposeOutfit,
  filterBoardFeed,
  getBoardCoverUris,
  getBoardGap,
  getBoardInsights,
  getBoardSavedCount,
} from '../boardPresentation';
import type { Board, BoardFeedItem } from '../../types/board';
import type { Item } from '../../types/item';

const board: Board = {
  id: 1,
  userId: 1,
  name: 'Weekend Edit',
  coverImageUrl: 'https://example.com/fallback.jpg',
  coverHash: null,
  itemIds: [1, 2],
  outfitIds: [3],
  wishlistIds: ['wish-1'],
  createdAt: '',
};

const makeItem = (id: number, name: string, imageUrl: string | null, category: Item['category'], colors: string[]): Item => ({
  id, name, imageUrl, cutoutUrl: null, polishedUrl: null, thumbUrl: null, coverImageVariant: 'original', category, colorPalette: colors, colorNormalized: colors[0] ?? null,
  userId: 1, color: null, colorTemperature: null, subcategory: null, brand: null, style: null,
  seasons: [], occasions: [], material: null, fit: null, pattern: null, neckline: null, sleeveLength: null,
  tags: [], notableDetails: [], notes: null, care: null, condition: null, warmthRating: null,
  purchasePrice: null, purchaseDate: null, wearCount: 0, lastWornAt: null, isFavorite: false, isArchived: false, createdAt: '',
});

const item = makeItem(1, 'Navy blazer', 'https://example.com/blazer.jpg', 'outerwear', ['#25324A']);
const feed: BoardFeedItem[] = [{ kind: 'item', key: 'i1', item }];

describe('board presentation', () => {
  it('counts every supported saved type', () => {
    expect(getBoardSavedCount(board)).toBe(4);
  });

  it('honors an intentional cover and otherwise removes duplicate member imagery', () => {
    expect(getBoardCoverUris(board, new Map([[1, item]]), new Map())).toEqual(['https://example.com/fallback.jpg']);
    expect(getBoardCoverUris({ ...board, coverImageUrl: null }, new Map([[1, item], [2, { ...item, id: 2 }]]), new Map())).toEqual(['https://example.com/blazer.jpg']);
  });

  it('filters mixed board content and derives fashion insights', () => {
    expect(filterBoardFeed(feed, 'item')).toHaveLength(1);
    expect(filterBoardFeed(feed, 'outfit')).toHaveLength(0);
    expect(getBoardInsights(feed)).toEqual({ colors: ['#25324A'], categories: [['Outerwear', 1]] });
  });
});

describe('getBoardGap', () => {
  let nextId = 100;
  const piece = (category: Item['category'], overrides: Partial<Item> = {}): BoardFeedItem => {
    const base = makeItem(nextId++, `${category} piece`, null, category, []);
    return { kind: 'item', key: `i${base.id}`, item: { ...base, ...overrides } };
  };

  it('stays quiet until a board has enough saved to judge', () => {
    expect(getBoardGap([])).toBeNull();
    expect(getBoardGap([piece('top'), piece('bottom')])).toBeNull();
  });

  it('stays quiet when either complete silhouette is already present', () => {
    expect(getBoardGap([piece('top'), piece('bottom'), piece('shoes')])).toBeNull();
    expect(getBoardGap([piece('full_body'), piece('shoes'), piece('accessory')])).toBeNull();
  });

  it('promises an outfit only when exactly one slot is missing', () => {
    expect(getBoardGap([piece('top'), piece('bottom'), piece('outerwear')])).toEqual({
      missing: 'shoes',
      text: 'Add shoes and this board can become an outfit.',
    });
    expect(getBoardGap([piece('top'), piece('shoes'), piece('accessory')])).toEqual({
      missing: 'bottom',
      text: 'Add a bottom and this board can become an outfit.',
    });
  });

  it('softens the copy when more than one slot is missing', () => {
    expect(getBoardGap([piece('outerwear'), piece('accessory'), piece('valuables')])).toEqual({
      missing: 'shoes',
      text: 'Add shoes to start building outfits here.',
    });
  });

  it('prefers the silhouette that is closest to complete', () => {
    // full_body + accessories is one slot (shoes) from a look, while the
    // separates path would be two — the nearer path must win.
    expect(getBoardGap([piece('full_body'), piece('accessory'), piece('outerwear')])).toEqual({
      missing: 'shoes',
      text: 'Add shoes and this board can become an outfit.',
    });
  });

  it('ignores pieces the server would also refuse to style', () => {
    const gap = getBoardGap([
      piece('top'),
      piece('bottom'),
      piece('shoes', { isArchived: true }),
      piece('accessory'),
    ]);
    expect(gap).toEqual({ missing: 'shoes', text: 'Add shoes and this board can become an outfit.' });

    expect(getBoardGap([
      piece('top'),
      piece('bottom'),
      piece('shoes', { condition: 'needs_repair' }),
      piece('accessory'),
    ])?.missing).toBe('shoes');
  });

  it('says nothing about boards holding only outfits or wishlist looks', () => {
    expect(getBoardGap([{ kind: 'outfit', key: 'o1', outfit: { id: 1 } as never }])).toBeNull();
  });

  describe('canComposeOutfit', () => {
    // The board screen shows the gap line when there IS a gap and the "Style
    // this board" button when a look can be composed. A near-empty board has
    // no gap to report but also cannot be styled, so the two must be separate
    // predicates — using `gap === null` as the button gate offered to style
    // boards holding nothing, which the server then answers with prose.
    it('is false for a board with too little to judge, where the gap is also null', () => {
      const sparse: BoardFeedItem[] = [];
      expect(getBoardGap(sparse)).toBeNull();
      expect(canComposeOutfit(sparse)).toBe(false);

      const outfitsOnly: BoardFeedItem[] = [{ kind: 'outfit', key: 'o1', outfit: { id: 1 } as never }];
      expect(getBoardGap(outfitsOnly)).toBeNull();
      expect(canComposeOutfit(outfitsOnly)).toBe(false);
    });

    it('is true only for a complete silhouette', () => {
      expect(canComposeOutfit([piece('top'), piece('bottom'), piece('shoes')])).toBe(true);
      expect(canComposeOutfit([piece('full_body'), piece('shoes')])).toBe(true);
      expect(canComposeOutfit([piece('top'), piece('bottom'), piece('outerwear')])).toBe(false);
    });

    it('agrees with the gap line: exactly one of them speaks', () => {
      const complete = [piece('top'), piece('bottom'), piece('shoes')];
      expect(getBoardGap(complete)).toBeNull();
      expect(canComposeOutfit(complete)).toBe(true);

      const missingShoes = [piece('top'), piece('bottom'), piece('outerwear')];
      expect(getBoardGap(missingShoes)).not.toBeNull();
      expect(canComposeOutfit(missingShoes)).toBe(false);
    });

    it('ignores unwearable pieces, like the server does', () => {
      expect(canComposeOutfit([
        piece('top'), piece('bottom'), piece('shoes', { isArchived: true }),
      ])).toBe(false);
    });
  });
});
