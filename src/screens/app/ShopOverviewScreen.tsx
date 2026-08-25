import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShoppingBriefCard } from '../../components/shopping/ShoppingBriefCard';
import { ShortlistCarousel } from '../../components/shopping/ShortlistCarousel';
import { SavedLookTile } from '../../components/outfits/SavedLookTile';
import { EditorialSection, IconButton } from '../../components/primitives/Editorial';
import { AppText } from '../../components/primitives/AppText';
import { EditorialRow } from '../../components/primitives/EditorialRow';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useItems } from '../../hooks/useItems';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { useWishlist } from '../../hooks/useWishlist';
import { buildShoppingEditItems, mergeShoppingSnaps, type ShoppingEditItem } from '../../lib/shoppingGallery';
import { buildShortlistSpotlight } from '../../lib/shortlistSpotlight';
import { track } from '../../lib/analytics';
import { presentPaywall } from '../../lib/paywall';
import { colors, spacing } from '../../theme';
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
        focusGroupId: route.params?.focusGroupId,
        returnTo: route.params?.returnTo,
      });
    } else if (requestedSection === 'saved-looks' || requestedSection === 'saved-shopping') {
      navigation.replace('SavedShopping', { selectedId: route.params?.selectedId, tab: 'looks' });
    }
  }, [navigation, requestedSection, route.params?.catalogFilter, route.params?.focusGroupId, route.params?.returnTo, route.params?.selectedId]);

  const shoppingItems = useMemo(
    () => buildShoppingEditItems(mergeShoppingSnaps(remoteSnaps, pendingUploads)),
    [pendingUploads, remoteSnaps],
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


  const openHistory = useCallback((params?: { focusGroupId?: string; catalogFilter?: 'active' | 'all' }) => {
    track('shop_section_opened', { section: params?.focusGroupId ? 'candidate' : 'shopping_history' });
    navigation.navigate('ShoppingGallery', params);
  }, [navigation]);

  const openFind = useCallback((item: ShoppingEditItem) => {
    track('shop_section_opened', { section: 'shortlist' });
    navigation.navigate('ShoppingGallery', { focusGroupId: item.captureGroupId });
  }, [navigation]);

  const openSavedShopping = useCallback((selectedId?: string) => {
    track('shop_destination_opened', { destination: 'saved-shopping' });
    navigation.navigate('SavedShopping', selectedId ? { selectedId } : undefined);
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
          <IconButton
            icon="camera-outline"
            label="Save a find"
            variant="primary"
            onPress={openShoppingCamera}
            accessibilityLabel="Window shopping? Save items here to review before you buy"
          />
        </View>

        <View style={styles.briefBand}>
          <ShoppingBriefCard
            isPremium={isPremium}
            brief={brief.data}
            isLoading={brief.isLoading}
            isError={brief.isError}
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

        <EditorialSection
          variant="ruled"
          headingStyle="editorial"
          style={[styles.section, styles.firstSection]}
          title="Your Shortlist"
          description="Pieces you’re considering, kept until you decide."
          actionLabel={spotlight.itemCount > 0 ? 'See all' : undefined}
          onAction={() => openHistory({ catalogFilter: activeFinds.length > 0 ? 'active' : 'all' })}
        >
          {spotlight.itemCount > 0 ? (
            <>
              <ShortlistCarousel
                items={spotlight.railItems}
                totalCount={spotlight.itemCount}
                onPressItem={openFind}
                onSeeAll={() => openHistory({ catalogFilter: 'all' })}
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
          title="Saved by Your Stylist"
          actionLabel={savedShopping.length > 0 ? `${savedShopping.length} saved` : undefined}
          onAction={() => openSavedShopping()}
        >
          {savedPreviewEntries.length > 0 ? (
            <View style={styles.savedPreviewGrid}>
              {savedPreviewEntries.map((entry) => (
                <SavedLookTile
                  key={entry.id}
                  entry={entry}
                  style={savedPreviewEntries.length > 1 ? styles.savedPreviewTile : undefined}
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerCopy: { flex: 1, gap: spacing.sm },
  // The brief is the page's cover feature, not another department: a full-
  // width tinted ground breaks it out of the uniform gutter every other
  // section shares, so it reads as the one thing the page leads with.
  briefBand: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 0,
  },
  section: { paddingHorizontal: spacing.lg },
  savedPreviewGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  savedPreviewTile: { width: undefined, flex: 1 },
  // Extra air below the tinted band before the first editorial department,
  // stacked on top of ruledSection's own paddingVertical, so the shift back
  // to the page ground reads as a deliberate break rather than two sections
  // sharing one rule.
  firstSection: { marginTop: spacing.sm },
  safeAreaScrim: { position: 'absolute', zIndex: 20, top: 0, left: 0, right: 0, backgroundColor: colors.background },
});
