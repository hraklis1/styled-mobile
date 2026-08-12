import { createContext, useCallback, useContext, useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';

import { StylistChatView } from '../components/stylist/StylistChatView';
import { useEntitlement } from '../hooks/useEntitlement';
import { track } from '../lib/analytics';
import { ensureEntitled } from '../lib/entitlementGate';
import type { StylistEntryContext, StylistMode } from '../features/stylist/types';

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
  /** Navigation is owned by the screen that launched the global modal. */
  onNavigateToCloset?: (outfitId: number) => void;
};

type GlobalAIStylistContextValue = {
  openStylist: (options: OpenStylistOptions) => void;
};

const GlobalAIStylistContext = createContext<GlobalAIStylistContextValue>({
  openStylist: () => {},
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
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);
  const [initialAttachmentUri, setInitialAttachmentUri] = useState<string | undefined>(undefined);
  const [initialMode, setInitialMode] = useState<StylistMode | undefined>(undefined);
  const [initialDestination, setInitialDestination] = useState<string | undefined>(undefined);
  const [eventContext, setEventContext] = useState<StylistEventContext | undefined>(undefined);
  const [entryContext, setEntryContext] = useState<StylistEntryContext | undefined>(undefined);
  const [onNavigateToCloset, setOnNavigateToCloset] = useState<((outfitId: number) => void) | undefined>(undefined);
  const [promptRequestId, setPromptRequestId] = useState(0);
  const [openRequestId, setOpenRequestId] = useState(0);
  const [source, setSource] = useState<StylistOpenSource | undefined>(undefined);
  const [threadMode, setThreadMode] = useState<'new' | 'resume'>('resume');
  const { isPremium } = useEntitlement();

  const openStylist = useCallback(async ({ initialQuery: query, initialAttachmentUri: attachmentUri, initialMode: mode, destination, source, eventContext: event, context, onNavigateToCloset: navigateToCloset }: OpenStylistOptions) => {
    const entitled = await ensureEntitled(isPremium, {
      title: 'Unlock your AI Stylist',
      message: 'Chat with your personal stylist for daily outfit advice, wardrobe insights, and event planning.',
    });
    if (!entitled) return;
    track('stylist_opened', { source });
    setSource(source);
    setThreadMode(threadModeForSource(source));
    setInitialQuery(query);
    setInitialAttachmentUri(attachmentUri);
    setInitialMode(mode);
    setInitialDestination(destination);
    setEventContext(event);
    setEntryContext(context);
    setOnNavigateToCloset(() => navigateToCloset);
    if (query) setPromptRequestId((id) => id + 1);
    setOpenRequestId((id) => id + 1);
    setVisible(true);
  }, [isPremium]);

  const closeStylist = useCallback(() => {
    setVisible(false);
    setInitialDestination(undefined);
    setInitialAttachmentUri(undefined);
    setInitialMode(undefined);
    setEventContext(undefined);
    setEntryContext(undefined);
    setOnNavigateToCloset(undefined);
  }, []);
  const navigateToCloset = useCallback((outfitId: number) => {
    // The Stylist is presented as a native modal. Dismiss it before changing
    // the underlying tab stack so the destination is visible immediately.
    setVisible(false);
    onNavigateToCloset?.(outfitId);
  }, [onNavigateToCloset]);
  const consumePrompt = useCallback(() => setInitialQuery(undefined), []);

  return (
    <GlobalAIStylistContext.Provider value={{ openStylist }}>
      <View style={styles.root}>{children}</View>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeStylist}
      >
        <StylistChatView
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
          onNavigateToCloset={navigateToCloset}
          onPromptConsumed={consumePrompt}
          onClose={closeStylist}
        />
      </Modal>
    </GlobalAIStylistContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
});
