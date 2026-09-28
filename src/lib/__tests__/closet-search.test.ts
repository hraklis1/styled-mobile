import { addRecentSearch, addSearchFilter, combineSearchFilters, matchesSearch, pieceSearchRecord, searchRecord } from '../closet-search';
import type { Item } from '../../types/item';

it('matches across clothing attributes, accents and punctuation without requiring a name match', () => {
  const record = pieceSearchRecord({ name: 'Everyday', brand: 'Sézane', colorNormalized: 'black', material: 'Linen', subcategory: 'Pants' } as Item);
  expect(matchesSearch(record, ' black, LINEN trousers ')).toBe(true);
  expect(matchesSearch(record, 'seza lin')).toBe(true);
  expect(matchesSearch(record, 'black silk')).toBe(false);
  expect(matchesSearch(pieceSearchRecord({ name: 'Simple' } as Item), 'simple')).toBe(true);
});
it.each([['pants', 'trousers'], ['sneakers', 'trainers'], ['gray', 'grey'], ['tee', 't-shirt'], ['sweater', 'jumper']])('matches %s and %s in either direction', (a, b) => {
  expect(matchesSearch(searchRecord([a]), b)).toBe(true);
  expect(matchesSearch(searchRecord([b]), a)).toBe(true);
});
it('deduplicates and caps recent searches while ignoring empty input', () => {
  const recent = ['a', 'b', 'c', 'd', 'e', 'f'].reduce(addRecentSearch, [] as string[]);
  expect(recent).toEqual(['f', 'e', 'd', 'c', 'b']);
  expect(addRecentSearch(recent, ' B ')).toEqual(['B', 'f', 'e', 'd', 'c']);
  expect(addRecentSearch(recent, ' ')).toBe(recent);
});
it('adds search filters by normalized identity and combines draft with submitted terms', () => {
  const filters = addSearchFilter(['LINEN'], ' línen!!! ');
  expect(filters).toEqual(['LINEN']);
  expect(addSearchFilter(filters, 'black')).toEqual(['LINEN', 'black']);
  expect(addSearchFilter(filters, '---')).toBe(filters);
  expect(combineSearchFilters(['linen', 'black'], 'cotton')).toBe('linen black cotton');
  expect(['linen black', 'cotton'].every(query => matchesSearch(searchRecord(['black linen cotton trousers']), query))).toBe(true);
});
