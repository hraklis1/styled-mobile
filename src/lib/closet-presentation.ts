import { CATEGORY_LABELS, type Item, type ItemCategory } from '../types/item';

type ItemSummary = Pick<Item, 'name' | 'brand' | 'category' | 'colorNormalized'>;

export function getItemSecondaryLabel(
  item: Pick<ItemSummary, 'brand' | 'category'>,
): string | null {
  const category = item.category ? CATEGORY_LABELS[item.category] : null;
  return [item.brand?.trim() || null, category].filter(Boolean).join(' · ') || null;
}

export function getItemCardAccessibilityLabel(item: ItemSummary): string {
  return [
    item.name || 'Unnamed item',
    getItemSecondaryLabel(item),
    item.colorNormalized ? `${item.colorNormalized} color` : null,
  ].filter(Boolean).join(', ');
}

export function categoryForSubcategories(
  selectedCategories: readonly string[],
): ItemCategory | null {
  return selectedCategories.length === 1
    ? selectedCategories[0] as ItemCategory
    : null;
}

export function itemMatchesSelectedCategories(
  itemCategory: ItemCategory | null,
  selectedCategories: readonly string[],
): boolean {
  return selectedCategories.length === 0
    || (itemCategory !== null && selectedCategories.includes(itemCategory));
}

export function shouldClearActiveSubcategory(
  previousCategories: readonly string[],
  nextCategories: readonly string[],
): boolean {
  return categoryForSubcategories(previousCategories)
    !== categoryForSubcategories(nextCategories);
}

export function countActivePieceFilters({
  hasNonDefaultSort,
  selectedGroups,
  activeSubcategory,
}: {
  hasNonDefaultSort: boolean;
  selectedGroups: ReadonlyArray<readonly unknown[]>;
  activeSubcategory: string | null;
}): number {
  return (hasNonDefaultSort ? 1 : 0)
    + selectedGroups.reduce((total, group) => total + group.length, 0)
    + (activeSubcategory ? 1 : 0);
}

export function hasActivePieceFilters(search: string, activeFilterCount: number): boolean {
  return search.trim().length > 0 || activeFilterCount > 0;
}
