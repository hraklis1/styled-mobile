import { createContext, useCallback, useContext, useState } from 'react';
import { Alert, Modal, View, StyleSheet } from 'react-native';

import { StylistChatView } from '../components/stylist/StylistChatView';
import { useEntitlement } from '../hooks/useEntitlement';
import { track } from '../lib/analytics';
import { presentPaywall } from '../lib/paywall';
import type { StylistEntryContext } from '../features/stylist/types';

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
  destination?: string;
  source: StylistOpenSource;
  eventContext?: StylistEventContext;
  context?: StylistEntryContext;
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
  const [initialDestination, setInitialDestination] = useState<string | undefined>(undefined);
  const [eventContext, setEventContext] = useState<StylistEventContext | undefined>(undefined);
  const [entryContext, setEntryContext] = useState<StylistEntryContext | undefined>(undefined);
  const [promptRequestId, setPromptRequestId] = useState(0);
  const [openRequestId, setOpenRequestId] = useState(0);
  const [source, setSource] = useState<StylistOpenSource | undefined>(undefined);
  const [threadMode, setThreadMode] = useState<'new' | 'resume'>('resume');
  const { isPremium } = useEntitlement();

  const openStylist = useCallback(async ({ initialQuery: query, destination, source, eventContext: event, context }: OpenStylistOptions) => {
    if (!isPremium) {
      const shouldUpgrade = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Unlock your AI Stylist',
          'Chat with your personal stylist for daily outfit advice, wardrobe insights, and event planning.',
          [
            { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
            { text: 'See Plans', onPress: () => resolve(true) },
          ],
        );
      });
      if (!shouldUpgrade) return;
      const purchased = await presentPaywall();
      if (!purchased) return;
    }
    track('stylist_opened', { source });
    setSource(source);
    setThreadMode(threadModeForSource(source));
    setInitialQuery(query);
    setInitialDestination(destination);
    setEventContext(event);
    setEntryContext(context);
    if (query) setPromptRequestId((id) => id + 1);
    setOpenRequestId((id) => id + 1);
    setVisible(true);
  }, [isPremium]);

  const closeStylist = useCallback(() => {
    setVisible(false);
    setInitialDestination(undefined);
    setEventContext(undefined);
    setEntryContext(undefined);
  }, []);
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
          initialDestination={initialDestination}
          eventContext={eventContext}
          entryContext={entryContext}
          promptRequestId={promptRequestId}
          openRequestId={openRequestId}
          source={source}
          threadMode={threadMode}
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
