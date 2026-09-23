import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShoppingBriefCard, briefIssueLabel } from '../../components/shopping/ShoppingBriefCard';
import { ShoppingSurfaceLight } from '../../components/shopping/ShoppingSurfaceLight';
import { ShortlistCarousel } from '../../components/shopping/ShortlistCarousel';
import { SavedLookTile } from '../../components/outfits/SavedLookTile';
import { EditorialSection, ScreenHeader } from '../../components/primitives/Editorial';
import { AppText } from '../../components/primitives/AppText';
import { AiActionCoachmark } from '../../components/primitives/AiActionCoachmark';
import { EditorialRow } from '../../components/primitives/EditorialRow';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useItems } from '../../hooks/useItems';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { useWishlist } from '../../hooks/useWishlist';
import { buildShoppingEditItems, mergeShoppingSnaps, type ShoppingEditItem } from '../../lib/shoppingGallery';
import { buildShortlistSpotlight } from '../../lib/shortlistSpotlight';
import { shoppingPriorityRoute, wearableWardrobe } from '../../lib/shopClarity';
import { track } from '../../lib/analytics';
import { hasSeenAiActionCoach, markAiActionCoachSeen } from '../../lib/aiActionCoach';
import { presentPaywall } from '../../lib/paywall';
import { colors, radii, shoppingSurfaces, spacing } from '../../theme';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import type { ShopOverviewScreenProps } from '../../navigation/types';

/**
 * Shop answers two questions, in this order: what should I shop for (the
 * brief, summarized here and stated in full one tap away on
 * ShoppingBriefDetailScreen), and what have I already started (the shortlist
 * rail). All three sit in the first scroll — the camera lives in the header
 * instead of a card of its own, because saving a find is a one-tap habit
 * once you're in the app, not the thing the page needs to sell.
 */
