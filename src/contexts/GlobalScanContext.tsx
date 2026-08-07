import { createContext, useCallback, useContext, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScanItemSheet } from '../components/wardrobe/ScanItemSheet';
import { BatchScanSheet } from '../components/wardrobe/BatchScanSheet';
import type { Item } from '../types/item';

// ─── Context ──────────────────────────────────────────────────────────────────

type ScanCallbacks = {
  onItemsSaved?: (items: Item[]) => void;
  onDismiss?: () => void;
};

type GlobalScanContextValue = {
  openScanItem: (source?: 'camera' | 'library', callbacks?: ScanCallbacks) => void;
  openBatchScan: (callbacks?: ScanCallbacks) => void;
};

const GlobalScanContext = createContext<GlobalScanContextValue>({
  openScanItem: () => {},
  openBatchScan: () => {},
});

export function useGlobalScan() {
  return useContext(GlobalScanContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type Props = {
  children: React.ReactNode;
};

export function GlobalScanProvider({ children }: Props) {
  const [scanVisible, setScanVisible] = useState(false);
  const [scanAutoLaunch, setScanAutoLaunch] = useState<'camera' | 'library' | undefined>();
  const [batchVisible, setBatchVisible] = useState(false);
  const [scanCallbacks, setScanCallbacks] = useState<ScanCallbacks>({});
  const [batchCallbacks, setBatchCallbacks] = useState<ScanCallbacks>({});

  const openScanItem = useCallback((source?: 'camera' | 'library', callbacks?: ScanCallbacks) => {
    setScanAutoLaunch(source);
    setScanCallbacks(callbacks ?? {});
    setScanVisible(true);
  }, []);

  const openBatchScan = useCallback((callbacks?: ScanCallbacks) => {
    setBatchCallbacks(callbacks ?? {});
    setBatchVisible(true);
  }, []);

  const closeScan = useCallback(() => {
    setScanVisible(false);
    setScanAutoLaunch(undefined);
    const onDismiss = scanCallbacks.onDismiss;
    setScanCallbacks({});
    setTimeout(() => onDismiss?.(), 300);
  }, [scanCallbacks]);

  const closeBatch = useCallback(() => {
    setBatchVisible(false);
    const onDismiss = batchCallbacks.onDismiss;
    setBatchCallbacks({});
    setTimeout(() => onDismiss?.(), 300);
  }, [batchCallbacks]);

  return (
    <GlobalScanContext.Provider value={{ openScanItem, openBatchScan }}>
      <View style={styles.root}>{children}</View>
      {scanVisible && (
        <ScanItemSheet
          visible={scanVisible}
          onClose={closeScan}
          autoLaunch={scanAutoLaunch}
          onItemsSaved={scanCallbacks.onItemsSaved}
        />
      )}
      {batchVisible && (
        <BatchScanSheet
          visible={batchVisible}
          onClose={closeBatch}
          onItemsSaved={batchCallbacks.onItemsSaved}
        />
      )}
    </GlobalScanContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
});
