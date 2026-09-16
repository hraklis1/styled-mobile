import type { ShoppingEditItem } from './shoppingGallery';
export type ShoppingBrowseFilters = {
  query: string;
  favorites: boolean;
  category: string;
  currency: string;
  min: string;
  max: string;
  oldest: boolean;
};
export function browseShoppingItems(
  items: ShoppingEditItem[],
  filters: ShoppingBrowseFilters,
) {
  const terms = filters.query
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return items
    .filter((item) => {
      const haystack = [
        item.productName,
        item.brand,
        item.storeName,
        item.category,
        item.productCode,
        item.notes,
        item.colorLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return (
        terms.every((term) => haystack.includes(term)) &&
        (!filters.favorites || item.isFavorite) &&
        (!filters.category || item.category === filters.category) &&
        (!filters.currency || item.currencyCode === filters.currency) &&
        (!filters.currency ||
          !filters.min ||
          (item.extractedPrice != null &&
            item.extractedPrice >= Number(filters.min))) &&
        (!filters.currency ||
          !filters.max ||
          (item.extractedPrice != null &&
            item.extractedPrice <= Number(filters.max)))
      );
    })
    .sort(
      (a, b) =>
        (filters.oldest ? 1 : -1) *
        (Date.parse(a.capturedAt) - Date.parse(b.capturedAt)),
    );
}
