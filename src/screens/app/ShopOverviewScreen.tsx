import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShoppingBriefCard, briefIssueLabel } from '../../components/shopping/ShoppingBriefCard';
import { ShoppingSurfaceLight } from '../../components/shopping/ShoppingSurfaceLight';
import { ShortlistCarousel } from '../../components/shopping/ShortlistCarousel';
import { SavedLookTile } from '../../components/outfits/SavedLookTile';
import { EditorialSection, ActionButton } from '../../components/primitives/Editorial';
import { AppText } from '../../components/primitives/AppText';
import { EditorialRow } from '../../components/primitives/EditorialRow';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useItems } from '../../hooks/useItems';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { useWishlist } from '../../hooks/useWishlist';
import { buildShoppingEditItems, mergeShoppingSnaps, type ShoppingEditItem } from '../../lib/shoppingGallery';
import { buildShortlistSpotlight } from '../../lib/shortlistSpotlight';
import { shoppingPriorityRoute } from '../../lib/shopClarity';
import { track } from '../../lib/analytics';
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
  const { isPremium } = useEntitlement();
  const { refetch: refetchItems } = useItems();
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

  const openShoppingCamera = useCallback(() => {
    track('shop_action_selected', { action: 'evaluate_item' });
    navigation.navigate('ShoppingCamera');
  }, [navigation]);


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
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerCopy}>
            <AppText variant="eyebrowLarge" tone="brand">SHOP</AppText>
            <AppText variant="editorialTitle" tone="primary">Buy fewer, better pieces</AppText>
          </View>
        </View>

        {/* One action under the masthead, with its explainer beside it rather
            than beneath: the brief is the page's premium content and belongs
            above the fold, and a two-line paragraph under the button pushed
            it off. The shortlist has its own door — the section's "See all"
            — so a second pill here only made a toolbar. */}
        <View style={styles.mastheadActions}>
          <ActionButton icon="camera-outline" label="Save a find"
            variant="secondary" onPress={openShoppingCamera} />
          <AppText variant="caption" tone="muted" style={styles.mastheadHint}>Snap a piece or its tag while you’re out — it’s filed to your Shortlist to revisit, compare and style later.</AppText>
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
          trailing={<AppText variant="caption" tone="muted">{briefIssueLabel()}</AppText>}
        >
          <View style={styles.briefShadow}>
            <View style={styles.briefPanel}>
              <ShoppingSurfaceLight />
              <ShoppingBriefCard
                isPremium={isPremium}
                brief={brief.data}
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
          description="Pieces you’ve found and are considering."
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
          description="Looks, pieces, and shopping guides you’ve saved from your Stylist."
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxxl },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.lg,
  },
  headerCopy: { flex: 1, gap: spacing.sm },
  mastheadActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.page, paddingBottom: spacing.lg },
  mastheadHint: { flex: 1, minWidth: 0 },
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
