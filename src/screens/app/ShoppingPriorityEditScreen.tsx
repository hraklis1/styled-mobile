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
import { track } from '../../lib/analytics';
import { shoppingPriorityEditDisplayHeadline, shoppingPriorityGapStatement } from '../../lib/shoppingPriorityEdit';
import { colors, radii, spacing, typography } from '../../theme';
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
  const wearable = useMemo(() => new Map(items.filter((item) => !item.isArchived && item.condition !== 'needs_repair' && item.condition !== 'donate').map((item) => [item.id, item])), [items]);
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
      Alert.alert("Couldn't save this edit", 'Please try again in a moment.');
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
      <StateScreen onBack={goBack} title="Curating your edit">
        <ActivityIndicator color={colors.primary} />
        <Text selectable style={styles.loadingText}>Curating your options…</Text>
      </StateScreen>
    );
  }

  if (edit.isError || !edit.data) {
    return (
      <StateScreen onBack={goBack} title="Shopping Edit">
        <Ionicons name="cloud-offline-outline" size={28} color={colors.primary} />
        <Text selectable style={styles.stateTitle}>This edit needs another look</Text>
        <Text selectable style={styles.stateCopy}>We couldn’t build the options just now. Your Shopping Brief is unchanged.</Text>
        <PressableScale contentStyle={styles.primaryButton} onPress={() => { track('shopping_brief_edit_retry', { category: priority.category }); void edit.refetch(); }} accessibilityRole="button" accessibilityLabel="Retry Shopping Edit">
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
          <ShopSubpageHeader eyebrow="SHOPPING EDIT" title="Your brief was updated" subtitle={data.summary} onBack={goBack} style={styles.fullBleedHeader} />
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
          <ShopSubpageHeader eyebrow="SHOPPING EDIT" title={displayHeadline} subtitle={data.summary} onBack={goBack} style={styles.fullBleedHeader} />
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
  const compactProgress = currentDirectionIndex === null
    ? `${directionCount} curated directions`
    : `Direction ${formatDirectionNumber(currentDirectionIndex + 1)} of ${formatDirectionNumber(directionCount)}`;

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
            eyebrow="SHOPPING EDIT"
            title={displayHeadline}
            titleNumberOfLines={2}
            onBack={goBack}
            style={[styles.fullBleedHeader, styles.readyHeader]}
          />
        </View>
        <View style={styles.priorityContext}>
          <View style={styles.priorityText}>
            <Text style={styles.priorityEyebrow}>The wardrobe gap</Text>
            <Text selectable style={styles.priorityStatement}>{shoppingPriorityGapStatement(priority.label, priority.context)}</Text>
            {priority.unlocks.length > 0 ? (
              <View style={styles.priorityUnlockRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
                <Text selectable style={styles.priorityUnlocks}>Unlocks {priority.unlocks.join(' · ')}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionCount}>{formatDirectionNumber(directionCount)}</Text>
          <Text style={styles.sectionLabel}>Curated directions</Text>
        </View>
        {data.targets.map((target, index) => (
          <View key={target.key} style={styles.targetCardWrap} onLayout={(event) => recordTargetOffset(index, event)}>
            <ShoppingPriorityTargetCard
              target={target}
              index={index + 1}
              wardrobe={wearable}
            />
          </View>
        ))}
        <View style={styles.saveBand}>
          <Text selectable style={styles.saveBandCopy}>Keep these directions in Saved Shopping.</Text>
          <SaveEditAction saving={saving} isSaved={isSaved} onPress={saveEdit} />
        </View>
      </ScrollView>
      {showCompactHeader ? (
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(150)} exiting={reduceMotion ? undefined : FadeOutDown.duration(100)} style={styles.stickyHeader}>
          <ShopSubpageHeader
            compact
            eyebrow="SHOPPING EDIT"
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
          <Text style={styles.saveToastText}>Edit saved</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function SaveEditAction({ saving, isSaved, onPress }: { saving: boolean; isSaved: boolean; onPress: () => Promise<void> }) {
  const label = saving ? 'Saving…' : isSaved ? 'Saved' : 'Save this edit';

  return (
    <PressableScale
      style={styles.saveButton}
      contentStyle={[styles.saveAction, isSaved && styles.saveActionSaved]}
      onPress={() => void onPress()}
      disabled={saving || isSaved}
      haptic={!isSaved}
      accessibilityRole="button"
      accessibilityLabel={saving ? 'Saving Shopping Edit' : isSaved ? 'Shopping Edit saved' : 'Save Shopping Edit'}
      accessibilityHint={isSaved ? undefined : 'Adds these directions to Saved Shopping'}
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

function StateScreen({ children, onBack, title }: { children: ReactNode; onBack: () => void; title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.stateContent, { paddingBottom: insets.bottom + spacing.xxxl }]} showsVerticalScrollIndicator={false}>
        <ShopSubpageHeader compact eyebrow="SHOPPING EDIT" title={title} onBack={onBack} style={styles.fullBleedHeader} />
        <View style={styles.stateCard}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  fullBleedHeader: { marginHorizontal: -spacing.lg },
  readyHeader: { paddingBottom: spacing.xl, backgroundColor: colors.background },
  stateContent: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.xl },
  stateCard: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  loadingText: { color: colors.mutedForeground, fontSize: typography.text.bodySmall.fontSize },
  stateTitle: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  stateCopy: { textAlign: 'center', color: colors.mutedForeground, lineHeight: 20 },
  priorityContext: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, backgroundColor: colors.surfaceSubtle, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  priorityText: { gap: spacing.md },
  priorityEyebrow: { ...typography.text.eyebrow, color: colors.primary },
  priorityStatement: { maxWidth: 350, ...typography.text.editorialCompact, color: colors.foreground },
  priorityUnlockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  priorityUnlocks: { flex: 1, fontSize: typography.text.caption.fontSize, lineHeight: 18, fontWeight: typography.weight.medium, color: colors.primary },
  body: { fontSize: typography.text.bodySmall.fontSize, lineHeight: 20, color: colors.mutedForeground },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xxl, paddingTop: spacing.md, paddingBottom: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sectionCount: { fontSize: typography.text.bodySmall.fontSize, lineHeight: 18, fontWeight: typography.weight.semibold, fontVariant: ['tabular-nums'], color: colors.primary },
  sectionLabel: { ...typography.text.eyebrowLarge, color: colors.primary },
  targetCardWrap: { paddingBottom: spacing.xl },
  saveBand: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, gap: spacing.lg, backgroundColor: colors.surfaceElevated, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  saveBandCopy: { maxWidth: 330, ...typography.text.editorialCompact, color: colors.foreground },
  noBuyCard: { padding: spacing.lg, gap: spacing.sm, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  noBuyTitle: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  primaryButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.full, backgroundColor: colors.primary },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold },
  saveButton: { width: '100%' },
  saveAction: { minHeight: 52, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.full, backgroundColor: colors.primary },
  saveActionSaved: { backgroundColor: colors.primary },
  saveActionText: { color: colors.primaryForeground, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold },
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  stickyHeaderContent: { backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  saveToast: { position: 'absolute', left: spacing.lg, right: spacing.lg, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, boxShadow: '0 4px 14px rgba(40, 35, 31, 0.12)', zIndex: 20 },
  saveToastText: { flex: 1, color: colors.foreground, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.medium },
});
