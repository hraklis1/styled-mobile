import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

import { LogOutfitSheet } from '../components/outfits/LogOutfitSheet';
import { WearLogTray } from '../components/outfits/wear-review/WearLogTray';
import { PhotoSourceSheet } from '../components/primitives/PhotoSourceSheet';
import { useGlobalAddSheet } from './GlobalAddSheetContext';
import { useGlobalScan } from './GlobalScanContext';
import type { Item } from '../types/item';
import { track } from '../lib/analytics';
import { useCameraLaunch, useLibraryLaunch, type CapturedImage } from '../hooks/useCameraLaunch';

// ─── Context ──────────────────────────────────────────────────────────────────

export type OpenLoggerOptions = {
  /** ISO `yyyy-mm-dd` the log should default to. Omit for today. */
  date?: string;
  /** Open the lightweight Home capture chooser instead of the full logger. */
  quickStart?: boolean;
  /** Reopen straight onto the outfit scan in progress (the tray). */
  resumeScan?: boolean;
};

export type OutfitLoggerLaunch = 'camera' | 'library' | 'closet';

/**
 * What the Home quick-start sheet is waiting to do once it has finished
 * dismissing. `add` is the bail-out: the user opened the log sheet meaning to
 * put new clothes in their closet, so we hand them straight to the add flow
 * instead of making them back out and hunt for the right button.
 */
type QuickStartPending = OutfitLoggerLaunch | 'add';

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
  const [quickStartVisible, setQuickStartVisible] = useState(false);
  const [dateRequest, setDateRequest] = useState<{ id: number; date?: string }>({ id: 0 });
  const [initialLaunch, setInitialLaunch] = useState<OutfitLoggerLaunch | undefined>();
  const [initialView, setInitialView] = useState<'picker' | 'scan-review' | undefined>();
  const [initialImage, setInitialImage] = useState<CapturedImage | undefined>();
  const [quickStartPending, setQuickStartPending] = useState<QuickStartPending | undefined>();
  const launchCamera = useCameraLaunch();
  const launchLibrary = useLibraryLaunch();
  const { openAddSheet } = useGlobalAddSheet();
  const { openScanItem, openFromPhotos } = useGlobalScan();
  const detourPhase = useRef<'idle' | 'add' | 'scan'>('idle');

  const openLogger = useCallback((options?: OpenLoggerOptions) => {
    setDateRequest((prev) => ({ id: prev.id + 1, date: options?.date }));
    if (options?.quickStart) {
      track('outfit_log_quick_started', { entry_point: 'home' });
      setInitialLaunch(undefined);
      setInitialView(undefined);
      setInitialImage(undefined);
      setQuickStartPending(undefined);
      setVisible(false);
      setQuickStartVisible(true);
      return;
    }
    setQuickStartVisible(false);
    setInitialLaunch(undefined);
    setInitialView(options?.resumeScan ? 'scan-review' : undefined);
    setInitialImage(undefined);
    setQuickStartPending(undefined);
    setVisible(true);
  }, []);
  const closeLogger = useCallback(() => {
    setVisible(false);
    setInitialLaunch(undefined);
    setInitialView(undefined);
    setInitialImage(undefined);
  }, []);
  const closeQuickStart = useCallback(() => {
    setQuickStartPending(undefined);
    setQuickStartVisible(false);
  }, []);
  const launchQuickStart = useCallback((launch: OutfitLoggerLaunch) => {
    track('outfit_log_source_selected', { entry_point: 'home', source: launch });
    setQuickStartPending(launch);
    setQuickStartVisible(false);
  }, []);
  const handleQuickStartDismissed = useCallback(async () => {
    const launch = quickStartPending;
    if (!launch) return;
    setQuickStartPending(undefined);

    if (launch === 'add') {
      openAddSheet({
        onTakePhoto: () => openScanItem('camera'),
        onFromPhotos: () => openFromPhotos(),
      });
      return;
    }

    if (launch === 'closet') {
      setInitialLaunch(undefined);
      setInitialView('picker');
      setVisible(true);
      return;
    }

    try {
      const image = launch === 'camera'
        ? await launchCamera({ maxDim: 1600 })
        : await launchLibrary({ maxDim: 1600 });
      if (!image) return;

      setInitialLaunch(launch);
      setInitialView(undefined);
      setInitialImage(image);
      setVisible(true);
    } catch {
      // The launch hooks handle permission and image-processing errors. This
      // covers native presentation failures so the quick-start flow cannot
      // leave an invisible modal blocking Home.
      setInitialLaunch(undefined);
      setInitialImage(undefined);
    }
  }, [launchCamera, launchLibrary, openAddSheet, openFromPhotos, openScanItem, quickStartPending]);
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
        onFromPhotos: () => openFromPhotos(scanCallbacks),
        onDismiss: () => {
          if (detourPhase.current === 'add') {
            setTimeout(resumeLogger, 300);
          }
        },
      });
    }, 300);
  }, [openAddSheet, openFromPhotos, openScanItem, resumeLogger]);

  return (
    <GlobalOutfitLoggerContext.Provider value={{ openLogger }}>
      <View style={styles.root}>
        {children}
        <WearLogTray onOpen={() => openLogger({ resumeScan: true })} />
      </View>
      <LogOutfitSheet
        visible={visible}
        initialDate={dateRequest.date}
        initialDateRequestId={dateRequest.id}
        initialLaunch={initialLaunch}
        initialView={initialView}
        initialImage={initialImage}
        onClose={closeLogger}
        onAddToWardrobe={openAddClothesDetour}
      />
      <PhotoSourceSheet
        visible={quickStartVisible}
        title="Log today’s look"
        subtitle="Capture it, or pick the pieces yourself."
        cameraLabel="Photograph your outfit"
        cameraHint="We’ll match each piece to your closet"
        manualLabel="From your closet"
        manualHint="Select the pieces you wore"
        libraryLabel="From your photos"
        libraryHint="Use a photo of the outfit you wore"
        onCamera={() => launchQuickStart('camera')}
        onLibrary={() => launchQuickStart('library')}
        onManual={() => launchQuickStart('closet')}
        onCancel={closeQuickStart}
        onDismiss={handleQuickStartDismissed}
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
