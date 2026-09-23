import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOut, FadeOutDown, useReducedMotion } from 'react-native-reanimated';

import { EditorialSection } from '../../components/primitives/Editorial';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { sentenceCase, ShoppingPriorityRow } from '../../components/shopping/ShoppingPriorityRow';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useItems } from '../../hooks/useItems';
import { useNotNowShoppingPriority, useShoppingBrief } from '../../hooks/useShoppingBrief';
import { toLocalDateKey } from '../../lib/dailyStylistPick';
import { shoppingSurfaces, colors, radii, spacing, typography } from '../../theme';
import { shoppingPriorityRoute, wearableWardrobe, withoutOutfitCount } from '../../lib/shopClarity';
import { track } from '../../lib/analytics';
import type { ShoppingBriefDetailScreenProps } from '../../navigation/types';

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
  const { isPremium } = useEntitlement();
  const brief = useShoppingBrief(isPremium);
  const notNow = useNotNowShoppingPriority();
  const { data: items = [] } = useItems();
  const wardrobe = useMemo(() => wearableWardrobe(items), [items]);
  const insets = useSafeAreaInsets();
  // Skipped rows leave the list rather than lingering with a "skipped" label:
  // the brief cache is only refreshed on the next day's fetch.
  const [skippedKeys, setSkippedKeys] = useState<string[]>([]);
  // "Not for me" is reversible for a few seconds: the row leaves at once, a
  // toast offers Undo, and the server only hears about it once the toast has
  // gone. The server has no undo of its own, so the grace period is the undo.
  const [pendingSkip, setPendingSkip] = useState<{ key: string; label: string } | null>(null);
  const pendingSkipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();

  const commitSkip = useCallback((recommendationKey: string, localDate: string, meta: { category: string; reason: string; scope: string }) => {
    notNow.reset();
    notNow.mutate({ recommendationKey, localDate }, {
      onSuccess: () => track('shopping_brief_priority_not_now', meta),
      // Restore the row: a skip the server never recorded would reappear
      // tomorrow anyway, and leaving it hidden now would be a lie.
      onError: () => setSkippedKeys((keys) => keys.filter((key) => key !== recommendationKey)),
    });
  }, [notNow]);

  const undoSkip = useCallback(() => {
    if (pendingSkipTimer.current) clearTimeout(pendingSkipTimer.current);
    pendingSkipTimer.current = null;
    setPendingSkip((pending) => {
      if (pending) setSkippedKeys((keys) => keys.filter((key) => key !== pending.key));
      return null;
    });
  }, []);

  useEffect(() => () => {
    if (pendingSkipTimer.current) clearTimeout(pendingSkipTimer.current);
  }, []);

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
  const visiblePriorities = data.priorities.filter(
    (priority) => !priority.recommendationKey || !skippedKeys.includes(priority.recommendationKey),
  );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* The one place the summary appears in full — the card on Shop
            stops at the headline, and the edit moves on to the gap itself. */}
        <ShopSubpageHeader
          eyebrow="YOUR SHOPPING BRIEF"
          title={data.headline}
          subtitle={data.priorities.reduce((summary, priority) => withoutOutfitCount(summary, priority.impactScore), data.summary)}
          onBack={goBack}
          style={styles.header}
        />
        {notNow.isError ? <Text style={styles.errorNotice}>Couldn’t skip that suggestion. Tap “Not for me” to retry.</Text> : null}
        {visiblePriorities.length > 0 ? (
          <EditorialSection variant="ruled" title="Priorities" style={styles.priorities}>
            {visiblePriorities.map((priority, index) => {
              const skipping = notNow.isPending && notNow.variables?.recommendationKey === priority.recommendationKey;
              return (
                <Animated.View
                  key={`${priority.priority}-${priority.label}`}
                  exiting={reduceMotion ? undefined : FadeOut.duration(160)}
                >
                  <ShoppingPriorityRow
                    index={index + 1}
                    priority={priority}
                    wardrobe={wardrobe}
                    isLast={index === visiblePriorities.length - 1}
                    onPress={() => {
                      track('shopping_brief_priority_opened', { category: priority.category, reason: priority.reason, rank: priority.priority });
                      navigation.navigate('ShoppingPriorityEdit', shoppingPriorityRoute(priority, data.generatedAt));
                    }}
                    onSkip={priority.recommendationKey ? () => {
                      if (notNow.isPending) return;
                      const recommendationKey = priority.recommendationKey!;
                      const localDate = data.localDate ?? toLocalDateKey(new Date());
                      const meta = { category: priority.category, reason: priority.reason, scope: priority.scope ?? 'general' };
                      // A second skip while one is pending commits the first.
                      if (pendingSkipTimer.current) {
                        clearTimeout(pendingSkipTimer.current);
                        if (pendingSkip) commitSkip(pendingSkip.key, localDate, meta);
                      }
                      setSkippedKeys((keys) => [...keys, recommendationKey]);
                      setPendingSkip({ key: recommendationKey, label: sentenceCase(priority.label) });
                      pendingSkipTimer.current = setTimeout(() => {
                        pendingSkipTimer.current = null;
                        setPendingSkip(null);
                        commitSkip(recommendationKey, localDate, meta);
                      }, 4000);
                    } : undefined}
                    skipping={skipping}
                  />
                </Animated.View>
              );
            })}
          </EditorialSection>
        ) : null}
      </ScrollView>
      {/* The header scrolls away with the page, so the safe area gets its own
          canvas-coloured strip — body copy never runs under the clock. */}
      <View pointerEvents="none" accessibilityElementsHidden style={[styles.safeAreaScrim, { height: insets.top }]} />
      {pendingSkip ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.duration(160)}
          exiting={reduceMotion ? undefined : FadeOutDown.duration(120)}
          style={[styles.toast, { bottom: insets.bottom + spacing.lg }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.toastText} numberOfLines={1}>Skipped {pendingSkip.label}</Text>
          <Pressable onPress={undoSkip} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Undo skipping ${pendingSkip.label}`}>
            <Text style={styles.toastAction}>Undo</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: shoppingSurfaces.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shoppingSurfaces.canvas },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.page, paddingBottom: spacing.xxxl + spacing.xl },
  header: { marginHorizontal: -spacing.page, paddingBottom: spacing.lg, backgroundColor: shoppingSurfaces.canvas },
  // Tighter than the default ruled section so the first priority starts on
  // the first screen, under the full summary.
  priorities: { paddingTop: spacing.lg },
  safeAreaScrim: { position: 'absolute', zIndex: 20, top: 0, left: 0, right: 0, backgroundColor: shoppingSurfaces.canvas },
  errorNotice: { ...typography.text.caption, color: colors.destructive, paddingVertical: spacing.sm },
  toast: { position: 'absolute', left: spacing.page, right: spacing.page, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, boxShadow: '0 4px 14px rgba(40, 35, 31, 0.12)', zIndex: 20 },
  toastText: { flex: 1, ...typography.text.bodySmall, fontWeight: typography.weight.medium, color: colors.foreground },
  toastAction: { ...typography.text.label, color: colors.action },
});
