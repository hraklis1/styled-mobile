import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList, SavedShoppingTab, WishlistSection } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function wishlistSectionFromLegacy(tab: SavedShoppingTab = 'all'): WishlistSection {
  return tab === 'looks' || tab === 'lists' ? 'lists' : 'products';
}

export function openWishlist(selectedId?: string, section: WishlistSection = 'products', returnTo?: 'Stylist' | 'stylist-modal') {
  if (!navigationRef.isReady()) return;
  const origin = returnTo ?? (navigationRef.getCurrentRoute()?.name === 'StylistMain' ? 'Stylist' : undefined);
  navigationRef.navigate('App', {
    screen: 'Shop',
    params: { screen: 'Wishlist', params: { section, selectedId, returnTo: origin } },
  });
}

/** Compatibility for old callers and saved links. */
export function openSavedRecommendations(selectedId?: string, tab: SavedShoppingTab = 'all') {
  openWishlist(selectedId, wishlistSectionFromLegacy(tab));
}

export function openClosetItem(itemId: number, resumeStylist = false) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('App', { screen: 'Closet', params: { screen: 'ItemDetail', params: { itemId, resumeStylist } } });
}

export function openClosetOutfit(outfitId: number, resumeStylist = false) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('App', { screen: 'Closet', params: { screen: 'OutfitDetail', params: { outfitId, resumeStylist } } });
}
