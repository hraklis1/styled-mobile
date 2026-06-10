import { useEffect } from 'react';
import { StylistChatView } from '../../components/stylist/StylistChatView';
import { track } from '../../lib/analytics';
import type { StylistScreenProps } from '../../navigation/types';

export function StylistScreen({ route, navigation }: StylistScreenProps) {
  useEffect(() => {
    track('stylist_opened');
  }, []);

  function handleNavigateToShop() {
    navigation.goBack();
    // Navigate to the Shop tab via the parent tab navigator
    navigation.getParent<any>()?.navigate('Shop');
  }

  return (
    <StylistChatView
      initialQuery={route.params?.query}
      onClose={() => navigation.goBack()}
      onNavigateToShop={handleNavigateToShop}
    />
  );
}
