jest.mock('../api', () => ({ API_BASE_URL: 'https://api.styled.test' }));

import {
  canComposeOutfit,
  filterBoardFeed,
  getBoardCoverUris,
  getBoardContentSummary,
  getBoardInsights,
  getBoardSavedCount,
  shouldShowBoardSearch,
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

  it('summarizes pieces and looks without showing empty categories', () => {
    expect(getBoardContentSummary({ itemIds: [1, 2], outfitIds: [], wishlistIds: [] })).toBe('2 pieces');
    expect(getBoardContentSummary({ itemIds: [], outfitIds: [3], wishlistIds: [] })).toBe('1 look');
    expect(getBoardContentSummary(board)).toBe('2 pieces · 2 looks');
    expect(getBoardContentSummary({ itemIds: [], outfitIds: [], wishlistIds: [] })).toBe('Empty board');
  });

  it('keeps board search based on the unfiltered visible collection', () => {
    const boards = Array.from({ length: 6 }, (_, index) => ({ name: `Board ${index + 1}` }));
    expect(shouldShowBoardSearch(boards)).toBe(true);
    expect(shouldShowBoardSearch(boards.slice(0, 5))).toBe(false);
    expect(shouldShowBoardSearch([
      ...boards.slice(0, 5),
      { name: 'Daily Finds' },
    ])).toBe(false);
    expect(shouldShowBoardSearch([
      ...boards,
      { name: 'Daily Finds' },
    ])).toBe(true);
  });

  it('honors an intentional cover and otherwise removes duplicate member imagery', () => {
    expect(getBoardCoverUris(board, new Map([[1, item]]), new Map())).toEqual(['https://example.com/fallback.jpg']);
    expect(getBoardCoverUris({ ...board, coverImageUrl: null }, new Map([[1, item], [2, { ...item, id: 2 }]]), new Map())).toEqual(['https://example.com/blazer.jpg']);
  });

  it('caps fallback covers at four unique member images in board order', () => {
    const items = new Map(
      [1, 2, 3, 4, 5].map((id) => [id, { ...item, id, imageUrl: `https://example.com/item-${id}.jpg` }]),
    );

    expect(getBoardCoverUris({ ...board, coverImageUrl: null, itemIds: [1, 2, 3, 4, 5], outfitIds: [], wishlistIds: [] }, items, new Map())).toEqual([
      'https://example.com/item-1.jpg',
      'https://example.com/item-2.jpg',
      'https://example.com/item-3.jpg',
      'https://example.com/item-4.jpg',
    ]);
  });

  it('falls back to outfit imagery when a board has no usable item imagery', () => {
    const outfits = new Map([[3, { aiGeneratedImageUrl: 'https://example.com/look.jpg' } as never]]);

    expect(getBoardCoverUris({ ...board, coverImageUrl: null, itemIds: [99], outfitIds: [3], wishlistIds: [] }, new Map(), outfits)).toEqual([
      'https://example.com/look.jpg',
    ]);
  });

  it('returns no cover sources for empty or wishlist-only boards', () => {
    expect(getBoardCoverUris({ ...board, coverImageUrl: null, itemIds: [], outfitIds: [], wishlistIds: ['wish-1'] }, new Map(), new Map())).toEqual([]);
  });

  it('filters mixed board content and derives fashion insights', () => {
    expect(filterBoardFeed(feed, 'item')).toHaveLength(1);
    expect(filterBoardFeed(feed, 'outfit')).toHaveLength(0);
    expect(getBoardInsights(feed)).toEqual({ colors: ['#25324A'], categories: [['Outerwear', 1]] });
  });
});

describe('canComposeOutfit', () => {
  let nextId = 100;
  const piece = (category: Item['category'], overrides: Partial<Item> = {}): BoardFeedItem => {
    const base = makeItem(nextId++, `${category} piece`, null, category, []);
    return { kind: 'item', key: `i${base.id}`, item: { ...base, ...overrides } };
  };

  it('is false for a board with too little to style', () => {
    const sparse: BoardFeedItem[] = [];
    expect(canComposeOutfit(sparse)).toBe(false);

    const outfitsOnly: BoardFeedItem[] = [{ kind: 'outfit', key: 'o1', outfit: { id: 1 } as never }];
    expect(canComposeOutfit(outfitsOnly)).toBe(false);
  });

  it('is true only for a complete silhouette', () => {
    expect(canComposeOutfit([piece('top'), piece('bottom'), piece('shoes')])).toBe(true);
    expect(canComposeOutfit([piece('full_body'), piece('shoes')])).toBe(true);
    expect(canComposeOutfit([piece('top'), piece('bottom'), piece('outerwear')])).toBe(false);
  });

  it('ignores unwearable pieces, like the server does', () => {
    expect(canComposeOutfit([
      piece('top'), piece('bottom'), piece('shoes', { isArchived: true }),
    ])).toBe(false);
  });
});
