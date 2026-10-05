import { useCallback, useEffect, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SavedRecommendationsContent } from '../../components/stylist/SavedRecommendationsContent';
import { track } from '../../lib/analytics';
import { StylistChatView } from '../../components/stylist/StylistChatView';
import { useEntitlement } from '../../hooks/useEntitlement';
import { presentPaywall } from '../../lib/paywall';
import { colors, radii, spacing } from '../../theme';
import { ActionButton, ScreenHeader, SegmentedControl } from '../../components/primitives/Editorial';
import { AppText } from '../../components/primitives/AppText';
import { shoppingPriorityFromDailyLookGap } from '../../lib/dailyLookPresentation';
import type { StylistScreenProps } from '../../navigation/types';
import type { StylistMissingEssential } from '../../features/stylist/types';

export function StylistScreen({ navigation, route }: StylistScreenProps) {
  const { isPremium } = useEntitlement();
  const insets = useSafeAreaInsets();
  const [openingPaywall, setOpeningPaywall] = useState(false);
  const [view, setView] = useState<'chat' | 'saved'>(route.params?.view ?? 'chat');
  const [savedMounted, setSavedMounted] = useState(view === 'saved');
  const selectView = useCallback((next: 'chat' | 'saved') => {
    Keyboard.dismiss();
    setView(next);
    if (next === 'saved') setSavedMounted(true);
    track('stylist_view_selected', { view: next });
  }, []);
  useEffect(() => {
    if (!route.params?.view) return;
    selectView(route.params.view);
    navigation.setParams({ view: undefined });
  }, [navigation, route.params?.view, selectView]);
  const consumeSelection = useCallback(() => navigation.setParams({ selectedId: undefined }), [navigation]);
  const consumeTab = useCallback(() => navigation.setParams({ tab: undefined }), [navigation]);
  const viewSaved = useCallback((selectedId: string) => {
    navigation.setParams({ selectedId });
    selectView('saved');
  }, [navigation, selectView]);

  return <View style={styles.screen}>
    <ScreenHeader title="Your Stylist" titleVariant="display" safeTop={false} style={{ paddingTop: insets.top + spacing.md }} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.viewSwitch} contentContainerStyle={styles.viewSwitchContent}>
      <SegmentedControl value={view} variant="tabs" options={[{ value: 'chat', label: 'Chat' }, { value: 'saved', label: 'Saved' }]} onChange={selectView} />
    </ScrollView>
    <View style={[styles.pane, view !== 'chat' && styles.hidden]} accessibilityElementsHidden={view !== 'chat'} importantForAccessibility={view !== 'chat' ? 'no-hide-descendants' : 'auto'}>
      {isPremium ? <StylistChatView
        source="center_tab"
        threadMode="resume"
        openRequestId={1}
        embedded
        onViewSaved={viewSaved}
        onClose={() => navigation.navigate('Home')}
        onNavigateToCloset={(outfitId) => navigation.navigate('Closet', { screen: 'OutfitDetail', params: { outfitId } })}
        onNavigateToShop={(gap?: StylistMissingEssential) => {
          if (gap?.label) navigation.navigate('Shop', { screen: 'ShoppingPriorityEdit', params: { priority: shoppingPriorityFromDailyLookGap(gap) } });
        }}
      /> : <StylistPremiumGate openingPaywall={openingPaywall} onOpenPaywall={async () => {
        setOpeningPaywall(true);
        try { await presentPaywall(); } finally { setOpeningPaywall(false); }
      }} />}
    </View>
    {savedMounted && <View style={[styles.pane, view !== 'saved' && styles.hidden]} accessibilityElementsHidden={view !== 'saved'} importantForAccessibility={view !== 'saved' ? 'no-hide-descendants' : 'auto'}>
      <SavedRecommendationsContent active={view === 'saved'} initialTab={route.params?.tab} selectedId={route.params?.selectedId} onSelectionConsumed={consumeSelection} onTabConsumed={consumeTab} />
    </View>}
  </View>;
}

function StylistPremiumGate({ openingPaywall, onOpenPaywall }: { openingPaywall: boolean; onOpenPaywall: () => Promise<void> }) {
  return (
    <View style={styles.root}>
      <View style={styles.mark}>
        <Ionicons name="sparkles" size={28} color={colors.primary} />
      </View>
      <AppText variant="eyebrowLarge" tone="brand" style={styles.eyebrow}>PRIVATE STYLING</AppText>
      <AppText variant="editorialHero" tone="primary" style={styles.title}>A stylist who already knows your wardrobe.</AppText>
      <AppText variant="body" tone="secondary" style={styles.body}>
        Build looks, plan for events, spot wardrobe gaps, and shop with more intention.
      </AppText>
      <ActionButton
        label={openingPaywall ? 'Opening...' : 'Meet your stylist'}
        icon="sparkles"
        style={styles.button}
        disabled={openingPaywall}
        onPress={() => void onOpenPaywall()}
        accessibilityLabel="See premium plans"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  pane: { flex: 1 },
  hidden: { display: 'none' },
  viewSwitch: { flexGrow: 0, flexShrink: 0 },
  viewSwitchContent: { paddingHorizontal: spacing.page, paddingBottom: spacing.sm },
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.background,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSelected,
  },
  eyebrow: { marginTop: spacing.sm },
  title: {
    textAlign: 'center',
  },
  body: {
    maxWidth: 340,
    textAlign: 'center',
  },
  button: {
    minHeight: 52,
    minWidth: 220,
    marginTop: spacing.md,
  },
});
