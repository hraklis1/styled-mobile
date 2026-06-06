import { StylistChatView } from '../../components/stylist/StylistChatView';
import type { StylistScreenProps } from '../../navigation/types';

export function StylistScreen({ route, navigation }: StylistScreenProps) {
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
