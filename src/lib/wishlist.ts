import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ShopOutfit } from '../types/shop';

const WISHLIST_KEY = 'styled_wishlist';

export type WishlistEntry = {
  id: string;
  savedAt: string;
  outfit: ShopOutfit;
};

export async function loadWishlist(): Promise<WishlistEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(WISHLIST_KEY);
    return raw ? (JSON.parse(raw) as WishlistEntry[]) : [];
  } catch {
    return [];
  }
}

export async function addToWishlist(outfit: ShopOutfit): Promise<WishlistEntry> {
  const list = await loadWishlist();
  const entry: WishlistEntry = {
    id: Math.random().toString(36).slice(2),
    savedAt: new Date().toISOString(),
    outfit,
  };
  list.unshift(entry);
  await AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
  return entry;
}

export async function removeFromWishlist(id: string): Promise<void> {
  const list = await loadWishlist();
  await AsyncStorage.setItem(
    WISHLIST_KEY,
    JSON.stringify(list.filter((e) => e.id !== id)),
  );
}
