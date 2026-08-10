import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

import { LogOutfitSheet } from '../components/outfits/LogOutfitSheet';
import { useGlobalAddSheet } from './GlobalAddSheetContext';
import { useGlobalScan } from './GlobalScanContext';
import type { Item } from '../types/item';

// ─── Context ──────────────────────────────────────────────────────────────────

export type OpenLoggerOptions = {
  /** ISO `yyyy-mm-dd` the log should default to. Omit for today. */
  date?: string;
};

type GlobalOutfitLoggerContextValue = {
  openLogger: (options?: OpenLoggerOptions) => void;
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
  const [dateRequest, setDateRequest] = useState<{ id: number; date?: string }>({ id: 0 });
  const { openAddSheet } = useGlobalAddSheet();
  const { openScanItem, openBatchScan } = useGlobalScan();
  const detourPhase = useRef<'idle' | 'add' | 'scan'>('idle');

  const openLogger = useCallback((options?: OpenLoggerOptions) => {
    setDateRequest((prev) => ({ id: prev.id + 1, date: options?.date }));
    setVisible(true);
  }, []);
  const closeLogger = useCallback(() => setVisible(false), []);
  const resumeLogger = useCallback(() => {
    detourPhase.current = 'idle';
    setVisible(true);
  }, []);

  const openAddClothesDetour = useCallback((onItemsSaved: (items: Item[]) => void) => {
    detourPhase.current = 'add';
    setVisible(false);
    setTimeout(() => {
      const scanCallbacks = {
        onItemsSaved,
        onDismiss: resumeLogger,
      };
      openAddSheet({
        onItemsSaved,
        onActionStart: () => { detourPhase.current = 'scan'; },
        onTakePhoto: () => openScanItem('camera', scanCallbacks),
        onFromLibrary: () => openScanItem('library', scanCallbacks),
        onBatchImport: () => openBatchScan(scanCallbacks),
        onDismiss: () => {
          if (detourPhase.current === 'add') {
            setTimeout(resumeLogger, 300);
          }
        },
      });
    }, 300);
  }, [openAddSheet, openBatchScan, openScanItem, resumeLogger]);

  return (
    <GlobalOutfitLoggerContext.Provider value={{ openLogger }}>
      <View style={styles.root}>
        {children}
      </View>
      <LogOutfitSheet
        visible={visible}
        initialDate={dateRequest.date}
        initialDateRequestId={dateRequest.id}
        onClose={closeLogger}
        onAddToWardrobe={openAddClothesDetour}
      />
    </GlobalOutfitLoggerContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
