import {
  categoryForSubcategories,
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

  it('counts sort, category, subcategory, and advanced filters', () => {
    expect(countActivePieceFilters({
      hasNonDefaultSort: true,
      selectedGroups: [['top', 'shoes'], ['black'], []],
      activeSubcategory: 'T-Shirts',
    })).toBe(5);
  });

  it('recognizes search and sheet filters as active', () => {
    expect(hasActivePieceFilters(' linen ', 0)).toBe(true);
    expect(hasActivePieceFilters('', 2)).toBe(true);
    expect(hasActivePieceFilters('  ', 0)).toBe(false);
  });
});
