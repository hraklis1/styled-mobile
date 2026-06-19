import type { WishlistEntry } from './wishlist';

export type WishlistScope = 'all' | 'event' | 'general';
export type WishlistSortOrder = 'newest' | 'oldest';

export type WishlistFilters = {
  query: string;
  scope: WishlistScope;
  categories: string[];
  cities: string[];
  brands: string[];
  sortOrder: WishlistSortOrder;
};

export type WishlistFilterOptions = {
  categories: string[];
  cities: string[];
  brands: string[];
};

function normalize(value?: string | null) {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function includesAny(selected: string[], values: string[]) {
  if (selected.length === 0) return true;
  const normalizedValues = new Set(values.map(normalize));
  return selected.some((value) => normalizedValues.has(normalize(value)));
}

export function getWishlistFilterOptions(entries: WishlistEntry[]): WishlistFilterOptions {
  const categories = new Set<string>();
  const cities = new Set<string>();
  const brands = new Set<string>();

  for (const entry of entries) {
    const city = entry.outfit.city?.trim();
    if (city) cities.add(city);
    for (const item of entry.outfit.items) {
      const category = item.category?.trim();
      const brand = item.brand?.trim();
      if (category) categories.add(category);
      if (brand) brands.add(brand);
    }
  }

  const sort = (values: Set<string>) => [...values].sort((a, b) => a.localeCompare(b));
  return { categories: sort(categories), cities: sort(cities), brands: sort(brands) };
}

export function filterWishlist(entries: WishlistEntry[], filters: WishlistFilters) {
  const query = normalize(filters.query);

  return entries
    .filter((entry) => {
      if (filters.scope === 'event' && !entry.eventContext) return false;
      if (filters.scope === 'general' && entry.eventContext) return false;

      const outfit = entry.outfit;
      if (!includesAny(filters.cities, [outfit.city])) return false;
      if (!includesAny(filters.categories, outfit.items.map((item) => item.category))) return false;
      if (!includesAny(filters.brands, outfit.items.map((item) => item.brand))) return false;

      if (!query) return true;
      const searchable = [
        outfit.intro,
        outfit.city,
        outfit.totalBudget,
        entry.eventContext?.title,
        ...outfit.items.flatMap((item) => [
          item.name,
          item.brand,
          item.category,
          item.whyItFitsYou,
        ]),
      ];
      return searchable.some((value) => normalize(value).includes(query));
    })
    .sort((a, b) => {
      const difference = new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
      return filters.sortOrder === 'newest' ? difference : -difference;
    });
}

export function countWishlistFilters(filters: WishlistFilters) {
  return (
    (filters.scope === 'all' ? 0 : 1) +
    filters.categories.length +
    filters.cities.length +
    filters.brands.length +
    (filters.sortOrder === 'newest' ? 0 : 1)
  );
}
