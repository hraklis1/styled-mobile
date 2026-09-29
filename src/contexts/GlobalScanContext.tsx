import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScanItemSheet } from '../components/wardrobe/ScanItemSheet';
import { BatchScanSheet } from '../components/wardrobe/BatchScanSheet';
import { BatchImportTray } from '../components/wardrobe/BatchImportTray';
import { BatchImportWorkspace } from '../components/wardrobe/BatchImportWorkspace';
import { useAuth } from './AuthContext';
import { useBatchImportStore } from '../features/batch-import/store';
import { discardBatch, startBatchRunner } from '../features/batch-import/runner';
import { onBatchItemsSaved } from '../features/batch-import/save';
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

  const { user } = useAuth();

  // The batch queue outlives any screen: resume it on launch and keep it
  // running for the life of the signed-in shell.
  useEffect(() => startBatchRunner(), []);

  // A batch belongs to the account that started it.
  useEffect(() => {
    const batch = useBatchImportStore.getState().batch;
    if (batch && user && batch.userId !== user.id) discardBatch();
  }, [user]);

  // Whoever opened a batch hears when its pieces reach the closet, however
  // much later that is. Held in memory only: after an app restart there is
  // no caller left to tell.
  const batchSavedRef = useRef<{ batchId: string; onItemsSaved?: (items: Item[]) => void } | null>(null);
  useEffect(() => onBatchItemsSaved((batchId, items) => {
    if (batchSavedRef.current?.batchId === batchId) batchSavedRef.current.onItemsSaved?.(items);
  }), []);

  const openBatchScan = useCallback((callbacks?: ScanCallbacks) => {
    // One batch at a time: while one is active, the entry point shows it.
    if (useBatchImportStore.getState().batch) {
      useBatchImportStore.getState().openWorkspace();
      if (callbacks?.onDismiss) setTimeout(callbacks.onDismiss, 300);
      return;
    }
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
          onClose={closeBatch}
          onStarted={(batchId) => {
            batchSavedRef.current = { batchId, onItemsSaved: batchCallbacks.onItemsSaved };
          }}
        />
      )}
      <BatchImportTray />
      <BatchImportWorkspace />
    </GlobalScanContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
});
