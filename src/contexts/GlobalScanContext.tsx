import { createContext, useCallback, useContext, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScanItemSheet } from '../components/wardrobe/ScanItemSheet';
import { BatchScanSheet } from '../components/wardrobe/BatchScanSheet';

// ─── Context ──────────────────────────────────────────────────────────────────

type GlobalScanContextValue = {
  openScanItem: (source?: 'camera' | 'library') => void;
  openBatchScan: () => void;
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

  const openScanItem = useCallback((source?: 'camera' | 'library') => {
    setScanAutoLaunch(source);
    setScanVisible(true);
  }, []);

  const openBatchScan = useCallback(() => setBatchVisible(true), []);

  const closeScan = useCallback(() => {
    setScanVisible(false);
    setScanAutoLaunch(undefined);
  }, []);

  const closeBatch = useCallback(() => setBatchVisible(false), []);

  return (
    <GlobalScanContext.Provider value={{ openScanItem, openBatchScan }}>
      <View style={styles.root}>{children}</View>
      {scanVisible && (
        <ScanItemSheet
          visible={scanVisible}
          onClose={closeScan}
          autoLaunch={scanAutoLaunch}
        />
      )}
      {batchVisible && (
        <BatchScanSheet
          visible={batchVisible}
          onClose={closeBatch}
        />
      )}
    </GlobalScanContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
});
