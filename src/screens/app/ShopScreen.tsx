import { useEffect } from 'react';
import type { SavedLooksScreenProps, SavedShoppingScreenProps, SavedShoppingTab } from '../../navigation/types';

/** Compatibility routes: the library now belongs to Stylist. */
function useSavedRedirect(navigation: SavedShoppingScreenProps['navigation'], tab: SavedShoppingTab, selectedId?: string) {
  useEffect(() => {
    navigation.getParent()?.navigate('Stylist', {
      screen: 'StylistMain', params: { view: 'saved', tab, selectedId },
    });
    navigation.replace('ShopMain', { view: 'for-you' });
  }, [navigation, selectedId, tab]);
}

export function SavedShoppingScreen({ navigation, route }: SavedShoppingScreenProps) {
  useSavedRedirect(navigation, route.params?.tab ?? 'all', route.params?.selectedId);
  return null;
}

export function SavedLooksScreen({ navigation, route }: SavedLooksScreenProps) {
  useSavedRedirect(navigation as SavedShoppingScreenProps['navigation'], 'looks', route.params?.selectedId);
  return null;
}
