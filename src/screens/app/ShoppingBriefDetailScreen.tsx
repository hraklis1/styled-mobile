import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';

import { EditorialSection } from '../../components/primitives/Editorial';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { ShoppingPriorityRow } from '../../components/shopping/ShoppingPriorityRow';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useNotNowShoppingPriority, useShoppingBrief } from '../../hooks/useShoppingBrief';
import { toLocalDateKey } from '../../lib/dailyStylistPick';
import { colors, spacing, typography } from '../../theme';
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
  const [notNowNotice, setNotNowNotice] = useState(false);
  // Skipped rows leave the list rather than lingering with a "skipped" label:
  // the brief cache is only refreshed on the next day's fetch.
  const [skippedKeys, setSkippedKeys] = useState<string[]>([]);
  const reduceMotion = useReducedMotion();

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
          subtitle={data.summary}
          onBack={goBack}
          style={styles.header}
        />
        {notNowNotice ? <Text style={styles.notice}>Suggestion skipped for now.</Text> : null}
        {notNow.isError ? <Text style={styles.errorNotice}>Couldn’t skip this suggestion. Tap “Not for me” to retry.</Text> : null}
        {visiblePriorities.length > 0 ? (
          <EditorialSection variant="ruled" title="Priorities">
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
                    isLast={index === visiblePriorities.length - 1}
                    onPress={() => {
                      track('shopping_brief_priority_opened', { category: priority.category, reason: priority.reason, rank: priority.priority });
                      navigation.navigate('ShoppingPriorityEdit', {
                        priority,
                        origin: 'shopping_brief',
                        briefGeneratedAt: data.generatedAt,
                      });
                    }}
                    onSkip={priority.recommendationKey ? () => {
                      if (notNow.isPending) return;
                      const recommendationKey = priority.recommendationKey!;
                      notNow.reset();
                      notNow.mutate({
                        recommendationKey,
                        localDate: data.localDate ?? toLocalDateKey(new Date()),
                      }, { onSuccess: () => {
                        setSkippedKeys((keys) => [...keys, recommendationKey]);
                        setNotNowNotice(true);
                        track('shopping_brief_priority_not_now', { category: priority.category, reason: priority.reason, scope: priority.scope ?? 'general' });
                      } });
                    } : undefined}
                    skipping={skipping}
                  />
                </Animated.View>
              );
            })}
          </EditorialSection>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl + spacing.xl },
  header: { marginHorizontal: -spacing.lg },
  notice: { ...typography.text.caption, color: colors.mutedForeground, paddingVertical: spacing.sm },
  errorNotice: { ...typography.text.caption, color: colors.destructive, paddingVertical: spacing.sm },
});
