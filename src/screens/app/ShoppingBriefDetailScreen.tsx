import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialSection } from '../../components/primitives/Editorial';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { BriefNote } from '../../components/shopping/ShoppingBriefCard';
import { ShoppingPriorityRow } from '../../components/shopping/ShoppingPriorityRow';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useItems } from '../../hooks/useItems';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { useShoppingFeedback } from '../../hooks/useShoppingFeedback';
import { toLocalDateKey } from '../../lib/dailyStylistPick';
import { shoppingSurfaces, colors, spacing, typography } from '../../theme';
import { shoppingPriorityRoute, wearableWardrobe, withoutOutfitCount } from '../../lib/shopClarity';
import { track } from '../../lib/analytics';
import type { ShoppingBriefDetailScreenProps } from '../../navigation/types';

export function ShoppingBriefDetailScreen({ navigation }: ShoppingBriefDetailScreenProps) {
  const { isPremium } = useEntitlement();
  const brief = useShoppingBrief(isPremium);
  const feedback = useShoppingFeedback();
  const { data: items = [] } = useItems();
  const wardrobe = useMemo(() => wearableWardrobe(items), [items]);
  const insets = useSafeAreaInsets();
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('ShopMain');
  }, [navigation]);
  const data = brief.data;
  const pending = feedback.pending.filter(
    (entry) =>
      entry.localDate === (data?.localDate ?? toLocalDateKey(new Date())) && !entry.submitting,
  );
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing.xxxl + pending.length * 56 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ShopSubpageHeader
          editorialSize
          eyebrow="YOUR SHOPPING BRIEF"
          title={data?.headline ?? 'Your shopping brief'}
          onBack={goBack}
          style={styles.header}
        />
        {!data ? (
          <View style={styles.state}>
            {brief.isLoading ? (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.copy}>Reviewing your wardrobe…</Text>
              </>
            ) : (
              <>
                <Text style={styles.copy}>
                  {!isPremium
                    ? 'Your Shopping Brief is included with your premium stylist.'
                    : brief.fetchStatus === 'paused'
                      ? 'Connect to the internet to open your brief.'
                      : 'Your brief is temporarily unavailable.'}
                </Text>
                <Pressable
                  onPress={
                    isPremium
                      ? () => {
                          void brief.refetch();
                        }
                      : goBack
                  }
                  accessibilityRole="button"
                  style={styles.action}
                >
                  <Text style={styles.actionText}>{isPremium ? 'Try again' : 'Back to Shop'}</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <>
            <BriefNote
              full
              text={data.priorities.reduce(
                (summary, priority) => withoutOutfitCount(summary, priority.impactScore),
                data.summary,
              )}
            />
            {brief.isError ? (
              <Text accessibilityLiveRegion="polite" style={styles.copy}>
                You’re reading your saved brief. We couldn’t refresh it just now.
              </Text>
            ) : null}
            {feedback.error ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {feedback.error}
              </Text>
            ) : null}
            {data.priorities.length ? (
              <EditorialSection
                variant="ruled"
                title="Your next additions"
                style={styles.priorities}
              >
                {data.priorities.map((priority, index) => (
                  <ShoppingPriorityRow
                    key={priority.recommendationKey ?? `${priority.priority}-${priority.label}`}
                    index={index + 1}
                    priority={priority}
                    wardrobe={wardrobe}
                    isLast={index === data.priorities.length - 1}
                    onPress={() => {
                      track('shopping_brief_priority_opened', {
                        category: priority.category,
                        reason: priority.reason,
                        rank: priority.priority,
                      });
                      navigation.navigate(
                        'ShoppingPriorityEdit',
                        shoppingPriorityRoute(priority, data.generatedAt),
                      );
                    }}
                    onSkip={
                      priority.recommendationKey
                        ? (feedbackReason) =>
                            feedback.dismiss({
                              recommendationKey: priority.recommendationKey!,
                              localDate: data.localDate ?? toLocalDateKey(new Date()),
                              feedbackReason,
                              label: priority.label,
                            })
                        : undefined
                    }
                  />
                ))}
              </EditorialSection>
            ) : null}
          </>
        )}
      </ScrollView>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        style={[styles.scrim, { height: insets.top }]}
      />
      {pending.length ? (
        <View style={styles.toasts}>
          {pending.map((entry) => (
            <View key={entry.id} style={styles.toast} accessibilityLiveRegion="polite">
              <Text style={styles.copy}>Suggestion hidden</Text>
              <Pressable
                onPress={() => feedback.undo(entry.id)}
                accessibilityRole="button"
                accessibilityLabel={`Undo hiding ${entry.label}`}
                style={styles.action}
              >
                <Text style={styles.actionText}>Undo</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: shoppingSurfaces.canvas },
  content: { paddingHorizontal: spacing.page },
  header: {
    marginHorizontal: -spacing.page,
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.lg,
    backgroundColor: shoppingSurfaces.canvas,
  },
  priorities: { paddingTop: spacing.xl },
  state: { paddingVertical: spacing.xxl, gap: spacing.lg },
  copy: { ...typography.text.body, color: colors.inkSubtle },
  error: { ...typography.text.bodySmall, color: colors.destructive, paddingTop: spacing.md },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actionText: { ...typography.text.label, color: shoppingSurfaces.olive.accent },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: shoppingSurfaces.canvas,
  },
  toasts: {
    position: 'absolute',
    left: spacing.page,
    right: spacing.page,
    bottom: spacing.lg,
    gap: spacing.xs,
  },
  toast: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
