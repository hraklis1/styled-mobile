import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList, SavedShoppingTab } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Used after dismissing the contextual Stylist modal. */
export function openSavedRecommendations(selectedId?: string, tab: SavedShoppingTab = 'all') {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('App', {
    screen: 'Stylist',
    params: { screen: 'StylistMain', params: { view: 'saved', tab, selectedId } },
  });
}
