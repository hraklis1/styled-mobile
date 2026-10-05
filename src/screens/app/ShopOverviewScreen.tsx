import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShortlistContent } from './ShoppingGalleryScreen';
import { ShopWardrobeEdit } from '../../components/shopping/ShopWardrobeEdit';
import { ShoppingBriefCard, briefIssueLabel } from '../../components/shopping/ShoppingBriefCard';
import { EditorialSection, ScreenHeader, SegmentedControl } from '../../components/primitives/Editorial';
import { AppText } from '../../components/primitives/AppText';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useItems } from '../../hooks/useItems';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { buildShoppingEditItems, mergeShoppingSnaps, type ShoppingEditItem } from '../../lib/shoppingGallery';
import { buildShortlistSpotlight } from '../../lib/shortlistSpotlight';
import { shoppingPriorityRoute, wearableWardrobe } from '../../lib/shopClarity';
import { track } from '../../lib/analytics';
import { hasSeenAiActionCoach, markAiActionCoachSeen } from '../../lib/aiActionCoach';
import { presentPaywall } from '../../lib/paywall';
import { colors, radii, shoppingSurfaces, spacing } from '../../theme';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import type { ShopOverviewScreenProps, ShopView } from '../../navigation/types';

export function ShopOverviewScreen({ navigation, route }: ShopOverviewScreenProps) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { user } = useAuth();
  const { isPremium } = useEntitlement();
  const { data: items = [], refetch: refetchItems } = useItems();
  const wardrobe = useMemo(() => wearableWardrobe(items), [items]);
  const { data: remoteSnaps = [], refetch: refetchSnaps } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const brief = useShoppingBrief(isPremium);
  const [refreshing, setRefreshing] = useState(false);
  const requestedSection = route.params?.section;

  const [view, setView] = useState<ShopView>(route.params?.view ?? (requestedSection === 'shortlist' ? 'shortlist' : 'for-you'));
  const [shortlistMounted, setShortlistMounted] = useState(view === 'shortlist');
  const selectView = useCallback((next: ShopView) => {
    Keyboard.dismiss();
    setView(next);
    if (next === 'shortlist') setShortlistMounted(true);
    track('shop_view_selected', { view: next });
  }, []);

  useEffect(() => {
    if (requestedSection === 'saved-looks' || requestedSection === 'saved-shopping') {
      navigation.navigate('SavedShopping', { selectedId: route.params?.selectedId, tab: requestedSection === 'saved-looks' ? 'looks' : 'all' });
      navigation.setParams({ section: undefined, selectedId: undefined });
    } else if (requestedSection === 'shortlist' && route.params?.returnTo) {
      navigation.replace('ShoppingGallery', route.params);
    } else if (route.params?.view || requestedSection === 'shortlist') {
      selectView(route.params?.view ?? 'shortlist');
      navigation.setParams({ view: undefined, section: undefined });
    }
  }, [navigation, requestedSection, route.params, selectView]);

  const homeCurrency = useCurrencyCode();
  const shoppingItems = useMemo(
    () => buildShoppingEditItems(mergeShoppingSnaps(remoteSnaps, pendingUploads), { homeCurrency }),
    [homeCurrency, pendingUploads, remoteSnaps],
  );
  const spotlight = useMemo(() => buildShortlistSpotlight(shoppingItems), [shoppingItems]);
  const activeFinds = spotlight.awaitingDecision;
  useEffect(() => {
    if (!brief.data) return;
    track('shop_brief_loaded', {
      status: brief.data.status,
      source: brief.data.source,
      priority_count: brief.data.priorities.length,
    });
  }, [brief.data]);

  useFocusEffect(useCallback(() => {
    track('shop_overview_viewed', {
      active_find_count: activeFinds.length,
      shortlist_count: spotlight.itemCount,
      premium: isPremium,
    });
  }, [activeFinds.length, isPremium, spotlight.itemCount]));

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      refetchItems(),
      refetchSnaps(),
      ...(isPremium ? [brief.refetch()] : []),
    ]);
    setRefreshing(false);
  }, [brief, isPremium, refetchItems, refetchSnaps]);

  const [saveFindCoachVisible, setSaveFindCoachVisible] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    hasSeenAiActionCoach('shop_save_find', userId).then((seen) => {
      if (!active || seen) return;
      timer = setTimeout(() => {
        if (!active) return;
        track('ai_action_coach_shown', { surface: 'shop_save_find' });
        setSaveFindCoachVisible(true);
      }, 700);
    }).catch(() => undefined);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [user?.id]);

  const dismissSaveFindCoach = useCallback((reason: 'got_it' | 'button_tap') => {
    const userId = user?.id;
    setSaveFindCoachVisible(false);
    track('ai_action_coach_dismissed', { surface: 'shop_save_find', reason });
    if (userId) void markAiActionCoachSeen('shop_save_find', userId);
  }, [user?.id]);

  const openShoppingCamera = useCallback(() => {
    dismissSaveFindCoach('button_tap');
    track('shop_action_selected', { action: 'evaluate_item' });
    navigation.navigate('ShoppingCamera');
  }, [dismissSaveFindCoach, navigation]);


  return (
    <View style={styles.root}>
        <View>
          <ScreenHeader
            title="Shop"
            titleVariant="display"
            subtitle="Buy fewer, better pieces"
            safeTop={false}
            style={{ paddingTop: insets.top + spacing.md }}
            primaryAction={{
              label: 'Save a find',
              icon: 'camera-outline',
              variant: 'secondary',
              onPress: openShoppingCamera,
            }}
          />
          {saveFindCoachVisible ? <View style={styles.saveFindTip} accessibilityLiveRegion="polite">
            <AppText variant="caption" tone="muted">Save a find: photograph a piece or price tag to revisit on your shortlist.</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss Save a find tip" onPress={() => dismissSaveFindCoach('got_it')} style={{ minHeight: 44, justifyContent: 'center' }}><AppText variant="caption" tone="primary">Got it</AppText></Pressable>
          </View> : null}
        </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.viewSwitch} contentContainerStyle={styles.viewSwitchContent}>
        <SegmentedControl value={view} variant="tabs" options={[{ value: 'for-you', label: 'For you' }, { value: 'shortlist', label: 'Shortlist' }]} onChange={selectView} />
      </ScrollView>
      <View style={[styles.pane, view !== 'for-you' && styles.hidden]} accessibilityElementsHidden={view !== 'for-you'} importantForAccessibility={view !== 'for-you' ? 'no-hide-descendants' : 'auto'}>
        <ScrollView
          key={fontScale}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.primary} />}
          contentContainerStyle={styles.content}
          onScroll={event => setScrollOffset(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={100}
        >
        {/* The brief is a section of this page like any other, so it wears the
            page's own department heading rather than a masthead of its own
            inside the panel — which put its label 16pt in from the gutter every
            other section label sits on, at a different size and colour. The
            issue line takes the header's `trailing` slot. */}
        <EditorialSection
          headingStyle="editorial"
          style={styles.section}
          title="For your wardrobe"
          trailing={<AppText variant="caption" tone="muted">{briefIssueLabel(brief.data)}</AppText>}
        >
          {isPremium && brief.data?.status === 'ready' ? <ShopWardrobeEdit
            brief={brief.data}
            scrollOffset={scrollOffset}
            wardrobe={wardrobe}
            onGuide={(priority) => {
              track('shopping_brief_priority_opened', { category: priority.category, reason: priority.reason, rank: priority.priority });
              navigation.navigate('ShoppingPriorityEdit', shoppingPriorityRoute(priority, brief.data!.generatedAt));
            }}
            onBrief={() => navigation.navigate('ShoppingBriefDetail')}
          /> : <View style={styles.briefPanel}>
              <ShoppingBriefCard
                isPremium={isPremium}
                brief={brief.data}
                wardrobe={wardrobe}
                isLoading={brief.isLoading}
                isError={brief.isError && !brief.data}
                onSelectPriority={(priority) => {
                  if (!brief.data) return;
                  track('shopping_brief_priority_opened', { category: priority.category, reason: priority.reason, rank: priority.priority });
                  navigation.navigate('ShoppingPriorityEdit', shoppingPriorityRoute(priority, brief.data.generatedAt));
                }}
                onOpenFullBrief={() => navigation.navigate('ShoppingBriefDetail')}
                onUpgrade={() => {
                  track('shop_brief_upgrade_tapped');
                  void presentPaywall();
                }}
                onAddWardrobePieces={() => (
                  navigation.getParent()?.navigate('Closet', { screen: 'ClosetMain', params: { segment: 'pieces' } })
                )}
                onRetry={() => void brief.refetch()}
              />
          </View>}
          {brief.isError && brief.data ? <AppText variant="caption" tone="muted">Your saved edit is here. We couldn’t refresh it just now.</AppText> : null}
        </EditorialSection>

        </ScrollView>
      </View>
      {shortlistMounted && <View style={[styles.pane, view !== 'shortlist' && styles.hidden]} accessibilityElementsHidden={view !== 'shortlist'} importantForAccessibility={view !== 'shortlist' ? 'no-hide-descendants' : 'auto'}>
        <ShortlistContent embedded active={view === 'shortlist'} navigation={navigation} params={route.params} onConsumeParams={navigation.setParams} />
      </View>}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        style={[styles.safeAreaScrim, { height: insets.top }]}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  saveFindTip: { paddingHorizontal: spacing.page, paddingBottom: spacing.md, gap: spacing.xs },
  content: { paddingBottom: spacing.xxxl },
  briefPanel: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: shoppingSurfaces.bone,
  },
  section: { paddingHorizontal: spacing.page },
  pane: { flex: 1 },
  hidden: { display: 'none' },
  viewSwitch: { flexGrow: 0, flexShrink: 0 },
  viewSwitchContent: { paddingHorizontal: spacing.page, paddingBottom: spacing.md },
  safeAreaScrim: { position: 'absolute', zIndex: 20, top: 0, left: 0, right: 0, backgroundColor: colors.background },
});
