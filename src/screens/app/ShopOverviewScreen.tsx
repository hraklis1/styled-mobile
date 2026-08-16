import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { ShoppingBriefCard } from '../../components/shopping/ShoppingBriefCard';
import { ShortlistCarousel } from '../../components/shopping/ShortlistCarousel';
import { EditorialSection, IconButton } from '../../components/primitives/Editorial';
import { EditorialRow } from '../../components/primitives/EditorialRow';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useItems } from '../../hooks/useItems';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { useWishlist } from '../../hooks/useWishlist';
import { buildShoppingEditItems, mergeShoppingSnaps, type ShoppingEditItem } from '../../lib/shoppingGallery';
import {
  buildShopStylistLaunch,
} from '../../lib/shopDecisionWorkspace';
import { buildShortlistSpotlight } from '../../lib/shortlistSpotlight';
import { track } from '../../lib/analytics';
import { presentPaywall } from '../../lib/paywall';
import { colors, spacing, typography } from '../../theme';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import type { ShopOverviewScreenProps } from '../../navigation/types';
import type { StylistMode } from '../../features/stylist/types';

/**
 * Shop answers two questions, in this order: what should I shop for (the brief,
 * stated in full, ending in the way to act on it), and what have I already
 * started (the shortlist rail). Both sit in the first scroll — the camera lives
 * in the header instead of a card of its own, because saving a find is a
 * one-tap habit once you're in the app, not the thing the page needs to sell.
 */
export function ShopOverviewScreen({ navigation, route }: ShopOverviewScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPremium } = useEntitlement();
  const { openStylist } = useGlobalAIStylist();
  const { refetch: refetchItems } = useItems();
  const { data: remoteSnaps = [], refetch: refetchSnaps } = useShoppingSnaps();
  const { data: savedShopping = [] } = useWishlist();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const brief = useShoppingBrief(isPremium);
  const [refreshing, setRefreshing] = useState(false);
  const requestedSection = route.params?.section ?? 'brief';
  const scrollRef = useRef<ScrollView>(null);
  // Set only when a caller explicitly asks for the brief (Home's "Read the
  // brief" link) — not on `requestedSection`, which defaults to 'brief' on
  // every plain tab tap and would hijack scroll position on normal visits.
  const pendingBriefScroll = useRef(false);
  useEffect(() => {
    if (route.params?.section === 'brief') pendingBriefScroll.current = true;
  }, [route.params?.section]);

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

  const askStylist = useCallback((query: string, mode: StylistMode = 'advice') => {
    track('shop_action_selected', { action: 'ask_stylist' });
    openStylist({
      ...buildShopStylistLaunch(query, mode),
      onNavigateToCloset: (outfitId) => navigation.navigate('Closet', {
        screen: 'OutfitDetail',
        params: { outfitId, returnTo: 'Home' },
      }),
    });
  }, [navigation, openStylist]);

  const openHistory = useCallback((params?: { focusGroupId?: string; catalogFilter?: 'active' | 'all' }) => {
    track('shop_section_opened', { section: params?.focusGroupId ? 'candidate' : 'shopping_history' });
    navigation.navigate('ShoppingGallery', params);
  }, [navigation]);

  const openFind = useCallback((item: ShoppingEditItem) => {
    track('shop_section_opened', { section: 'shortlist' });
    navigation.navigate('ShoppingGallery', { focusGroupId: item.captureGroupId });
  }, [navigation]);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>SHOP</Text>
            <Text style={styles.headerTitle}>Buy fewer, better pieces</Text>
          </View>
          <IconButton
            icon="camera-outline"
            label="Save a find"
            variant="secondary"
            onPress={openShoppingCamera}
            accessibilityLabel="Window shopping? Save items here to review before you buy"
          />
        </View>

        <View
          onLayout={(e) => {
            if (!pendingBriefScroll.current) return;
            pendingBriefScroll.current = false;
            const y = e.nativeEvent.layout.y;
            requestAnimationFrame(() => {
              scrollRef.current?.scrollTo({ y: Math.max(y - spacing.lg, 0), animated: true });
            });
          }}
        >
          <ShoppingBriefCard
            style={styles.brief}
            isPremium={isPremium}
            brief={brief.data}
            isLoading={brief.isLoading}
            isError={brief.isError}
            onSelectPriority={(priority) => (
              askStylist(`Help me shop thoughtfully for ${priority.label}. ${priority.context}`)
            )}
            onStartShopping={() => askStylist('Help me choose my next best purchase.', 'shop_new')}
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
          style={styles.section}
          title="Your Shortlist"
          description="Pieces you photographed while shopping, kept here until you price them and decide."
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

        <EditorialSection variant="ruled" style={styles.section} title="Your Stylist">
          <View style={styles.stylistList}>
            <EditorialRow
              icon="heart-outline"
              title="From Your Stylist"
              description="Looks, pieces, and lists your Stylist put aside for you."
              meta={savedShopping.length > 0 ? `${savedShopping.length} saved` : 'Nothing saved yet'}
              onPress={() => {
                track('shop_destination_opened', { destination: 'saved-shopping' });
                navigation.navigate('SavedShopping');
              }}
              accessibilityLabel="Open your saved Stylist picks"
              accessibilityHint="Opens this Shop page"
            />
            <EditorialRow
              icon="chatbubble-outline"
              title="Shop with your Stylist"
              description="Ask a focused question before you buy."
              onPress={() => openStylist({ source: 'shop' })}
              accessibilityLabel="Ask your AI Stylist a shopping question"
            />
          </View>
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
  eyebrow: { ...typography.eyebrowLarge, color: colors.primary },
  headerTitle: {
    fontFamily: typography.family.display,
    ...typography.display.md,
    color: colors.foreground,
  },
  brief: { marginHorizontal: spacing.lg },
  section: { paddingHorizontal: spacing.lg },
  stylistList: { gap: spacing.xs },
  safeAreaScrim: { position: 'absolute', zIndex: 20, top: 0, left: 0, right: 0, backgroundColor: colors.background },
});
