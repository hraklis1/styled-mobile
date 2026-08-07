import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { ShopStylistConsultationSheet } from '../../components/shopping/ShopStylistConsultationSheet';
import { ShoppingBriefCard } from '../../components/shopping/ShoppingBriefCard';
import { ShortlistCarousel } from '../../components/shopping/ShortlistCarousel';
import { EditorialSection } from '../../components/primitives/Editorial';
import { PressableScale } from '../../components/primitives/PressableScale';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useItems } from '../../hooks/useItems';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { buildShoppingEditItems, mergeShoppingSnaps, type ShoppingEditItem } from '../../lib/shoppingGallery';
import {
  buildShopConsultationPrompt,
  buildShopStylistLaunch,
  type ShopConsultationTopic,
} from '../../lib/shopDecisionWorkspace';
import { buildShortlistSpotlight } from '../../lib/shortlistSpotlight';
import { track } from '../../lib/analytics';
import { presentPaywall } from '../../lib/paywall';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import type { ShopOverviewScreenProps } from '../../navigation/types';
import type { StylistMode } from '../../features/stylist/types';

/**
 * Shop answers two questions, in this order: what should I shop for (the brief,
 * stated in full, ending in the way to act on it), and what have I already
 * started (the shortlist rail). The camera opens the page as a quiet white
 * strip, because saving a find is what the user is doing while standing in a
 * shop — everything below it is for planning.
 */
export function ShopOverviewScreen({ navigation }: ShopOverviewScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPremium } = useEntitlement();
  const { openStylist } = useGlobalAIStylist();
  const { refetch: refetchItems } = useItems();
  const { data: remoteSnaps = [], refetch: refetchSnaps } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const brief = useShoppingBrief(isPremium);
  const [refreshing, setRefreshing] = useState(false);
  const [consultationVisible, setConsultationVisible] = useState(false);

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
    openStylist(buildShopStylistLaunch(query, mode));
  }, [openStylist]);

  const startShopping = useCallback(() => {
    track('shop_action_selected', { action: 'start_shopping' });
    setConsultationVisible(true);
  }, []);

  const openHistory = useCallback((params?: { focusGroupId?: string; catalogFilter?: 'active' | 'all' }) => {
    track('shop_section_opened', { section: params?.focusGroupId ? 'candidate' : 'shopping_history' });
    navigation.navigate('ShoppingGallery', params);
  }, [navigation]);

  const openFind = useCallback((item: ShoppingEditItem) => {
    track('shop_section_opened', { section: 'shortlist' });
    navigation.navigate('ShoppingGallery', { focusGroupId: item.captureGroupId });
  }, [navigation]);

  const selectConsultation = useCallback((topic: ShopConsultationTopic) => {
    track('shop_consultation_selected', {
      topic,
      premium: isPremium,
      active_find_count: activeFinds.length,
    });

    if (topic === 'review_find') {
      if (activeFinds.length > 0) openHistory({ catalogFilter: 'active' });
      else openShoppingCamera();
      return;
    }

    if (topic === 'custom') {
      openStylist({ source: 'shop' });
      return;
    }

    const prompt = buildShopConsultationPrompt(topic, brief.data);
    if (prompt) openStylist(buildShopStylistLaunch(prompt));
  }, [activeFinds.length, brief.data, isPremium, openHistory, openShoppingCamera, openStylist]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Text style={styles.eyebrow}>SHOP</Text>
          <Text style={styles.headerTitle}>Buy fewer, better pieces</Text>
          <Text style={styles.headerDeck}>Shop intentionally, with your wardrobe in mind.</Text>
        </View>

        <SaveFindCard onPress={openShoppingCamera} />

        <ShoppingBriefCard
          style={styles.brief}
          isPremium={isPremium}
          brief={brief.data}
          isLoading={brief.isLoading}
          isError={brief.isError}
          onSelectPriority={(priority) => (
            askStylist(`Help me shop thoughtfully for ${priority.label}. ${priority.context}`)
          )}
          onStartShopping={startShopping}
          onUpgrade={() => {
            track('shop_brief_upgrade_tapped');
            void presentPaywall();
          }}
          onAddWardrobePieces={() => (
            navigation.getParent()?.navigate('Closet', { screen: 'ClosetMain', params: { segment: 'pieces' } })
          )}
          onRetry={() => void brief.refetch()}
        />

        <EditorialSection
          style={styles.section}
          title="Your Shortlist"
          description="Pieces you photographed while shopping, kept here until you price them and decide."
          actionLabel={spotlight.itemCount > 0 ? 'See all' : undefined}
          onAction={() => openHistory({ catalogFilter: activeFinds.length > 0 ? 'active' : 'all' })}
        >
          {spotlight.itemCount > 0 ? (
            <ShortlistCarousel
              items={spotlight.railItems}
              totalCount={spotlight.itemCount}
              onPressItem={openFind}
              onSeeAll={() => openHistory({ catalogFilter: 'all' })}
            />
          ) : (
            <EmptyRow
              icon="camera-outline"
              title="Nothing on your shortlist yet"
              text="Photograph a piece and its price tag while you shop, and keep it here until you decide."
              onPress={openShoppingCamera}
            />
          )}
        </EditorialSection>

      </ScrollView>
      <ShopStylistConsultationSheet
        visible={consultationVisible}
        hasActiveFinds={activeFinds.length > 0}
        onSelect={selectConsultation}
        onClose={() => setConsultationVisible(false)}
      />
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        style={[styles.safeAreaScrim, { height: insets.top }]}
      />
    </View>
  );
}

