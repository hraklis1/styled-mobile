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
  selectedGroups,
  activeSubcategory,
}: {
  selectedGroups: ReadonlyArray<readonly unknown[]>;
  activeSubcategory: string | null;
}): number {
  return selectedGroups.reduce((total, group) => total + group.length, 0)
    + (activeSubcategory ? 1 : 0);
}

export function hasActivePieceFilters(search: string, activeFilterCount: number): boolean {
  return search.trim().length > 0 || activeFilterCount > 0;
}

export function wearHistoryLabel(wearCount: number): string {
  return wearCount > 0 ? `Worn ${wearCount} ${wearCount === 1 ? 'time' : 'times'}` : 'Never worn';
}

export type ClosetAnchor = { id: number; index: number; offset: number; scrollY: number; columns?: number };

export function resolveClosetAnchor(items: readonly { id: number }[], anchor: ClosetAnchor | null, columns: number) {
  if (!anchor || !items.length) return null;
  const found = items.findIndex(item => item.id === anchor.id);
  const index = found >= 0 ? found : Math.min(anchor.index, items.length - 1);
  return { index: index - index % columns, offset: anchor.offset, scrollY: anchor.scrollY };
}

// FlashList v2 adds viewOffset to the target scroll offset (unlike RN's
// FlatList). A negative value places the anchor below our pinned header.
export function closetAnchorViewOffset(pinnedHeight: number, offset: number): number {
  return -(pinnedHeight + offset);
}

export function closetOffsetForLayout(offset: number, oldColumns: number | undefined, columns: number, rowHeight: number): number {
  // A tall grid card's cropped portion must not hide an entire shorter list row.
  return oldColumns !== undefined && oldColumns !== columns
    ? Math.max(offset, -Math.max(0, rowHeight - 44))
    : offset;
}
