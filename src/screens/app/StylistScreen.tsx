import { StylistChatView } from '../../components/stylist/StylistChatView';
import type { StylistScreenProps } from '../../navigation/types';

export function StylistScreen({ route, navigation }: StylistScreenProps) {
  return (
    <StylistChatView
      initialQuery={route.params?.query}
      onClose={() => navigation.goBack()}
    />
  );
}
