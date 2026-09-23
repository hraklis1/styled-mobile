import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '../../components/primitives/PressableScale';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { ShoppingPriorityTargetCard } from '../../components/shopping/ShoppingPriorityTargetCard';
import { useItems } from '../../hooks/useItems';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { addOutfitToWishlist, useWishlist } from '../../hooks/useWishlist';
import { priorityAnchorPieces, priorityOccasionLabel, shoppingGuideIntro, wearableWardrobe, withoutOutfitCount, worksWithLabel } from '../../lib/shopClarity';
import { track } from '../../lib/analytics';
import { shoppingPriorityEditDisplayHeadline, shoppingPriorityGapNarrative, shoppingPriorityTargetDisplayTitle, splitPriceRange } from '../../lib/shoppingPriorityEdit';
import { shoppingSurfaces, colors, radii, spacing, typography } from '../../theme';
import type { ShopOutfit } from '../../types/shop';
import type { ShoppingPriorityEditScreenProps } from '../../navigation/types';

export function ShoppingPriorityEditScreen({ navigation, route }: ShoppingPriorityEditScreenProps) {
  const insets = useSafeAreaInsets();
  const { priority, source, origin, briefGeneratedAt } = route.params;
  const edit = useShoppingPriorityEdit(priority, { origin, briefGeneratedAt });
  const { data: items = [] } = useItems();
  const { data: wishlist = [] } = useWishlist();
  const startedAt = useRef(Date.now());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetOffsets = useRef<number[]>([]);
  const [savedLocally, setSavedLocally] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [heroHeight, setHeroHeight] = useState(0);
  const [showCompactHeader, setShowCompactHeader] = useState(false);
  const [currentDirectionIndex, setCurrentDirectionIndex] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const wearable = useMemo(() => wearableWardrobe(items), [items]);
  const savedFromWishlist = useMemo(() => {
    if (!edit.data || edit.data.status !== 'ready') return false;
    return wishlist.some((entry) => entry.outfit.shoppingBrief?.generatedAt === edit.data?.generatedAt);
  }, [edit.data, wishlist]);
  const isSaved = savedLocally || savedFromWishlist;

  useEffect(() => {
    track('shopping_brief_edit_opened', {
      category: priority.category,
      reason: priority.reason,
      rank: priority.priority,
      source: source ?? 'shopping_brief',
    });
  }, [priority.category, priority.priority, priority.reason, source]);

  useEffect(() => {
    if (edit.isError) track('shopping_brief_edit_generation_failed', { category: priority.category, reason: priority.reason, rank: priority.priority, source: source ?? 'shopping_brief', latencyMs: Date.now() - startedAt.current });
    if (edit.data) track('shopping_brief_edit_loaded', { category: priority.category, reason: priority.reason, rank: priority.priority, source: source ?? 'shopping_brief', outcome: edit.data.status, targetCount: edit.data.targets.length, latencyMs: Date.now() - startedAt.current });
  }, [edit.data, edit.isError, priority, source]);

  useLayoutEffect(() => {
    targetOffsets.current = [];
    setSavedLocally(false);
    setShowCompactHeader(false);
    setCurrentDirectionIndex(null);
  }, [edit.data?.generatedAt]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('ShoppingBriefDetail');
  }, [navigation]);

  // The row the user tapped on the brief, kept on the eyebrow of every state
  // of this screen. The stylist's headline ("Clean low-profile staples") is
  // the hook, but it is the priority label that confirms they landed where
  // they meant to — and it used to vanish exactly when the two diverged.
  const guideEyebrow = `Guide · ${priority.label.replace(/\s+/g, ' ').trim()}`;

  const showSavedToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setShowSaveToast(true);
    toastTimer.current = setTimeout(() => {
      setShowSaveToast(false);
      toastTimer.current = null;
    }, 2200);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!edit.data || edit.data.status !== 'ready' || edit.data.targets.length !== 3 || isSaved || saving) return;
    const outfit: ShopOutfit = {
      recommendationType: 'list',
      source: 'shopping_brief',
      shoppingBrief: edit.data,
      intro: shoppingPriorityEditDisplayHeadline(edit.data.headline, priority.label),
      city: '',
      items: [],
      totalBudget: edit.data.targets.map((target) => target.priceRange).join(' · '),
      audioSummary: edit.data.summary,
    };
    try {
      setSaving(true);
      await addOutfitToWishlist(outfit, null, priority.recommendationKey);
      setSavedLocally(true);
      showSavedToast();
      track('shopping_brief_edit_saved', { category: priority.category, reason: priority.reason, rank: priority.priority, source: source ?? 'shopping_brief', targetCount: 3 });
    } catch {
      track('shopping_brief_edit_save_failed', { category: priority.category });
      Alert.alert("Couldn't save this guide", 'Please try again in a moment.');
    } finally {
      setSaving(false);
    }
  }, [edit.data, isSaved, priority, saving, showSavedToast, source]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (heroHeight === 0) return;
    const compactHeaderHeight = insets.top + spacing.md + 52 + spacing.sm;
    const scrollPosition = event.nativeEvent.contentOffset.y;
    const nextVisible = scrollPosition >= Math.max(0, heroHeight - compactHeaderHeight);
    setShowCompactHeader((current) => current === nextVisible ? current : nextVisible);

    const readingLine = scrollPosition + compactHeaderHeight;
    let nextDirectionIndex: number | null = null;
    for (let index = 0; index < targetOffsets.current.length; index += 1) {
      const offset = targetOffsets.current[index];
      if (typeof offset !== 'number' || readingLine < offset) break;
      nextDirectionIndex = index;
    }
    setCurrentDirectionIndex((current) => current === nextDirectionIndex ? current : nextDirectionIndex);
  }, [heroHeight, insets.top]);

  const recordTargetOffset = useCallback((index: number, event: LayoutChangeEvent) => {
    targetOffsets.current[index] = event.nativeEvent.layout.y;
  }, []);

  if (edit.isLoading) {
    return (
      <StateScreen onBack={goBack} eyebrow={guideEyebrow} title="Building your guide">
        <ActivityIndicator color={colors.primary} />
        <Text selectable style={styles.loadingText}>Curating your options…</Text>
      </StateScreen>
    );
  }

  if (edit.isError || !edit.data) {
    return (
      <StateScreen onBack={goBack} eyebrow={guideEyebrow} title="Something went wrong">
        <Ionicons name="cloud-offline-outline" size={28} color={colors.primary} />
        <Text selectable style={styles.stateTitle}>This guide needs another look</Text>
        <Text selectable style={styles.stateCopy}>We couldn’t build the options just now. Your Shopping Brief is unchanged.</Text>
        <PressableScale contentStyle={styles.primaryButton} onPress={() => { track('shopping_brief_edit_retry', { category: priority.category }); void edit.refetch(); }} accessibilityRole="button" accessibilityLabel="Retry building this guide">
          <Text style={styles.primaryButtonText}>Try again</Text>
        </PressableScale>
      </StateScreen>
    );
  }

  const data = edit.data;
  const displayHeadline = shoppingPriorityEditDisplayHeadline(data.headline, priority.label);
  if (data.status === 'no_buy' && data.briefUpdated && data.updatedBrief) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.stateContent, { paddingBottom: insets.bottom + spacing.xxxl }]} showsVerticalScrollIndicator={false}>
          <ShopSubpageHeader eyebrow={guideEyebrow} title="Your brief was updated" subtitle={data.summary} onBack={goBack} style={styles.fullBleedHeader} />
          <View style={styles.noBuyCard} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle-outline" size={30} color={colors.primary} />
            <Text selectable style={styles.noBuyTitle}>This priority is already covered</Text>
            <Text selectable style={styles.body}>{data.noBuyReason}</Text>
            <PressableScale contentStyle={styles.primaryButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="View updated Shopping Brief">
              <Text style={styles.primaryButtonText}>View updated brief</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.primaryForeground} />
            </PressableScale>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (data.status === 'no_buy') {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.stateContent, { paddingBottom: insets.bottom + spacing.xxxl }]} showsVerticalScrollIndicator={false}>
          <ShopSubpageHeader eyebrow={guideEyebrow} title={displayHeadline} subtitle={data.summary} onBack={goBack} style={styles.fullBleedHeader} />
          <View style={styles.noBuyCard}>
            <Ionicons name="checkmark-circle-outline" size={30} color={colors.primary} />
            <Text selectable style={styles.noBuyTitle}>You can wait</Text>
            <Text selectable style={styles.body}>{data.noBuyReason}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const directionCount = data.targets.length;
  // The gap blurb arrives as one string welding together the stylist's actual
  // sentence, a noun phrase restating the label, and — on ladder candidates —
  // step bookkeeping. Each gets its own slot rather than one long paragraph.
  const gap = shoppingPriorityGapNarrative(priority.label, priority.context, {
    // A severable tail that only restates the count is dropped here, and
    // any count left inside the sentence is taken out below: the page makes
    // its case with the pieces it works with and the looks, not a number.
    impactScore: priority.impactScore,
  });
  const deckStatement = withoutOutfitCount(gap.voice, priority.impactScore);
  const worksWith = worksWithLabel(priorityAnchorPieces(priority, wearable), 3);
  // Stated once for the whole edit rather than repeated on every card.
  const priceCurrency = data.targets.reduce<string | null>(
    (found, target) => found ?? splitPriceRange(target.priceRange).currency,
    null,
  );
  const compactProgress = currentDirectionIndex === null
    ? `${directionCount} styles to consider`
    : `Style ${formatDirectionNumber(currentDirectionIndex + 1)} of ${formatDirectionNumber(directionCount)}`;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        <View onLayout={(event) => setHeroHeight(event.nativeEvent.layout.height)}>
          <ShopSubpageHeader
            eyebrow={guideEyebrow}
            // Ladder bookkeeping and the direction count are label-level
            // facts, so they sit on the eyebrow line rather than in the deck.
            eyebrowTrailing={gap.step
              ? `Step ${gap.step.current} of ${gap.step.total}`
              : `${formatDirectionNumber(directionCount)} styles`}
            title={displayHeadline}
            titleNumberOfLines={2}
            onBack={goBack}
            style={[styles.fullBleedHeader, styles.readyHeader]}
          />
          <View style={styles.deck}>
            {deckStatement ? <Text selectable style={styles.deckStatement}>{deckStatement}</Text> : null}
            {worksWith ? <Text style={styles.deckMeta}>{worksWith}</Text> : null}
            {priorityOccasionLabel(priority) ? (
              <Text style={styles.deckMeta}>{priorityOccasionLabel(priority)}</Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.guideIntro}>{shoppingGuideIntro(directionCount)}{priceCurrency ? ` Suggested budgets in ${priceCurrency}.` : ''}</Text>
        {data.targets.map((target, index) => (
          <Animated.View
            key={target.key}
            style={styles.targetCardWrap}
            entering={reduceMotion ? undefined : FadeInUp.delay(index * 40).duration(220)}
            onLayout={(event) => recordTargetOffset(index, event)}
          >
            <ShoppingPriorityTargetCard
              target={target}
              index={index + 1}
              wardrobe={wearable}
              displayTitle={shoppingPriorityTargetDisplayTitle(target.title, `${priority.label} ${displayHeadline}`)}
              isLast={index === directionCount - 1}
              onSaveFind={() => {
                track('shopping_brief_save_find_tapped', { category: priority.category, targetKey: target.key });
                navigation.navigate('ShoppingCamera');
              }}
            />
          </Animated.View>
        ))}
        <View style={styles.saveBand}>
          <Text selectable style={styles.saveBandCopy}>Keep this guide in Saved recommendations.</Text>
          <SaveEditAction saving={saving} isSaved={isSaved} onPress={saveEdit} />
        </View>
      </ScrollView>
      {showCompactHeader ? (
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(150)} exiting={reduceMotion ? undefined : FadeOutDown.duration(100)} style={styles.stickyHeader}>
          <ShopSubpageHeader
            compact
            eyebrow={guideEyebrow}
            title={displayHeadline}
            subtitle={compactProgress}
            onBack={goBack}
            style={styles.stickyHeaderContent}
          />
        </Animated.View>
      ) : null}
      {showSaveToast ? (
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(160)} exiting={reduceMotion ? undefined : FadeOutDown.duration(120)} style={[styles.saveToast, { bottom: insets.bottom + spacing.lg }]} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.saveToastText}>Added to Saved recommendations</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function SaveEditAction({ saving, isSaved, onPress }: { saving: boolean; isSaved: boolean; onPress: () => Promise<void> }) {
  const label = saving ? 'Saving…' : isSaved ? 'Saved' : 'Save this guide';

  return (
    <PressableScale
      motion="crisp"
      scaleTo={0.985}
      style={styles.saveButton}
      contentStyle={[styles.saveAction, isSaved && styles.saveActionSaved]}
      onPress={() => void onPress()}
      disabled={saving || isSaved}
      haptic={!isSaved}
      accessibilityRole="button"
      accessibilityLabel={saving ? 'Saving guide' : isSaved ? 'In Saved recommendations' : 'Save this guide'}
      accessibilityHint={isSaved ? undefined : 'Adds this guide to Saved recommendations'}
      accessibilityState={{ selected: isSaved, busy: saving, disabled: saving || isSaved }}
    >
      {saving ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Ionicons name={isSaved ? 'checkmark' : 'bookmark-outline'} size={18} color={colors.primaryForeground} />}
      <Text style={styles.saveActionText}>{label}</Text>
    </PressableScale>
  );
}

