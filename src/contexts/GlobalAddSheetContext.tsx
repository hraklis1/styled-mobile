import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AddActionSheet } from '../components/AddActionSheet';
import type { Item } from '../types/item';

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetCallbacks = {
  onTakePhoto?: () => void;
  onFromLibrary?: () => void;
  onBatchImport?: () => void;
  onItemsSaved?: (items: Item[]) => void;
  onActionStart?: (action: 'camera' | 'library' | 'batch') => void;
  onDismiss?: () => void;
};

type GlobalAddSheetContextValue = {
  openAddSheet: (callbacks?: SheetCallbacks) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const GlobalAddSheetContext = createContext<GlobalAddSheetContextValue>({
  openAddSheet: () => {},
});

export function useGlobalAddSheet() {
  return useContext(GlobalAddSheetContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type Props = {
  children: React.ReactNode;
};

export function GlobalAddSheetProvider({ children }: Props) {
  const [visible, setVisible] = useState(false);
  const callbacksRef = useRef<SheetCallbacks>({});

  const openAddSheet = useCallback((callbacks?: SheetCallbacks) => {
    callbacksRef.current = callbacks ?? {};
    setVisible(true);
  }, []);

  const closeAddSheet = useCallback(() => {
    setVisible(false);
    const onDismiss = callbacksRef.current.onDismiss;
    callbacksRef.current = {};
    onDismiss?.();
  }, []);

  return (
    <GlobalAddSheetContext.Provider value={{ openAddSheet }}>
      <View style={styles.root}>{children}</View>
      {visible && (
        <AddActionSheet
          visible={visible}
          onClose={closeAddSheet}
          onTakePhoto={callbacksRef.current.onTakePhoto}
          onFromLibrary={callbacksRef.current.onFromLibrary}
          onBatchImport={callbacksRef.current.onBatchImport}
          onItemsSaved={callbacksRef.current.onItemsSaved}
          onActionStart={callbacksRef.current.onActionStart}
        />
      )}
    </GlobalAddSheetContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
});
