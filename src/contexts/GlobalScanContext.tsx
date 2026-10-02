import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScanItemSheet } from '../components/wardrobe/ScanItemSheet';
import { BatchScanSheet, MAX_PHOTOS } from '../components/wardrobe/BatchScanSheet';
import { BatchImportTray } from '../components/wardrobe/BatchImportTray';
import { BatchImportWorkspace } from '../components/wardrobe/BatchImportWorkspace';
import { useAuth } from './AuthContext';
import { useBatchImportStore } from '../features/batch-import/store';
import { discardBatch, startBatchRunner } from '../features/batch-import/runner';
import { onBatchItemsSaved } from '../features/batch-import/save';
import { useStartBatch } from '../features/batch-import/useStartBatch';
import { processLibraryAsset, useLibraryLaunchMany, type CapturedImage } from '../hooks/useCameraLaunch';
import { track } from '../lib/analytics';
import type { Item } from '../types/item';

// ─── Context ──────────────────────────────────────────────────────────────────

type ScanCallbacks = {
  onItemsSaved?: (items: Item[]) => void;
  onDismiss?: () => void;
};

type GlobalScanContextValue = {
  openScanItem: (source?: 'camera' | 'library', callbacks?: ScanCallbacks) => void;
  openBatchScan: (callbacks?: ScanCallbacks) => void;
  /**
   * The one library entry point: multi-select up to MAX_PHOTOS. One photo
   * goes to the single-scan review, several to the background batch queue.
   */
  openFromPhotos: (callbacks?: ScanCallbacks) => void;
};

const GlobalScanContext = createContext<GlobalScanContextValue>({
  openScanItem: () => {},
  openBatchScan: () => {},
  openFromPhotos: () => {},
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
  const [scanInitialImage, setScanInitialImage] = useState<CapturedImage | undefined>();
  const [batchVisible, setBatchVisible] = useState(false);
  const [scanCallbacks, setScanCallbacks] = useState<ScanCallbacks>({});
  const [batchCallbacks, setBatchCallbacks] = useState<ScanCallbacks>({});

  const openScanItem = useCallback((source?: 'camera' | 'library', callbacks?: ScanCallbacks) => {
    setScanAutoLaunch(source);
    setScanInitialImage(undefined);
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

  const launchLibraryMany = useLibraryLaunchMany();
  const { startBatch } = useStartBatch();

  const openFromPhotos = useCallback(async (callbacks?: ScanCallbacks) => {
    // One batch at a time: while one is active, the entry point shows it.
    if (useBatchImportStore.getState().batch) {
      openBatchScan(callbacks);
      return;
    }
    const dismiss = () => { if (callbacks?.onDismiss) setTimeout(callbacks.onDismiss, 300); };

    const assets = await launchLibraryMany({ limit: MAX_PHOTOS, captureExif: true });
    if (!assets.length) { dismiss(); return; }
    track('closet_add_from_photos', { photo_count: assets.length });

    if (assets.length === 1) {
      const image = await processLibraryAsset(assets[0], { maxDim: 1600, compress: 0.85, captureExif: true });
      if (!image) { dismiss(); return; }
      setScanAutoLaunch('library');
      setScanInitialImage(image);
      setScanCallbacks(callbacks ?? {});
      setScanVisible(true);
      return;
    }

    const batchId = await startBatch(assets);
    if (batchId) batchSavedRef.current = { batchId, onItemsSaved: callbacks?.onItemsSaved };
    dismiss();
  }, [launchLibraryMany, openBatchScan, startBatch]);

  const closeScan = useCallback(() => {
    setScanVisible(false);
    setScanAutoLaunch(undefined);
    setScanInitialImage(undefined);
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
    <GlobalScanContext.Provider value={{ openScanItem, openBatchScan, openFromPhotos }}>
      <View style={styles.root}>{children}</View>
      {scanVisible && (
        <ScanItemSheet
          visible={scanVisible}
          onClose={closeScan}
          autoLaunch={scanAutoLaunch}
          initialImage={scanInitialImage}
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
