import type { WishlistEntry } from './wishlist';
import type { ShopRecommendationType } from '../types/shop';

export function getWishlistRecommendationType(entry: WishlistEntry): ShopRecommendationType {
  if (entry.recommendationType === 'look' || entry.recommendationType === 'piece' || entry.recommendationType === 'list') {
    return entry.recommendationType;
  }
  if (entry.outfit.recommendationType) return entry.outfit.recommendationType;

  // Legacy fallback only. New records always carry the server-assigned type.
  if (entry.outfit.items.length === 1) return 'piece';
  const categories = new Set(entry.outfit.items.map((item) => item.category?.trim().toLocaleLowerCase()).filter(Boolean));
  if (categories.size === 1) return 'list';
  return 'look';
}
