jest.mock('../api', () => ({ API_BASE_URL: 'https://api.styled.test' }));

import {
  buildBoardStylistPrompt,
  filterBoardFeed,
  getBoardCoverUris,
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
  storeFinds: [{ id: 'find-1', createdAt: '', imageUrl: null, imageUrls: [], location: null, description: null, store: null, brand: null, price: null, size: null, notes: null }],
  createdAt: '',
};

const makeItem = (id: number, name: string, imageUrl: string | null, category: Item['category'], colors: string[]): Item => ({
  id, name, imageUrl, category, colorPalette: colors, colorNormalized: colors[0] ?? null,
  userId: 1, color: null, colorTemperature: null, subcategory: null, brand: null, style: null,
  seasons: [], occasions: [], material: null, fit: null, pattern: null, neckline: null, sleeveLength: null,
  tags: [], formalityStyles: [], notableDetails: [], notes: null, care: null, condition: null, warmthRating: null,
  purchasePrice: null, purchaseDate: null, wearCount: 0, lastWornAt: null, isFavorite: false, isArchived: false, createdAt: '',
});

const item = makeItem(1, 'Navy blazer', 'https://example.com/blazer.jpg', 'outerwear', ['#25324A']);
const feed: BoardFeedItem[] = [{ kind: 'item', key: 'i1', item }];

describe('board presentation', () => {
  it('counts every supported saved type', () => {
    expect(getBoardSavedCount(board)).toBe(5);
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

  it('makes AI output advisory and handles insufficient content', () => {
    expect(buildBoardStylistPrompt(board.name, feed, 'outfit')).toContain('Navy blazer');
    expect(buildBoardStylistPrompt(board.name, feed, 'outfit')).toContain('Do not modify the board');
    expect(buildBoardStylistPrompt(board.name, [], 'complete')).toContain('does not have enough closet pieces');
  });
});
