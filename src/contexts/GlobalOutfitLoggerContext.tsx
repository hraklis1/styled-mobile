import { createContext, useContext, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';

import { LogOutfitSheet } from '../components/outfits/LogOutfitSheet';

// ─── Context ──────────────────────────────────────────────────────────────────

type GlobalOutfitLoggerContextValue = {
  openLogger: () => void;
};

const GlobalOutfitLoggerContext = createContext<GlobalOutfitLoggerContextValue>({
  openLogger: () => {},
});

export function useGlobalOutfitLogger() {
  return useContext(GlobalOutfitLoggerContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

type Props = {
  children: React.ReactNode;
};

export function GlobalOutfitLoggerProvider({ children }: Props) {
  const [visible, setVisible] = useState(false);

  const openLogger = useCallback(() => setVisible(true), []);
  const closeLogger = useCallback(() => setVisible(false), []);

  return (
    <GlobalOutfitLoggerContext.Provider value={{ openLogger }}>
      <View style={styles.root}>
        {children}
      </View>
      <LogOutfitSheet visible={visible} onClose={closeLogger} />
    </GlobalOutfitLoggerContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
