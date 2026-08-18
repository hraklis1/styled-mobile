import type { WishlistEntry } from './wishlist';
import { getWishlistRecommendationType } from './wishlistType';

export function getWishlistContext(entry: WishlistEntry): string | undefined {
  if (entry.outfit.shoppingBrief) return 'Shopping Brief';
  return entry.eventContext?.title?.trim() || entry.outfit.city?.trim() || undefined;
}

export function getWishlistBrands(entry: WishlistEntry): string[] {
  return [...new Set(entry.outfit.items.map((item) => item.brand?.trim()).filter((brand): brand is string => Boolean(brand)))];
}

export function getWishlistItemSummary(entry: WishlistEntry): string {
  if (entry.outfit.shoppingBrief) return `${entry.outfit.shoppingBrief.targets.length} shopping targets`;
  const names = entry.outfit.items.map((item) => item.name?.trim()).filter(Boolean);
  if (names.length === 0) return 'No products listed';
  if (names.length <= 2) return names.join(' · ');
  return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`;
}

export function getWishlistTitle(entry: WishlistEntry): string {
  if (entry.outfit.shoppingBrief) return entry.outfit.shoppingBrief.headline;
  const firstItemName = entry.outfit.items.find((item) => item.name?.trim())?.name.trim();
  const type = getWishlistRecommendationType(entry);
  const fallback = type === 'piece' ? 'Saved piece' : type === 'list' ? 'Saved list' : 'Saved look';
  return entry.outfit.intro?.trim() || firstItemName || getWishlistContext(entry) || fallback;
}

function getFirstSentence(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  const sentence = normalized.match(/^(.+?[.!?])(?:\s|$)/)?.[1];
  return sentence ?? normalized;
}

/**
 * Board tiles need an editorial product name rather than the stylist's full
 * rationale. The complete intro remains available in the detail sheet and
 * accessibility label.
 */
export function getWishlistBoardTitle(entry: WishlistEntry): string {
  const firstItemName = entry.outfit.items.find((item) => item.name?.trim())?.name.trim();
  if (firstItemName) return firstItemName;

  const intro = entry.outfit.intro?.trim();
  if (intro) return getFirstSentence(intro);

  return getWishlistContext(entry) || getWishlistBoardLabel(entry);
}

export function getWishlistBoardLabel(entry: WishlistEntry): string {
  return getWishlistRecommendationType(entry) === 'piece' ? 'Saved piece' : 'Shopping edit';
}

export function getWishlistMeta(entry: WishlistEntry): string {
  if (entry.outfit.shoppingBrief) return `${entry.outfit.shoppingBrief.targets.length} options`;
  const count = entry.outfit.items.length;
  const type = getWishlistRecommendationType(entry);
  const countLabel = type === 'piece' ? '1 piece' : type === 'list' ? `${count} ${count === 1 ? 'option' : 'options'}` : `${count} ${count === 1 ? 'item' : 'items'}`;
  return [countLabel, entry.outfit.totalBudget?.trim()].filter(Boolean).join(' · ');
}

export function getWishlistSearchText(entry: WishlistEntry): string {
  const editText = entry.outfit.shoppingBrief ? [
    entry.outfit.shoppingBrief.priority.label,
    entry.outfit.shoppingBrief.priority.category,
    entry.outfit.shoppingBrief.summary,
    ...entry.outfit.shoppingBrief.targets.flatMap((target) => [target.title, target.category, target.color, target.material, target.silhouette]),
  ] : [];
  return [
    entry.outfit.intro,
    entry.outfit.city,
    entry.outfit.totalBudget,
    entry.eventContext?.title,
    ...entry.outfit.items.flatMap((item) => [item.name, item.brand, item.category, item.priceRange]),
    ...editText,
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
  if (entry.outfit.shoppingBrief) return 'Saved edit';
  const type = getWishlistRecommendationType(entry);
  return type === 'piece' ? 'Saved piece' : type === 'list' ? 'Saved list' : 'Saved look';
}
