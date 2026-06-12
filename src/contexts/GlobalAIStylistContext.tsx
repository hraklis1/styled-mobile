import { createContext, useCallback, useContext, useState } from 'react';
import { Alert, Modal, View, StyleSheet } from 'react-native';

import { StylistChatView } from '../components/stylist/StylistChatView';
import { useEntitlement } from '../hooks/useEntitlement';
import { track } from '../lib/analytics';
import { presentPaywall } from '../lib/paywall';

// ─── Context ──────────────────────────────────────────────────────────────────

export type StylistOpenSource =
  | 'center_tab'
  | 'home_prompt'
  | 'shop'
  | 'item_detail'
  | 'outfit_detail'
  | 'event_detail'
  | 'calendar_card'
  | 'calendar_hero'
  | 'closet_selection';

type OpenStylistOptions = {
  initialQuery?: string;
  source: StylistOpenSource;
};

type GlobalAIStylistContextValue = {
  openStylist: (options: OpenStylistOptions) => void;
};

const GlobalAIStylistContext = createContext<GlobalAIStylistContextValue>({
  openStylist: () => {},
});

export function useGlobalAIStylist() {
  return useContext(GlobalAIStylistContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type Props = {
  children: React.ReactNode;
};

export function GlobalAIStylistProvider({ children }: Props) {
  const [visible, setVisible] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);
  const [promptRequestId, setPromptRequestId] = useState(0);
  const { isPremium } = useEntitlement();

  const openStylist = useCallback(async ({ initialQuery: query, source }: OpenStylistOptions) => {
    if (!isPremium) {
      const shouldUpgrade = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Unlock your AI Stylist',
          'Chat with your personal stylist for daily outfit advice, wardrobe insights, and event planning.',
          [
            { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
            { text: 'See Plans', onPress: () => resolve(true) },
          ],
        );
      });
      if (!shouldUpgrade) return;
      const purchased = await presentPaywall();
      if (!purchased) return;
    }
    track('stylist_opened', { source });
    setInitialQuery(query);
    if (query) setPromptRequestId((id) => id + 1);
    setVisible(true);
  }, [isPremium]);

  const closeStylist = useCallback(() => setVisible(false), []);
  const consumePrompt = useCallback(() => setInitialQuery(undefined), []);

  return (
    <GlobalAIStylistContext.Provider value={{ openStylist }}>
      <View style={styles.root}>{children}</View>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeStylist}
      >
        <StylistChatView
          initialQuery={initialQuery}
          promptRequestId={promptRequestId}
          onPromptConsumed={consumePrompt}
          onClose={closeStylist}
        />
      </Modal>
    </GlobalAIStylistContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
});
