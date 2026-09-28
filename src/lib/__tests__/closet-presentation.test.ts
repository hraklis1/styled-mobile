import {
  categoryForSubcategories,
  resolveClosetAnchor, wearHistoryLabel, closetAnchorViewOffset, closetOffsetForLayout,
  countActivePieceFilters,
  getItemCardAccessibilityLabel,
  getItemSecondaryLabel,
  hasActivePieceFilters,
  itemMatchesSelectedCategories,
  shouldClearActiveSubcategory,
} from '../closet-presentation';

describe('closet presentation', () => {
  it('formats editorial metadata with useful fallbacks', () => {
    expect(getItemSecondaryLabel({ brand: 'COS', category: 'top' })).toBe('COS · Tops');
    expect(getItemSecondaryLabel({ brand: null, category: 'shoes' })).toBe('Shoes');
    expect(getItemSecondaryLabel({ brand: 'Aritzia', category: null })).toBe('Aritzia');
    expect(getItemSecondaryLabel({ brand: null, category: null })).toBeNull();
  });

  it('includes color and metadata in a garment accessibility label', () => {
    expect(getItemCardAccessibilityLabel({
      name: 'Crewneck',
      brand: 'COS',
      category: 'top',
      colorNormalized: 'gray',
    })).toBe('Crewneck, COS · Tops, gray color');
  });

  it('treats selected categories as a union', () => {
    const selected = ['top', 'shoes'];
    expect(itemMatchesSelectedCategories('top', selected)).toBe(true);
    expect(itemMatchesSelectedCategories('shoes', selected)).toBe(true);
    expect(itemMatchesSelectedCategories('bottom', selected)).toBe(false);
    expect(itemMatchesSelectedCategories(null, selected)).toBe(false);
    expect(itemMatchesSelectedCategories(null, [])).toBe(true);
  });

  it('only exposes subcategories for one selected category', () => {
    expect(categoryForSubcategories(['top'])).toBe('top');
    expect(categoryForSubcategories([])).toBeNull();
    expect(categoryForSubcategories(['top', 'bottom'])).toBeNull();
    expect(shouldClearActiveSubcategory(['top'], ['top', 'bottom'])).toBe(true);
    expect(shouldClearActiveSubcategory(['top'], ['top'])).toBe(false);
  });

  it('counts category, subcategory, and advanced filters without sort', () => {
    expect(countActivePieceFilters({
      selectedGroups: [['top', 'shoes'], ['black'], []],
      activeSubcategory: 'T-Shirts',
    })).toBe(4);
  });

  it('recognizes search and sheet filters as active', () => {
    expect(hasActivePieceFilters(' linen ', 0)).toBe(true);
    expect(hasActivePieceFilters('', 2)).toBe(true);
    expect(hasActivePieceFilters('  ', 0)).toBe(false);
  });
});


describe('closet browsing context', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const anchor = { id: 4, index: 3, offset: -12, scrollY: 400 };
  it('keeps the garment and offset, aligning grid restoration to its row', () => {
    expect(resolveClosetAnchor(items, anchor, 1)).toEqual({ index: 3, offset: -12, scrollY: 400 });
    expect(resolveClosetAnchor(items, anchor, 2)?.index).toBe(2);
    expect(resolveClosetAnchor([{ id: 4 }, { id: 1 }], anchor, 1)?.index).toBe(0);
  });
  it('uses the nearest surviving position when an item disappears', () => {
    expect(resolveClosetAnchor(items.slice(0, 3), anchor, 1)?.index).toBe(2);
    expect(resolveClosetAnchor([], anchor, 2)).toBeNull();
    expect(resolveClosetAnchor(items, null, 1)).toBeNull();
  });
  it('formats useful wear history without fabricating dates', () => {
    expect(wearHistoryLabel(0)).toBe('Never worn');
    expect(wearHistoryLabel(1)).toBe('Worn 1 time');
    expect(wearHistoryLabel(8)).toBe('Worn 8 times');
  });
});

it('restores an anchor relative to the pinned header with FlashList v2 offset semantics', () => {
  const itemY = 600;
  const pinnedHeight = 132;
  const offset = -20;
  const targetScrollY = itemY + closetAnchorViewOffset(pinnedHeight, offset);
  expect(itemY - targetScrollY - pinnedHeight).toBe(offset);
});

it('keeps the anchor garment visible when a tall grid card becomes a short list row', () => {
  expect(closetOffsetForLayout(-200, 2, 1, 96)).toBe(-52);
  expect(closetOffsetForLayout(-200, 2, 2, 300)).toBe(-200);
  expect(closetOffsetForLayout(20, 2, 1, 96)).toBe(20);
});
