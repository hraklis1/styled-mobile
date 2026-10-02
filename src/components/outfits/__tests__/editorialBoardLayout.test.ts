jest.mock('../../../lib/api', () => ({ API_BASE_URL: 'https://example.com' }));
import { boardPhotoUri, editorialBoardDisplayRows, editorialBoardRows, resolveBoardPieces } from '../editorialBoardLayout';
import type { Item } from '../../../types/item';
const pieces = (...categories: string[]) => categories.map((category, id) => ({ id, category }));
const item = (fields: Partial<Item>) => ({ id: 1, ...fields }) as Item;
test('centres a single foundation and separates accessories', () => {
  const rows = editorialBoardRows(pieces('accessory', 'full_body', 'shoes'));
  expect(rows.map(row => [row.foundation, row.pieces.length])).toEqual([[true, 1], [false, 2]]);
});
test('uses top and bottom before a supporting coat', () => {
  expect(editorialBoardRows(pieces('outerwear', 'shoes', 'bottom', 'top'))[0].pieces.map(p => p.category)).toEqual(['top', 'bottom']);
});
test.each([1, 2, 3, 4, 5, 6, 7, 10])('never loses pieces at count %i', count => {
  const input = pieces('top', 'bottom', ...Array(Math.max(0, count - 2)).fill('accessory')).slice(0, count);
  const rows = editorialBoardRows(input);
  expect(rows.flatMap(row => row.pieces)).toHaveLength(count);
  expect(rows.every(row => row.pieces.length > 0 && row.pieces.length <= 3)).toBe(true);
});
test('balances four and five supporting pieces', () => {
  expect(editorialBoardRows(pieces(...Array(4).fill('accessory'))).map(r => r.pieces.length)).toEqual([2, 2]);
  expect(editorialBoardRows(pieces(...Array(5).fill('accessory'))).map(r => r.pieces.length)).toEqual([3, 2]);
  expect(editorialBoardRows([])).toEqual([]);
});
test('respects polish and never falls back to cutouts', () => {
  expect(boardPhotoUri(item({ coverImageVariant: 'polished', polishedUrl: 'https://example.com/p.jpg' }))).toBe('https://example.com/p.jpg');
  expect(boardPhotoUri(item({ coverImageVariant: 'cutout', cutoutUrl: 'https://example.com/c.png', imageUrl: 'https://example.com/o.jpg' }))).toBe('https://example.com/o.jpg');
  expect(boardPhotoUri(item({ cutoutUrl: 'https://example.com/c.png' }))).toBeUndefined();
});
test('resolves wardrobe categories and retains unavailable entries', () => {
  expect(resolveBoardPieces([{ id: 1, category: 'top' }, { id: 2, category: 'bottom' }], [item({ category: 'outerwear' })]).map(p => p.category)).toEqual(['outerwear', 'bottom']);
});

describe('suggested addition layout', () => {
  const suggestion = { label: 'Weatherproof layer', category: 'outerwear' };
  test('pairs shoes with the suggestion while preserving top and bottom', () => {
    const rows = editorialBoardDisplayRows(pieces('top', 'bottom', 'shoes'), suggestion);
    expect(rows[0].foundation).toBe(true);
    expect(rows[0].pieces.map(tile => tile.kind === 'owned' && tile.piece.category)).toEqual(['top', 'bottom']);
    expect(rows[1].pieces.map(tile => tile.kind)).toEqual(['owned', 'suggestion']);
    expect(rows[1].pieces[1]).toEqual({ kind: 'suggestion', suggestion });
    expect(rows[1].pieces[1]).not.toHaveProperty('id');
  });
  test('retains a single foundation and balances supporting rows', () => {
    const rows = editorialBoardDisplayRows(pieces('dress', 'shoes', 'bag', 'accessory'), suggestion);
    expect(rows.map(row => [row.foundation, row.pieces.length])).toEqual([[true, 1], [false, 2], [false, 2]]);
    expect(rows.flatMap(row => row.pieces).filter(tile => tile.kind === 'owned')).toHaveLength(4);
  });
  test('preserves existing layout when no suggestion is provided', () => {
    const input = pieces('top', 'bottom', 'outerwear', 'shoes', 'bag');
    expect(editorialBoardDisplayRows(input).map(row => ({ ...row, pieces: row.pieces.map(tile => tile.kind === 'owned' && tile.piece) }))).toEqual(editorialBoardRows(input));
  });
  test('renders a suggestion even without any resolved foundation entries', () => {
    expect(editorialBoardDisplayRows([], suggestion)).toEqual([{ foundation: false, pieces: [{ kind: 'suggestion', suggestion }] }]);
  });
});
