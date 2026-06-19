import type { WishlistEntry } from './wishlist';

export function getWishlistContext(entry: WishlistEntry): string | undefined {
  return entry.eventContext?.title?.trim() || entry.outfit.city?.trim() || undefined;
}

export function getWishlistBrands(entry: WishlistEntry): string[] {
  return [...new Set(entry.outfit.items.map((item) => item.brand?.trim()).filter((brand): brand is string => Boolean(brand)))];
}

export function getWishlistItemSummary(entry: WishlistEntry): string {
  const names = entry.outfit.items.map((item) => item.name?.trim()).filter(Boolean);
  if (names.length === 0) return 'No products listed';
  if (names.length <= 2) return names.join(' · ');
  return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`;
}

export function getWishlistTitle(entry: WishlistEntry): string {
  const firstItemName = entry.outfit.items.find((item) => item.name?.trim())?.name.trim();
  return entry.outfit.intro?.trim() || firstItemName || getWishlistContext(entry) || 'Saved outfit';
}

export function getWishlistMeta(entry: WishlistEntry): string {
  const count = entry.outfit.items.length;
  return [`${count} ${count === 1 ? 'item' : 'items'}`, entry.outfit.totalBudget?.trim()].filter(Boolean).join(' · ');
}

export function getWishlistSearchText(entry: WishlistEntry): string {
  return [
    entry.outfit.intro,
    entry.outfit.city,
    entry.outfit.totalBudget,
    entry.eventContext?.title,
    ...entry.outfit.items.flatMap((item) => [item.name, item.brand, item.category, item.priceRange]),
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

export function getWishlistAccessibilityLabel(entry: WishlistEntry): string {
  const itemNames = entry.outfit.items.map((item) => item.name?.trim()).filter(Boolean).join(', ');
  return [
    getWishlistTitle(entry),
    itemNames || getWishlistItemSummary(entry),
    getWishlistMeta(entry),
    getWishlistContext(entry),
  ].filter(Boolean).join(', ');
}
