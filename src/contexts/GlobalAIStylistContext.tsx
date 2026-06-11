import { createContext, useCallback, useContext, useState } from 'react';
import { Alert, Modal, View, StyleSheet } from 'react-native';

import { StylistChatView } from '../components/stylist/StylistChatView';
import { useAuth } from './AuthContext';
import { presentPaywall } from '../lib/paywall';

// ─── Context ──────────────────────────────────────────────────────────────────

type GlobalAIStylistContextValue = {
  openStylist: (initialQuery?: string) => void;
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
  const { user } = useAuth();

  const openStylist = useCallback(async (q?: string) => {
    if (!user?.isPremium) {
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
    setInitialQuery(q);
    setVisible(true);
  }, [user?.isPremium]);

  const closeStylist = useCallback(() => setVisible(false), []);

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
        <StylistChatView initialQuery={initialQuery} onClose={closeStylist} />
      </Modal>
    </GlobalAIStylistContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
});