export function ShopOverviewScreen({ navigation, route }: ShopOverviewScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isPremium } = useEntitlement();
  const { data: items = [], refetch: refetchItems } = useItems();
  const wardrobe = useMemo(() => wearableWardrobe(items), [items]);
  const { data: remoteSnaps = [], refetch: refetchSnaps } = useShoppingSnaps();
  const { data: savedShopping = [] } = useWishlist();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const brief = useShoppingBrief(isPremium);
  const [refreshing, setRefreshing] = useState(false);
  const requestedSection = route.params?.section;

  useEffect(() => {
    if (requestedSection === 'shortlist') {
      navigation.replace('ShoppingGallery', {
        catalogFilter: route.params?.catalogFilter,
        resetFilters: route.params?.resetFilters,
        focusGroupId: route.params?.focusGroupId,
        returnTo: route.params?.returnTo,
      });
    } else if (requestedSection === 'saved-looks' || requestedSection === 'saved-shopping') {
      navigation.replace('SavedShopping', { selectedId: route.params?.selectedId, tab: requestedSection === 'saved-looks' ? 'looks' : 'all' });
    }
  }, [navigation, route.params?.resetFilters, requestedSection, route.params?.catalogFilter, route.params?.focusGroupId, route.params?.returnTo, route.params?.selectedId]);

  const homeCurrency = useCurrencyCode();
  const shoppingItems = useMemo(
    () => buildShoppingEditItems(mergeShoppingSnaps(remoteSnaps, pendingUploads), { homeCurrency }),
    [homeCurrency, pendingUploads, remoteSnaps],
  );
  const spotlight = useMemo(() => buildShortlistSpotlight(shoppingItems), [shoppingItems]);
  const activeFinds = spotlight.awaitingDecision;
  const savedPreviewEntries = useMemo(
    () => [...savedShopping]
      .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
      .slice(0, 2),
    [savedShopping],
  );

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

  // ── First-run "Save a find" coachmark ───────────────────────────────────────
  // The button lost its standing caption when it moved into the masthead, so
  // what it does is explained once, pointed at the button itself, and never
  // again.
  const [saveFindCoachVisible, setSaveFindCoachVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

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


  const openHistory = useCallback((params?: { focusGroupId?: string; catalogFilter?: 'active' | 'all'; resetFilters?: boolean }) => {
    track('shop_section_opened', { section: params?.focusGroupId ? 'candidate' : 'shopping_history' });
    navigation.navigate('ShoppingGallery', params);
  }, [navigation]);

  const openFind = useCallback((item: ShoppingEditItem) => {
    track('shop_section_opened', { section: 'shortlist' });
    navigation.navigate('ShoppingGallery', { focusGroupId: item.captureGroupId });
  }, [navigation]);

  const openSavedShopping = useCallback((selectedId?: string) => {
    track('shop_destination_opened', { destination: 'saved-shopping' });
    navigation.navigate('SavedShopping', { tab: 'all', ...(selectedId ? { selectedId } : {}) });
  }, [navigation]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
      >
        {/* The tab masthead is the shared ScreenHeader the other tabs wear —
            page name in the display face, tagline demoted to its subtitle.
            Shop used to invert that (a small SHOP eyebrow over an editorial
            tagline), which read as a different kind of page. */}
        <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
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
        </View>

        {/* The brief is a section of this page like any other, so it wears the
            page's own department heading rather than a masthead of its own
            inside the panel — which put its label 16pt in from the gutter every
            other section label sits on, at a different size and colour. The
            issue line takes the header's `trailing` slot. */}
        <EditorialSection
          headingStyle="editorial"
          style={styles.section}
          title="Your shopping brief"
          description="The gaps in your wardrobe worth filling this month, most useful first."
          trailing={<AppText variant="caption" tone="muted">{briefIssueLabel()}</AppText>}
        >
          <View style={styles.briefShadow}>
            <View style={styles.briefPanel}>
              <ShoppingSurfaceLight />
              <ShoppingBriefCard
                isPremium={isPremium}
                brief={brief.data}
                wardrobe={wardrobe}
                isLoading={brief.isLoading}
                isError={brief.isError}
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
            </View>
          </View>
        </EditorialSection>

        <EditorialSection
          variant="ruled"
          headingStyle="editorial"
          style={styles.section}
          title="Your shortlist"
          description={spotlight.itemCount > 0 ? undefined : 'Pieces you’ve found and are considering.'}
          actionLabel={spotlight.itemCount > 0 ? `See all ${spotlight.itemCount}` : undefined}
          onAction={() => openHistory({ catalogFilter: 'all', resetFilters: true })}
        >
          {spotlight.itemCount > 0 ? (
            <>
              <ShortlistCarousel
                items={spotlight.railItems}
                totalCount={spotlight.itemCount}
                onPressItem={openFind}
                onSeeAll={() => openHistory({ catalogFilter: 'all', resetFilters: true })}
              />
            </>
          ) : (
            <EditorialRow
              variant="filled"
              icon="camera-outline"
              title="Nothing on your shortlist yet"
              description="Photograph a piece and its price tag while you shop, and keep it here until you decide."
              onPress={openShoppingCamera}
            />
          )}
        </EditorialSection>

        <EditorialSection
          variant="ruled"
          headingStyle="editorial"
          style={styles.section}
          title="Saved recommendations"
          description={savedPreviewEntries.length > 0 ? undefined : 'Looks, pieces, and shopping guides you’ve saved from your Stylist.'}
          actionLabel={savedShopping.length > 0 ? `See all ${savedShopping.length}` : undefined}
          onAction={() => openSavedShopping()}
        >
          {savedPreviewEntries.length > 0 ? (
            <View style={styles.savedPreviewGrid}>
              {savedPreviewEntries.map((entry) => (
                <SavedLookTile
                  key={entry.id}
                  entry={entry}
                  style={savedPreviewEntries.length === 1 ? styles.savedPreviewSingle : undefined}
                  onPress={() => openSavedShopping(entry.id)}
                />
              ))}
            </View>
          ) : (
            <EditorialRow
              variant="filled"
              icon="heart-outline"
              title="Nothing saved yet"
              description="Looks, pieces, and lists from your Stylist will appear here."
              onPress={() => openSavedShopping()}
              accessibilityLabel="Open your saved Stylist picks"
              accessibilityHint="Opens saved looks, pieces, and lists"
            />
          )}
        </EditorialSection>

      </ScrollView>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        style={[styles.safeAreaScrim, { height: insets.top }]}
      />
      {/* Hung off the measured masthead height so the caret stays under the
          button whatever the header measures at. */}
      <AiActionCoachmark
        visible={saveFindCoachVisible && headerHeight > 0}
        title="Save a find"
        body="Snap a piece or its price tag while you're in store. It's filed to your Shortlist so you can decide later."
        onDismiss={() => dismissSaveFindCoach('got_it')}
        style={{ top: headerHeight - spacing.sm, right: spacing.page }}
        caretRight={36}
        scrimAccessibilityLabel="Dismiss the Save a find tip"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxxl },
  // A flat surfaceSubtle plate was tried here and rejected — 1.02:1 against
  // the page ground with no edge to read. The separation comes from the edge,
  // the lit top lip and the shadow instead, which is the recipe
  // ShoppingPriorityEditScreen's metric panel already uses; the brief now
  // rhymes with the guide screen it opens.
  //
  // Split in two on purpose: the outer view carries the shadow and must not
  // clip, the inner one clips the gradient to the radius.
  briefShadow: { borderRadius: radii.md, boxShadow: shoppingSurfaces.panelShadow },
  briefPanel: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shoppingSurfaces.edge,
    backgroundColor: shoppingSurfaces.alabaster,
  },
  section: { paddingHorizontal: spacing.page },
  savedPreviewGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  // A lone tile keeps to half the row rather than swelling to a full-width plate.
  savedPreviewSingle: { flex: 0, width: '48%' },
  safeAreaScrim: { position: 'absolute', zIndex: 20, top: 0, left: 0, right: 0, backgroundColor: colors.background },
});
