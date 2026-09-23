jest.mock('../api', () => ({ API_BASE_URL: 'https://api.styled.test' }));

import {
  getBoardCoverUris,
  getBoardContentSummary,
  getBoardFilterCount,
  getBoardInsights,
  getBoardPieces,
  getBoardSavedCount,
  parseBoardEntryKeys,
  withoutBoardEntries,
  shouldShowBoardSearch,
} from '../boardPresentation';
import type { Board } from '../../types/board';
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

  it('returns no cover sources for an empty board', () => {
    expect(getBoardCoverUris({ ...board, coverImageUrl: null, itemIds: [], outfitIds: [], wishlistIds: [] }, new Map(), new Map())).toEqual([]);
  });

  it('fills a wishlist-only cover from saved product imagery', () => {
    const wishlist = new Map([['wish-1', {
      id: 'wish-1',
      outfit: { items: [{ imageUrl: 'https://example.com/shop-1.jpg' }, { imageUrl: 'https://example.com/shop-2.jpg' }] },
    } as never]]);

    expect(getBoardCoverUris({ ...board, coverImageUrl: null, itemIds: [], outfitIds: [], wishlistIds: ['wish-1'] }, new Map(), new Map(), wishlist)).toEqual([
      'https://example.com/shop-1.jpg',
      'https://example.com/shop-2.jpg',
    ]);
  });

  it('derives fashion insights from saved pieces', () => {
    expect(getBoardInsights([item])).toEqual({ colors: ['#25324A'], categories: [['Outerwear', 1]] });
  });

  it('counts filter chips from board membership, not loaded pages', () => {
    expect(getBoardFilterCount(board, 'all')).toBe(4);
    expect(getBoardFilterCount(board, 'item')).toBe(2);
    expect(getBoardFilterCount(board, 'outfit')).toBe(1);
    expect(getBoardFilterCount(board, 'wishlist')).toBe(1);
  });

  it('resolves every saved piece from the closet in board order, skipping ghosts', () => {
    const second = { ...item, id: 2 };
    expect(getBoardPieces({ itemIds: [2, 99, 1] }, [item, second]).map((piece) => piece.id)).toEqual([2, 1]);
  });

  it('round-trips selection keys and removes them from a board', () => {
    const refs = parseBoardEntryKeys(['i1', 'o3', 'wwish-1']);
    expect(refs).toEqual([
      { type: 'item', id: 1 },
      { type: 'outfit', id: 3 },
      { type: 'wishlist', id: 'wish-1' },
    ]);
    expect(withoutBoardEntries(board, refs)).toEqual({ itemIds: [2], outfitIds: [], wishlistIds: [] });
  });
});

