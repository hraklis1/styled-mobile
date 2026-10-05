import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Modal, Platform, View, StyleSheet } from 'react-native';
import { WishlistNavigationContext } from './WishlistNavigationContext';

import { openWishlist, openClosetOutfit } from '../navigation/savedRecommendations';
import { StylistChatView, type StylistSessionSnapshot } from '../components/stylist/StylistChatView';
import { useEntitlement } from '../hooks/useEntitlement';
import { track } from '../lib/analytics';
import { ensureEntitled } from '../lib/entitlementGate';
import type { StylistEntryContext, StylistMissingEssential, StylistMode } from '../features/stylist/types';

// ─── Context ──────────────────────────────────────────────────────────────────

export type StylistOpenSource =
  | 'center_tab'
  | 'home_prompt'
  | 'shop'
  | 'item_detail'
  | 'outfit_detail'
  | 'event_detail'
  | 'calendar_card'
  | 'calendar_hero'
  | 'closet_selection'
  | 'board_detail';

export type StylistEventContext = { id: number; title: string };

type OpenStylistOptions = {
  initialQuery?: string;
  initialAttachmentUri?: string;
  initialMode?: StylistMode;
  destination?: string;
  source: StylistOpenSource;
  eventContext?: StylistEventContext;
  context?: StylistEntryContext;
  /** Kept for existing launchers; outfit navigation now uses the shared Closet route. */
  onNavigateToCloset?: (outfitId: number) => void;
  onNavigateToShop?: (gap?: StylistMissingEssential) => void;
};

type GlobalAIStylistContextValue = {
  openStylist: (options: OpenStylistOptions) => void;
  resumeStylist: () => void;
};

const GlobalAIStylistContext = createContext<GlobalAIStylistContextValue>({
  openStylist: () => {},
  resumeStylist: () => {},
});

export function useGlobalAIStylist() {
  return useContext(GlobalAIStylistContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type Props = {
  children: React.ReactNode;
};

// Topical entry points each imply a distinct conversation, so they start a fresh
// thread. The generic center-tab tap resumes the user's most recent thread.
function threadModeForSource(source: StylistOpenSource): 'new' | 'resume' {
  return source === 'center_tab' ? 'resume' : 'new';
}

export function GlobalAIStylistProvider({ children }: Props) {
  const [visible, setVisible] = useState(false);
  const sessionRef = useRef<StylistSessionSnapshot | null>(null);
  const pendingClosetId = useRef<number | null>(null);
  const pendingSavedId = useRef<string | null>(null);
  const finishSavedNavigation = useCallback(() => {
    if (pendingClosetId.current !== null) {
      const outfitId = pendingClosetId.current;
      pendingClosetId.current = null;
      openClosetOutfit(outfitId, true);
      return;
    }
    const id = pendingSavedId.current;
    if (!id) return;
    pendingSavedId.current = null;
    openWishlist(id, 'products', 'stylist-modal');
  }, []);
  // iOS waits for native dismissal; Android/web have no Modal onDismiss event.
  useEffect(() => {
    if (visible || Platform.OS === 'ios' || (!pendingSavedId.current && pendingClosetId.current === null)) return;
    const frame = requestAnimationFrame(finishSavedNavigation);
    return () => cancelAnimationFrame(frame);
  }, [finishSavedNavigation, visible]);
  const viewSaved = useCallback((id: string) => {
    pendingSavedId.current = id;
    setVisible(false);
  }, []);
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);
  const [initialAttachmentUri, setInitialAttachmentUri] = useState<string | undefined>(undefined);
  const [initialMode, setInitialMode] = useState<StylistMode | undefined>(undefined);
  const [initialDestination, setInitialDestination] = useState<string | undefined>(undefined);
  const [eventContext, setEventContext] = useState<StylistEventContext | undefined>(undefined);
  const [entryContext, setEntryContext] = useState<StylistEntryContext | undefined>(undefined);
  const [onNavigateToShop, setOnNavigateToShop] = useState<((gap?: StylistMissingEssential) => void) | undefined>(undefined);
  const [promptRequestId, setPromptRequestId] = useState(0);
  const [openRequestId, setOpenRequestId] = useState(0);
  const [source, setSource] = useState<StylistOpenSource | undefined>(undefined);
  const [threadMode, setThreadMode] = useState<'new' | 'resume'>('resume');
  const { isPremium } = useEntitlement();

  const openStylist = useCallback(async ({ initialQuery: query, initialAttachmentUri: attachmentUri, initialMode: mode, destination, source, eventContext: event, context, onNavigateToShop: navigateToShop }: OpenStylistOptions) => {
    const entitled = await ensureEntitled(isPremium, {
      title: 'Unlock your AI Stylist',
      message: 'Chat with your personal stylist for daily outfit advice, wardrobe insights, and event planning.',
    });
    if (!entitled) return;
    sessionRef.current = null;
    track('stylist_opened', { source });
    setSource(source);
    setThreadMode(threadModeForSource(source));
    setInitialQuery(query);
    setInitialAttachmentUri(attachmentUri);
    setInitialMode(mode);
    setInitialDestination(destination);
    setEventContext(event);
    setEntryContext(context);
    setOnNavigateToShop(() => navigateToShop);
    if (query) setPromptRequestId((id) => id + 1);
    setOpenRequestId((id) => id + 1);
    setVisible(true);
  }, [isPremium]);

  const resumeStylist = useCallback(() => {
    if (isPremium) setVisible(true);
  }, [isPremium]);
  const viewWishlist = useCallback((id: string) => {
    if (visible) viewSaved(id);
    else openWishlist(id);
  }, [visible, viewSaved]);

  const closeStylist = useCallback(() => {
    setVisible(false);
    setInitialDestination(undefined);
    setInitialAttachmentUri(undefined);
    setInitialMode(undefined);
    setEventContext(undefined);
    setEntryContext(undefined);
    setOnNavigateToShop(undefined);
  }, []);
  const navigateToCloset = useCallback((outfitId: number) => {
    // The Stylist is presented as a native modal. Dismiss it before changing
    // the underlying tab stack so the destination is visible immediately.
    setVisible(false);
    pendingClosetId.current = outfitId;
  }, []);
  const consumePrompt = useCallback(() => setInitialQuery(undefined), []);

  return (
    <WishlistNavigationContext.Provider value={viewWishlist}>
      <GlobalAIStylistContext.Provider value={{ openStylist, resumeStylist }}>
        <View style={styles.root}>{children}</View>
        <Modal
          visible={visible}
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent
          onRequestClose={closeStylist}
          onDismiss={finishSavedNavigation}
        >
          <StylistChatView
            sessionRef={sessionRef}
            initialQuery={initialQuery}
            initialAttachmentUri={initialAttachmentUri}
            initialMode={initialMode}
            initialDestination={initialDestination}
            eventContext={eventContext}
            entryContext={entryContext}
            promptRequestId={promptRequestId}
            openRequestId={openRequestId}
            source={source}
            threadMode={threadMode}
            onViewSaved={viewSaved}
            onNavigateToCloset={navigateToCloset}
            onNavigateToShop={onNavigateToShop}
            onPromptConsumed={consumePrompt}
            onClose={closeStylist}
          />
        </Modal>
      </GlobalAIStylistContext.Provider>
    </WishlistNavigationContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
});
