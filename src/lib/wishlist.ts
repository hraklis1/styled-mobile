import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ShopOutfit } from '../types/shop';

const WISHLIST_KEY = 'styled_wishlist';

export type WishlistEntry = {
  id: string;
  savedAt: string;
  outfit: ShopOutfit;
  /** Set when saved from the stylist while planning a specific calendar event. */
  eventContext?: { id: number; title: string } | null;
};

/**
 * Reads the legacy on-device wishlist. The wishlist now lives server-side (see
 * hooks/useWishlist); this is retained only as the source for the one-time
 * migration in lib/wishlistSync. Do not use for new reads/writes.
 */
export async function loadLocalWishlist(): Promise<WishlistEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(WISHLIST_KEY);
    return raw ? (JSON.parse(raw) as WishlistEntry[]) : [];
  } catch {
    return [];
  }
}