function formatDirectionNumber(value: number): string {
  return String(value).padStart(2, '0');
}

function StateScreen({ children, onBack, eyebrow, title }: { children: ReactNode; onBack: () => void; eyebrow: string; title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.stateContent, { paddingBottom: insets.bottom + spacing.xxxl }]} showsVerticalScrollIndicator={false}>
        <ShopSubpageHeader compact eyebrow={eyebrow} title={title} onBack={onBack} style={styles.fullBleedHeader} />
        <View style={styles.stateCard}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  guideIntro: { ...typography.text.bodySmall, color: colors.inkSubtle, marginBottom: spacing.lg },
  screen: { flex: 1, backgroundColor: shoppingSurfaces.canvas },
  content: { paddingHorizontal: spacing.lg },
  fullBleedHeader: { marginHorizontal: -spacing.lg, backgroundColor: shoppingSurfaces.canvas },
  readyHeader: { paddingBottom: spacing.lg },
  stateContent: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.xl },
  stateCard: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  loadingText: { color: colors.mutedForeground, fontSize: typography.text.bodySmall.fontSize },
  stateTitle: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  stateCopy: { textAlign: 'center', color: colors.mutedForeground, lineHeight: 20 },
  deck: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  // The stylist's sentence, kept whole, in the regular editorial face so it
  // reads as a deck under the headline rather than a second one.
  deckStatement: { maxWidth: 360, ...typography.text.editorialBody, color: shoppingSurfaces.espresso },
  deckMeta: { ...typography.text.meta, color: colors.mutedForeground },
  body: { fontSize: typography.text.bodySmall.fontSize, lineHeight: 20, color: colors.mutedForeground },
  targetCardWrap: {},
  saveBand: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, gap: spacing.lg, backgroundColor: colors.surfaceElevated, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  // Functional copy introducing a button, not a headline — the same inversion
  // the gap statement had. The pill is the loud element in this band.
  saveBandCopy: { maxWidth: 330, fontSize: typography.text.bodySmall.fontSize, lineHeight: 19, color: colors.mutedForeground },
  noBuyCard: { padding: spacing.lg, gap: spacing.sm, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  noBuyTitle: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  primaryButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.full, backgroundColor: shoppingSurfaces.espresso, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: shoppingSurfaces.highlight, boxShadow: shoppingSurfaces.buttonShadow },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold },
  saveButton: { width: '100%' },
  saveAction: { minHeight: 52, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.full, backgroundColor: shoppingSurfaces.espresso, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: shoppingSurfaces.highlight, boxShadow: shoppingSurfaces.buttonShadow },
  saveActionSaved: { backgroundColor: shoppingSurfaces.espresso },
  saveActionText: { color: colors.primaryForeground, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold },
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  stickyHeaderContent: { backgroundColor: shoppingSurfaces.canvas, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  saveToast: { position: 'absolute', left: spacing.lg, right: spacing.lg, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, boxShadow: '0 4px 14px rgba(40, 35, 31, 0.12)', zIndex: 20 },
  saveToastText: { flex: 1, color: colors.foreground, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.medium },
});
