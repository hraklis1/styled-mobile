import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { ShopWishlistSummaryCard } from '../../components/outfits/ShopWishlistSummaryCard';
import { ShoppingEditCard } from '../../components/shopping/ShoppingEditCard';
import { ShopStylistConsultationSheet } from '../../components/shopping/ShopStylistConsultationSheet';
import { GapCard } from '../../components/stylist/GapCard';
import { ActionButton, EditorialSection, ScreenHeader } from '../../components/primitives/Editorial';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useItems } from '../../hooks/useItems';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { useWishlist } from '../../hooks/useWishlist';
import { buildShoppingEditItems, mergeShoppingSnaps } from '../../lib/shoppingGallery';
import {
  buildShopConsultationPrompt,
  buildShopStylistLaunch,
  latestShoppingSummary,
  selectActiveShoppingFinds,
  type ShopConsultationTopic,
} from '../../lib/shopDecisionWorkspace';
import { formatShoppingPrice } from '../../lib/shoppingPresentation';
import { track } from '../../lib/analytics';
import { presentPaywall } from '../../lib/paywall';
import { colors, radii, spacing, typography } from '../../theme';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import type { ShopOverviewScreenProps } from '../../navigation/types';
import type { StylistMode } from '../../features/stylist/types';

export function ShopOverviewScreen({ navigation }: ShopOverviewScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPremium } = useEntitlement();
  const { openStylist } = useGlobalAIStylist();
  const { data: items = [], refetch: refetchItems } = useItems();
  const { data: remoteSnaps = [], refetch: refetchSnaps } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const { data: wishlist = [], refetch: refetchWishlist } = useWishlist();
  const brief = useShoppingBrief(isPremium);
  const [refreshing, setRefreshing] = useState(false);
  const [consultationVisible, setConsultationVisible] = useState(false);

  const shoppingItems = useMemo(
    () => buildShoppingEditItems(mergeShoppingSnaps(remoteSnaps, pendingUploads)),
    [pendingUploads, remoteSnaps],
  );
  const activeFinds = useMemo(() => selectActiveShoppingFinds(shoppingItems), [shoppingItems]);
  const recentShopping = useMemo(() => latestShoppingSummary(shoppingItems), [shoppingItems]);
  const savedLooks = useMemo(
    () => [...wishlist].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()).slice(0, 2),
    [wishlist],
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
      saved_look_count: wishlist.length,
      premium: isPremium,
    });
  }, [activeFinds.length, isPremium, wishlist.length]));

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      refetchItems(),
      refetchSnaps(),
      refetchWishlist(),
      ...(isPremium ? [brief.refetch()] : []),
    ]);
    setRefreshing(false);
  }, [brief, isPremium, refetchItems, refetchSnaps, refetchWishlist]);

  const openShoppingCamera = useCallback(() => {
    track('shop_action_selected', { action: 'evaluate_item' });
    navigation.navigate('ShoppingCamera');
  }, [navigation]);

  const askStylist = useCallback((query: string, mode: StylistMode = 'advice') => {
    track('shop_action_selected', { action: 'ask_stylist' });
    openStylist(buildShopStylistLaunch(query, mode));
  }, [openStylist]);

  const openConsultation = useCallback(() => {
    track('shop_action_selected', { action: 'consult_stylist' });
    setConsultationVisible(true);
  }, []);

  const openHistory = useCallback((params?: { focusGroupId?: string; catalogFilter?: 'active' | 'all' }) => {
    track('shop_section_opened', { section: params?.focusGroupId ? 'candidate' : 'shopping_history' });
    navigation.navigate('ShoppingGallery', params);
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
        <ScreenHeader
          eyebrow="Shop"
          title="Buy fewer, better pieces"
          subtitle="Make every addition earn its place in your wardrobe."
          safeTop
          style={styles.header}
        />

        <View style={styles.actionRow}>
          <ActionButton
            style={styles.primaryAction}
            label="Save a store find"
            icon="camera-outline"
            onPress={openShoppingCamera}
          />
          <ActionButton
            style={styles.secondaryAction}
            label="Consult Stylist"
            icon="sparkles-outline"
            variant="secondary"
            onPress={openConsultation}
          />
        </View>

        <EditorialSection title="Your shopping brief" style={styles.section}>
          {!isPremium ? (
            <View style={styles.briefCard}>
              <View style={styles.briefIcon}><Ionicons name="lock-closed-outline" size={18} color={colors.primary} /></View>
              <Text style={styles.briefTitle}>Unlock your Shopping Brief</Text>
              <Text style={styles.briefText}>See which additions would genuinely expand your wardrobe—and when you may be better off buying nothing.</Text>
              <ActionButton
                style={styles.inlineButton}
                label="See plans"
                icon="sparkles"
                onPress={() => {
                  track('shop_brief_upgrade_tapped');
                  void presentPaywall();
                }}
              />
            </View>
          ) : brief.isLoading ? (
            <View style={[styles.briefCard, styles.loadingCard]} accessibilityLabel="Building your Shopping Brief">
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.briefText}>Reviewing your wardrobe…</Text>
            </View>
          ) : brief.isError ? (
            <View style={styles.briefCard}>
              <Text style={styles.briefTitle}>Your brief is temporarily unavailable</Text>
              <Text style={styles.briefText}>Your shortlist and saved ideas are still here.</Text>
              <TouchableOpacity style={styles.textAction} onPress={() => void brief.refetch()} accessibilityRole="button">
                <Text style={styles.textActionLabel}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : brief.data ? (
            <View style={styles.briefCard}>
              <Text style={styles.briefTitle}>{brief.data.headline}</Text>
              <Text style={styles.briefText}>{brief.data.summary}</Text>
              {brief.data.status === 'insufficient_data' ? (
                <TouchableOpacity
                  style={styles.textAction}
                  onPress={() => navigation.getParent()?.navigate('Closet', { screen: 'ClosetMain', params: { segment: 'pieces' } })}
                  accessibilityRole="button"
                >
                  <Text style={styles.textActionLabel}>Add wardrobe pieces</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                </TouchableOpacity>
              ) : brief.data.priorities.map((priority) => (
                <GapCard
                  key={`${priority.priority}-${priority.label}`}
                  item={priority}
                  ctaLabel="Ask"
                  onPress={() => askStylist(`Help me shop thoughtfully for ${priority.label}. ${priority.context}`)}
                />
              ))}
            </View>
          ) : null}
        </EditorialSection>

        <EditorialSection style={styles.section} title="Decisions to make" actionLabel={activeFinds.length ? 'View shortlist' : undefined} onAction={() => openHistory({ catalogFilter: 'active' })}>
          <Text style={styles.decisionsDescription}>
            Store finds you’re considering, gathered here to help you decide what’s worth buying.
          </Text>
          {activeFinds.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
              {activeFinds.map((item) => (
                <ShoppingEditCard
                  key={item.id}
                  item={item}
                  width={220}
                  isSelected={false}
                  selectionMode={false}
                  onPress={() => {
                    track('shop_candidate_opened', { status: item.catalogStatus });
                    openHistory({ focusGroupId: item.captureGroupId, catalogFilter: 'active' });
                  }}
                  onLongPress={() => {}}
                />
              ))}
            </ScrollView>
          ) : (
            <EmptySection
              icon="camera-outline"
              title="Nothing waiting on a decision"
              text="Photograph a piece and its price tag while you shop."
              action="Save a store find"
              onPress={openShoppingCamera}
            />
          )}
        </EditorialSection>

        <EditorialSection style={styles.section} title="Saved looks" actionLabel={wishlist.length ? 'View all' : undefined} onAction={() => {
          track('shop_section_opened', { section: 'saved_looks' });
          navigation.navigate('SavedLooks');
        }}>
          {savedLooks.length > 0 ? (
            <View style={styles.savedLooks}>
              {savedLooks.map((entry) => (
                <ShopWishlistSummaryCard
                  key={entry.id}
                  entry={entry}
                  onPress={() => navigation.navigate('SavedLooks', { selectedId: entry.id })}
                  onMore={() => navigation.navigate('SavedLooks', { selectedId: entry.id })}
                />
              ))}
            </View>
          ) : (
            <EmptySection
              icon="heart-outline"
              title="Save ideas worth returning to"
              text="Ask your Stylist for a look, then save the ones that feel right."
              action="Shop with Stylist"
              onPress={() => askStylist('Shop for a versatile new outfit using what you know about my wardrobe', 'shop_new')}
            />
          )}
        </EditorialSection>

        <EditorialSection style={styles.section} title="Recent shopping" actionLabel={recentShopping ? 'View history' : undefined} onAction={() => openHistory({ catalogFilter: 'all' })}>
          {recentShopping ? (
            <TouchableOpacity style={styles.recentCard} onPress={() => openHistory({ catalogFilter: 'all' })} accessibilityRole="button">
              <View style={styles.recentIcon}><Ionicons name="bag-handle-outline" size={20} color={colors.primary} /></View>
              <View style={styles.recentCopy}>
                <Text style={styles.recentTitle}>{recentShopping.storeName}</Text>
                <Text style={styles.recentMeta}>
                  {new Date(recentShopping.capturedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {recentShopping.placeLabel ? ` · ${recentShopping.placeLabel}` : ''}
                </Text>
                <Text style={styles.recentMeta}>{recentShopping.itemCount} {recentShopping.itemCount === 1 ? 'item' : 'items'} reviewed</Text>
              </View>
              {recentShopping.knownSpend !== null ? <Text style={styles.recentSpend}>{formatShoppingPrice(recentShopping.knownSpend)}</Text> : null}
              <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.quietText}>Your store visits and evaluated pieces will appear here.</Text>
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

function EmptySection({ icon, title, text, action, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{text}</Text>
      </View>
      <TouchableOpacity onPress={onPress} style={styles.emptyAction} accessibilityRole="button">
        <Text style={styles.emptyActionText}>{action}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxxl },
  header: { paddingBottom: spacing.lg },
  actionRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xxl },
  primaryAction: { flex: 1, minHeight: 48 },
  secondaryAction: { flex: 1, minHeight: 48, borderColor: colors.hairline, backgroundColor: '#FFFCF9' },
  briefCard: { gap: spacing.md, padding: 20, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceSubtle },
  loadingCard: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  briefIcon: { width: 38, height: 38, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.primary}14` },
  briefTitle: { color: colors.foreground, fontSize: typography.size.xl, lineHeight: 25, fontWeight: typography.weight.semibold },
  briefText: { color: colors.mutedForeground, fontSize: typography.size.md, lineHeight: 23 },
  inlineButton: { alignSelf: 'flex-start' },
  textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs },
  textActionLabel: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  decisionsDescription: { color: colors.mutedForeground, fontSize: typography.size.sm, lineHeight: 20, marginBottom: spacing.md },
  horizontalCards: { gap: spacing.md, paddingRight: spacing.lg },
  savedLooks: { gap: spacing.md },
  emptyCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: colors.surfaceSubtle },
  emptyCopy: { gap: spacing.xs },
  emptyTitle: { color: colors.foreground, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  emptyText: { color: colors.mutedForeground, fontSize: typography.size.sm, lineHeight: 20 },
  emptyAction: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingVertical: spacing.xs },
  emptyActionText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  recentCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  recentIcon: { width: 44, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.primary}10` },
  recentCopy: { flex: 1, minWidth: 0, gap: 2 },
  recentTitle: { color: colors.foreground, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  recentMeta: { color: colors.mutedForeground, fontSize: typography.size.xs },
  recentSpend: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, fontVariant: ['tabular-nums'] },
  quietText: { color: colors.mutedForeground, fontSize: typography.size.sm, lineHeight: 20 },
  safeAreaScrim: { position: 'absolute', zIndex: 20, top: 0, left: 0, right: 0, backgroundColor: colors.background },
});
