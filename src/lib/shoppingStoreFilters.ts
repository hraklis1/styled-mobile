import type { ShoppingEditItem } from './shoppingGallery';
import { formatShoppingPlaceLabel, normalizeStoreName, shoppingFilterKey } from './shoppingLocations';

export const STORE_FILTER_ALL = 'all';
export const STORE_FILTER_NONE = 'none';

export type ShoppingStoreLocationOption = {
  value: string;
  label: string;
  itemCount: number;
};

export type ShoppingStoreOption = {
  value: string;
  label: string;
  itemCount: number;
  locations: ShoppingStoreLocationOption[];
};

function byCountThenLabel(
  a: { itemCount: number; label: string },
  b: { itemCount: number; label: string },
): number {
  return b.itemCount - a.itemCount || a.label.localeCompare(b.label);
}

/**
 * Groups shopping finds by store, with a nested location list whenever the same
 * store was visited in more than one place. Most-shopped stores come first so the
 * quick chips and the picker both surface the useful ones without scrolling.
 */
export function buildShoppingStoreOptions(items: ShoppingEditItem[]): ShoppingStoreOption[] {
  const byStore = new Map<string, ShoppingEditItem[]>();
  for (const item of items) {
    if (!item.storeName) continue;
    const key = normalizeStoreName(item.storeName);
    byStore.set(key, [...(byStore.get(key) ?? []), item]);
  }

  return [...byStore.entries()]
    .map(([normalizedStore, storeItems]) => {
      const label = storeItems[0].storeName ?? normalizedStore;
      const byLocation = new Map<string, { label: string; items: ShoppingEditItem[] }>();
      for (const item of storeItems) {
        const key = shoppingFilterKey(item);
        const current = byLocation.get(key)
          ?? { label: formatShoppingPlaceLabel(item), items: [] };
        current.items.push(item);
        byLocation.set(key, current);
      }

      const locations = byLocation.size <= 1
        ? []
        : [...byLocation.entries()]
          .map(([value, location]) => ({
            value,
            label: location.label,
            itemCount: location.items.length,
          }))
          .sort(byCountThenLabel);

      return {
        value: `store:${normalizedStore}`,
        label,
        itemCount: storeItems.length,
        locations,
      };
    })
    .sort(byCountThenLabel);
}

export function countItemsWithoutStore(items: ShoppingEditItem[]): number {
  return items.filter((item) => !item.storeName).length;
}

/**
 * Filters the picker list by a free-text query, matching either the store name or
 * one of its locations. A store matched by name keeps all of its locations.
 */
export function searchShoppingStoreOptions(
  options: ShoppingStoreOption[],
  query: string,
): ShoppingStoreOption[] {
  const normalizedQuery = normalizeStoreName(query);
  if (!normalizedQuery) return options;

  return options.flatMap((option) => {
    if (normalizeStoreName(option.label).includes(normalizedQuery)) return [option];
    const locations = option.locations.filter(
      (location) => normalizeStoreName(location.label).includes(normalizedQuery),
    );
    if (locations.length === 0) return [];
    return [{ ...option, locations }];
  });
}

/**
 * The store options worth showing as one-tap chips: the busiest stores, plus the
 * current selection when it would otherwise fall outside that window.
 */
export function quickShoppingStoreOptions(
  options: ShoppingStoreOption[],
  storeFilter: string,
  limit = 3,
): ShoppingStoreOption[] {
  const quick = options.slice(0, limit);
  if (storeFilter === STORE_FILTER_ALL || storeFilter === STORE_FILTER_NONE) return quick;
  if (quick.some((option) => matchesStoreOption(option, storeFilter))) return quick;
  const selected = options.find((option) => matchesStoreOption(option, storeFilter));
  return selected ? [...quick, selected] : quick;
}

function matchesStoreOption(option: ShoppingStoreOption, storeFilter: string): boolean {
  return option.value === storeFilter
    || option.locations.some((location) => location.value === storeFilter);
}

/**
 * Human label for the active store filter — used by the picker trigger and the
 * selected quick chip so the header always states what is being shown.
 */
export function shoppingStoreFilterLabel(
  options: ShoppingStoreOption[],
  storeFilter: string,
): string {
  if (storeFilter === STORE_FILTER_ALL) return 'All stores';
  if (storeFilter === STORE_FILTER_NONE) return 'Store not set';
  for (const option of options) {
    if (option.value === storeFilter) return option.label;
    const location = option.locations.find((candidate) => candidate.value === storeFilter);
    if (location) return `${option.label} · ${location.label}`;
  }
  return 'All stores';
}
