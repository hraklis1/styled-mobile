import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '../../components/primitives/PressableScale';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { ShoppingPriorityTargetCard } from '../../components/shopping/ShoppingPriorityTargetCard';
import { sentenceCase } from '../../components/shopping/ShoppingBriefCard';
import { useItems } from '../../hooks/useItems';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { addOutfitToWishlist, useWishlist } from '../../hooks/useWishlist';
import { track } from '../../lib/analytics';
import { shoppingPriorityEditDisplayHeadline } from '../../lib/shoppingPriorityEdit';
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
  const [expandedTargetKey, setExpandedTargetKey] = useState<string | null>(null);
  const [savedLocally, setSavedLocally] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [heroHeight, setHeroHeight] = useState(0);
  const [showCompactHeader, setShowCompactHeader] = useState(false);
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

  useEffect(() => {
    setExpandedTargetKey(null);
    setSavedLocally(false);
    setShowCompactHeader(false);
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
      await addOutfitToWishlist(outfit);
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

  const toggleTarget = useCallback((targetKey: string, index: number) => {
    const expanded = expandedTargetKey !== targetKey;
    setExpandedTargetKey(expanded ? targetKey : null);
    track('shopping_brief_edit_target_toggled', {
      category: priority.category,
      targetKey,
      index: index + 1,
      expanded,
    });
  }, [expandedTargetKey, priority.category]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (heroHeight === 0) return;
    const compactHeight = insets.top + 64;
    const nextVisible = event.nativeEvent.contentOffset.y >= Math.max(0, heroHeight - compactHeight);
    setShowCompactHeader((current) => current === nextVisible ? current : nextVisible);
  }, [heroHeight, insets.top]);

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
            subtitle={data.summary}
            titleNumberOfLines={2}
            subtitleNumberOfLines={2}
            onBack={goBack}
            style={[styles.fullBleedHeader, styles.readyHeader]}
            actions={<SaveEditAction saving={saving} isSaved={isSaved} onPress={saveEdit} />}
          />
        </View>
        <View style={styles.priorityContext}>
          <View style={styles.priorityText}>
            <Text style={styles.priorityEyebrow}>The wardrobe gap</Text>
            <Text selectable style={styles.priorityLabel}>{sentenceCase(priority.label)}</Text>
            <Text selectable style={styles.body}>{priority.context}</Text>
            {priority.unlocks.length > 0 ? (
              <View style={styles.priorityUnlockRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
                <Text selectable style={styles.priorityUnlocks}>Unlocks {priority.unlocks.join(' · ')}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionCount}>03</Text>
          <View style={styles.sectionHeadingCopy}>
            <Text style={styles.sectionLabel}>Curated directions</Text>
            <Text selectable style={styles.sectionDescription}>Three distinct ways to close the gap.</Text>
          </View>
        </View>
        {data.targets.map((target, index) => (
          <ShoppingPriorityTargetCard
            key={target.key}
            target={target}
            index={index + 1}
            wardrobe={wearable}
            expanded={expandedTargetKey === target.key}
            onToggle={() => toggleTarget(target.key, index)}
          />
        ))}
      </ScrollView>
      {showCompactHeader ? (
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(150)} exiting={reduceMotion ? undefined : FadeOutDown.duration(100)} style={styles.stickyHeader}>
          <ShopSubpageHeader
            compact
            eyebrow="SHOPPING EDIT"
            title={displayHeadline}
            onBack={goBack}
            style={styles.stickyHeaderContent}
            actions={<SaveEditAction saving={saving} isSaved={isSaved} onPress={saveEdit} />}
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
  return (
    <PressableScale
      contentStyle={[styles.saveAction, isSaved && styles.saveActionSaved]}
      onPress={() => void onPress()}
      disabled={saving || isSaved}
      haptic={!isSaved}
      accessibilityRole="button"
      accessibilityLabel={saving ? 'Saving Shopping Edit' : isSaved ? 'Shopping Edit saved' : 'Save Shopping Edit'}
      accessibilityState={{ selected: isSaved, busy: saving, disabled: saving || isSaved }}
    >
      {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={isSaved ? 'checkmark' : 'bookmark-outline'} size={19} color={isSaved ? colors.primaryForeground : colors.primary} />}
    </PressableScale>
  );
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
  readyHeader: { paddingBottom: spacing.lg, backgroundColor: colors.background },
  stateContent: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.xl },
  stateCard: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  loadingText: { color: colors.mutedForeground, fontSize: typography.size.sm },
  stateTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  stateCopy: { textAlign: 'center', color: colors.mutedForeground, lineHeight: 20 },
  priorityContext: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, backgroundColor: colors.surfaceSubtle, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  priorityText: { gap: spacing.xs },
  priorityEyebrow: { ...typography.eyebrow, color: colors.primary },
  priorityLabel: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  priorityUnlockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  priorityUnlocks: { flex: 1, fontSize: typography.size.xs, lineHeight: 18, fontWeight: typography.weight.medium, color: colors.primary },
  body: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  sectionHeader: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  sectionCount: { minWidth: 48, fontFamily: typography.family.display, fontSize: 34, lineHeight: 39, color: colors.primary },
  sectionHeadingCopy: { flex: 1, gap: spacing.xs },
  sectionLabel: { ...typography.eyebrowLarge, color: colors.primary },
  sectionDescription: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  noBuyCard: { padding: spacing.lg, gap: spacing.sm, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  noBuyTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  primaryButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.full, backgroundColor: colors.primary },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  saveAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  saveActionSaved: { backgroundColor: colors.primary, borderColor: colors.primary },
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  stickyHeaderContent: { backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  saveToast: { position: 'absolute', left: spacing.lg, right: spacing.lg, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, boxShadow: '0 4px 14px rgba(40, 35, 31, 0.12)', zIndex: 20 },
  saveToastText: { flex: 1, color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
});