/**
 * The way into the camera, kept in the feed rather than the header's corner:
 * shopping happens with the phone already out, so the invitation to save a find
 * should be legible at a glance instead of hidden behind an icon.
 */
function SaveFindCard({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      scaleTo={0.99}
      style={styles.saveFindLayout}
      contentStyle={styles.saveFind}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Window shopping? Save items here to review before you buy"
      accessibilityHint="Opens the camera"
    >
      {/* Warm white lifting off the ivory ground — the page's only gradient, and
          faint enough to read as light on paper rather than as a second brand
          surface. Rounded rather than clipped so the shadow is not cut off. */}
      <LinearGradient
        colors={['#FFFFFF', '#FBF4EA']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.saveFindSheen}
      />
      <View style={styles.saveFindCopy}>
        <Text style={styles.saveFindTitle}>Window shopping?</Text>
        <Text style={styles.saveFindText}>Save items here to review before you buy.</Text>
      </View>
      {/* Reads as the button it is, but stays inside the row's single press
          target — two nested controls would only split the tap area. */}
      <View style={styles.saveFindButton}>
        <Ionicons name="camera" size={19} color={colors.primaryForeground} />
      </View>
    </PressableScale>
  );
}

/**
 * The shortlist's empty state. Deliberately a single quiet row: the brief above
 * already carries the call to action, so an empty section only needs to say
 * what would live here.
 */
function EmptyRow({
  icon,
  title,
  text,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.99}
      contentStyle={styles.emptyRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${text}`}
    >
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxxl },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  eyebrow: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    letterSpacing: 2.1,
    color: colors.primary,
  },
  headerTitle: {
    paddingTop: spacing.sm,
    fontFamily: typography.family.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.foreground,
  },
  headerDeck: {
    maxWidth: 320,
    paddingTop: spacing.xs,
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  saveFindLayout: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  // Raised on a warm shadow against the brief's flat tinted block below: the two
  // sit next to each other, so depth is what tells you which one you can press.
  saveFind: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceElevated,
    ...shadows.warm,
  },
  saveFindSheen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  saveFindCopy: { flex: 1, gap: 2 },
  saveFindTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  saveFindText: { fontSize: typography.size.xs, lineHeight: 17, color: colors.mutedForeground },
  saveFindButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  brief: { marginHorizontal: spacing.lg, marginBottom: spacing.xxl },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xxl },
  emptyRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}14`,
  },
  emptyCopy: { flex: 1, gap: 2 },
  emptyTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  emptyText: { fontSize: typography.size.xs, lineHeight: 17, color: colors.mutedForeground },
  safeAreaScrim: { position: 'absolute', zIndex: 20, top: 0, left: 0, right: 0, backgroundColor: colors.background },
});
