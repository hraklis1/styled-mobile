import { createContext, useContext, useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogOutfitSheet } from '../components/outfits/LogOutfitSheet';
import { colors, radii } from '../theme';

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

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 56;

// ─── Provider ────────────────────────────────────────────────────────────────

type Props = {
  children: React.ReactNode;
};

export function GlobalOutfitLoggerProvider({ children }: Props) {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const openLogger = useCallback(() => setVisible(true), []);
  const closeLogger = useCallback(() => setVisible(false), []);

  const fabBottom = TAB_BAR_HEIGHT + insets.bottom + 16;

  return (
    <GlobalOutfitLoggerContext.Provider value={{ openLogger }}>
      <View style={styles.root}>
        {children}
        <TouchableOpacity
          style={[styles.fab, { bottom: fabBottom }]}
          onPress={openLogger}
          activeOpacity={0.85}
          accessibilityLabel="Log outfit"
          accessibilityRole="button"
        >
          <Ionicons name="journal-outline" size={22} color={colors.primaryForeground} />
        </TouchableOpacity>
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
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
