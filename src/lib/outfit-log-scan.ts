import { ITEM_CATEGORIES, type ItemCategory } from '../types/item';

export function normalizeScanCategory(value: string | null | undefined): ItemCategory {
  const normalized = value?.trim().toLowerCase();
  return ITEM_CATEGORIES.includes(normalized as ItemCategory)
    ? normalized as ItemCategory
    : 'top';
}

export function mergeUniqueItemIds(current: number[], additions: number[]): number[] {
  return Array.from(new Set([...current, ...additions]));
}
