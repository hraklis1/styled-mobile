import type { WishlistEntry } from './wishlist';
import { getWishlistRecommendationType } from './wishlistType';

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
  const type = getWishlistRecommendationType(entry);
  const fallback = type === 'piece' ? 'Saved piece' : type === 'list' ? 'Saved list' : 'Saved look';
  return entry.outfit.intro?.trim() || firstItemName || getWishlistContext(entry) || fallback;
}

export function getWishlistMeta(entry: WishlistEntry): string {
  const count = entry.outfit.items.length;
  const type = getWishlistRecommendationType(entry);
  const countLabel = type === 'piece' ? '1 piece' : type === 'list' ? `${count} ${count === 1 ? 'option' : 'options'}` : `${count} ${count === 1 ? 'item' : 'items'}`;
  return [countLabel, entry.outfit.totalBudget?.trim()].filter(Boolean).join(' · ');
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

export function getWishlistTypeLabel(entry: WishlistEntry): string {
  const type = getWishlistRecommendationType(entry);
  return type === 'piece' ? 'Saved piece' : type === 'list' ? 'Saved list' : 'Saved look';
}
