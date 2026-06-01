import { createContext, useCallback, useContext, useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';

import { StylistChatView } from '../components/stylist/StylistChatView';

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

  const openStylist = useCallback((q?: string) => {
    setInitialQuery(q);
    setVisible(true);
  }, []);

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
