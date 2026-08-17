import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorialSection } from '../../components/primitives/Editorial';
import { PressableScale } from '../../components/primitives/PressableScale';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { sentenceCase } from '../../components/shopping/ShoppingBriefCard';
import { categoryIcon } from '../../components/stylist/GapCard';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { track } from '../../lib/analytics';
import { buildShopStylistLaunch } from '../../lib/shopDecisionWorkspace';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingBriefDetailScreenProps } from '../../navigation/types';
import type { StylistMode } from '../../features/stylist/types';

/**
 * The brief in full — everything ShoppingBriefCard clamps or drops to keep
 * Shop's first screen from being all brief. Reached only from a link on a
 * brief that has already loaded (the card, or Home's brief band), so a
 * missing brief here means the cache was evicted mid-visit rather than a
 * state this screen needs its own empty/upsell/error treatment for.
 *
 * ShopSubpageHeader lives inside the ScrollView as plain content — it
 * scrolls away with the rest of the page rather than pinning open. An
 * earlier *collapsing* header (masthead shrinking to a floating compact bar
 * as you scroll) broke scrolling on this same ScrollView container, but
 * that was the onScroll-driven collapse logic fighting the scroll position,
 * not the mere presence of the header inside the list. This version has no
 * scroll listener or header-driven re-layout, so it doesn't hit that bug —
 * confirmed by scrolling to the last priority with a multi-point drag
 * (touch_path) in the simulator.
 */
export function ShoppingBriefDetailScreen({ navigation }: ShoppingBriefDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPremium } = useEntitlement();
  const { openStylist } = useGlobalAIStylist();
  const brief = useShoppingBrief(isPremium);

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

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('ShopMain');
  }, [navigation]);

  if (brief.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!brief.data) {
    goBack();
    return null;
  }

  const { data } = brief;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ShopSubpageHeader
          eyebrow="YOUR SHOPPING BRIEF"
          title={data.headline}
          subtitle={data.summary}
          onBack={goBack}
          style={styles.header}
        />
        {data.priorities.length > 0 ? (
          <EditorialSection variant="ruled" title="Priorities">
            {data.priorities.map((priority) => (
              <View key={`${priority.priority}-${priority.label}`} style={styles.priorityRow}>
                <View style={styles.priorityHead}>
                  <Ionicons name={categoryIcon(priority.category)} size={16} color={colors.primary} />
                  <Text style={styles.priorityLabel}>{sentenceCase(priority.label)}</Text>
                </View>
                <Text style={styles.priorityContext}>{priority.context}</Text>
                {priority.unlocks.length > 0 ? (
                  <Text style={styles.priorityUnlocks}>Unlocks {priority.unlocks.join(' · ')}</Text>
                ) : null}
                <PressableScale
                  haptic={false}
                  scaleTo={0.97}
                  contentStyle={styles.askButton}
                  onPress={() => askStylist(`Help me shop thoughtfully for ${priority.label}. ${priority.context}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask your stylist about ${priority.label}`}
                >
                  <Text style={styles.askText}>Ask stylist</Text>
                  <Ionicons name="arrow-forward" size={13} color={colors.action} />
                </PressableScale>
              </View>
            ))}
          </EditorialSection>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PressableScale
          scaleTo={0.97}
          contentStyle={styles.startButton}
          onPress={() => askStylist('Help me choose my next best purchase.', 'shop_new')}
          accessibilityRole="button"
          accessibilityLabel="Ask your stylist what to buy first"
        >
          <Ionicons name="sparkles" size={15} color={colors.primaryForeground} />
          <Text style={styles.startLabel}>What should I buy first?</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  header: { marginHorizontal: -spacing.lg },
  priorityRow: {
    gap: 5,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  priorityHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityLabel: {
    flexShrink: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  priorityContext: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  priorityUnlocks: { fontSize: 11, lineHeight: 16, fontWeight: typography.weight.medium, color: colors.primary },
  askButton: {
    minHeight: 36,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: spacing.xs,
  },
  askText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.action },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: colors.background,
  },
  startButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  startLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});
