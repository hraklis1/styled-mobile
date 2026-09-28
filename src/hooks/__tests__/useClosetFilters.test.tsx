import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useClosetFilters } from '../useClosetFilters';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';

const items = [
  { id: 1, name: 'Linen shirt', category: 'top', subcategory: 'T-Shirts', colorNormalized: 'white', createdAt: '2026-01-01', wearCount: 0 },
  { id: 2, name: 'Black trousers', category: 'bottom', colorNormalized: 'black', createdAt: '2026-01-02', wearCount: 2 },
  { id: 3, name: 'Archived shoes', category: 'shoes', isArchived: true, createdAt: '2026-01-03', wearCount: 0 },
] as unknown as Item[];
const outfits = [{ id: 1, name: 'Linen weekend', tags: [], createdAt: '2026-01-01', wearCount: 0 }] as unknown as Outfit[];
const events: never[] = [];
let filters: ReturnType<typeof useClosetFilters>;
let renderer: TestRenderer.ReactTestRenderer;
function Harness({ piecesSearch = '', outfitsSearch = '' }: { piecesSearch?: string; outfitsSearch?: string }) {
  const result = useClosetFilters({ items, outfits, events, piecesSearch, outfitsSearch });
  React.useEffect(() => { filters = result; }, [result]);
  return null;
}
beforeEach(() => { act(() => { renderer = TestRenderer.create(<Harness />); }); });
afterEach(() => { act(() => renderer.unmount()); });

it('keeps piece and outfit searches independent and retains filters across search-context renders', () => {
  act(() => filters.setSelectedColors(['white']));
  act(() => renderer.update(<Harness piecesSearch="shirt" outfitsSearch="missing" />));
  expect(filters.filteredItems.map(item => item.id)).toEqual([1]);
  expect(filters.filteredOutfits).toEqual([]);
  act(() => renderer.update(<Harness piecesSearch="shirt" outfitsSearch="Linen" />));
  expect(filters.filteredOutfits).toHaveLength(1);
  expect(filters.selectedColors).toEqual(['white']);
});
it('counts only filters and independently enables Reset for a custom sort', () => {
  act(() => { filters.setSortKey('oldest'); filters.setOutfitSortKey('oldest'); });
  expect(filters.activeFilterCount).toBe(0);
  expect(filters.outfitActiveFilterCount).toBe(0);
  expect(filters.canResetPieces).toBe(true);
  expect(filters.canResetOutfits).toBe(true);
});
it('clears filters without clearing search or sort; Reset also restores sort', () => {
  act(() => renderer.update(<Harness piecesSearch="shirt" outfitsSearch="Linen" />));
  act(() => { filters.setSortKey('oldest'); filters.setSelectedColors(['black']); filters.setOutfitSortKey('name_asc'); filters.setOutfitShowFavorites(true); });
  act(() => { filters.clearPieceFilters(); filters.clearOutfitFiltersOnly(); });
  expect(filters.sortKey).toBe('oldest');
  expect(filters.outfitSortKey).toBe('name_asc');
  expect(filters.filteredItems.map(item => item.id)).toEqual([1]);
  expect(filters.filteredOutfits).toHaveLength(1);
  act(() => { filters.clearSheetFilters(); filters.clearOutfitFilters(); });
  expect(filters.sortKey).toBe('newest');
  expect(filters.outfitSortKey).toBe('newest');
  expect(filters.canResetPieces).toBe(false);
  expect(filters.filteredItems.map(item => item.id)).toEqual([1]);
});
it('shares multi-category selection, clears incompatible subcategories, and excludes archived categories', () => {
  expect(filters.availableCategories).toEqual(['top', 'bottom']);
  act(() => filters.setSelectedCategories(['top']));
  act(() => filters.setActiveSubcategory('T-Shirts'));
  expect(filters.filteredItems.map(item => item.id)).toEqual([1]);
  act(() => filters.setSelectedCategories(['top', 'bottom']));
  expect(filters.activeSubcategory).toBeNull();
  expect(filters.availableSubcategories).toEqual([]);
  expect(filters.filteredItems).toHaveLength(2);
});
it('keeps sort order and excludes archives with partial queries', () => {
  act(() => renderer.update(<Harness piecesSearch="r" />));
  expect(filters.filteredItems.map(i => i.id)).toEqual([2, 1]);
  act(() => filters.setSortKey('oldest'));
  expect(filters.filteredItems.map(i => i.id)).toEqual([1, 2]);
});
it('computes category recovery under the remaining filters', () => {
  act(() => { filters.setSelectedCategories(['top']); filters.setSelectedColors(['black']); });
  act(() => renderer.update(<Harness piecesSearch="pants" />));
  expect(filters.filteredItems).toEqual([]);
  expect(filters.categoryRecoveryCount).toBe(1);
  act(() => filters.setSelectedColors(['white']));
  expect(filters.categoryRecoveryCount).toBe(0);
});
