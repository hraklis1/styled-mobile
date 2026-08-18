import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '../../components/primitives/PressableScale';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { ShoppingPriorityTargetCard } from '../../components/shopping/ShoppingPriorityTargetCard';
import { categoryIcon } from '../../components/stylist/GapCard';
import { useItems } from '../../hooks/useItems';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { addOutfitToWishlist, useWishlist } from '../../hooks/useWishlist';
import { track } from '../../lib/analytics';
import { sentenceCase } from '../../components/shopping/ShoppingBriefCard';
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
      intro: edit.data.headline,
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
  if (data.status === 'no_buy' && data.briefUpdated && data.updatedBrief) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]} showsVerticalScrollIndicator={false}>
          <ShopSubpageHeader
            eyebrow="SHOPPING EDIT"
            title="Your brief was updated"
            subtitle={data.summary}
            onBack={goBack}
            style={styles.fullBleedHeader}
          />
          <View style={styles.noBuyCard} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle-outline" size={30} color={colors.primary} />
            <Text selectable style={styles.noBuyTitle}>This priority is already covered</Text>
            <Text selectable style={styles.body}>{data.noBuyReason}</Text>
            <PressableScale
              contentStyle={styles.primaryButton}
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="View updated Shopping Brief"
            >
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
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]} showsVerticalScrollIndicator={false}>
          <ShopSubpageHeader eyebrow="SHOPPING EDIT" title={data.headline} subtitle={data.summary} onBack={goBack} style={styles.fullBleedHeader} />
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
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]} showsVerticalScrollIndicator={false}>
        <ShopSubpageHeader
          eyebrow="SHOPPING EDIT"
          title={data.headline}
          subtitle={data.summary}
          onBack={goBack}
          style={styles.fullBleedHeader}
          actions={(
            <PressableScale
              contentStyle={[styles.saveAction, isSaved && styles.saveActionSaved]}
              onPress={() => void saveEdit()}
              disabled={saving || isSaved}
              haptic={!isSaved}
              accessibilityRole="button"
              accessibilityLabel={saving ? 'Saving Shopping Edit' : isSaved ? 'Shopping Edit saved' : 'Save Shopping Edit'}
              accessibilityState={{ selected: isSaved, busy: saving, disabled: saving || isSaved }}
            >
              {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={isSaved ? 'checkmark' : 'bookmark-outline'} size={19} color={isSaved ? colors.primaryForeground : colors.primary} />}
            </PressableScale>
          )}
        />
        <View style={styles.priorityContext}>
          <View style={styles.priorityIcon}><Ionicons name={categoryIcon(priority.category)} size={17} color={colors.primary} /></View>
          <View style={styles.priorityText}>
            <Text style={styles.priorityEyebrow}>The wardrobe gap</Text>
            <Text selectable style={styles.priorityLabel}>{sentenceCase(priority.label)}</Text>
            <Text selectable style={styles.body}>{priority.context}</Text>
            {priority.unlocks.length > 0 ? <Text selectable style={styles.priorityUnlocks}>Unlocks {priority.unlocks.join(' · ')}</Text> : null}
          </View>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>3 directions</Text>
          <Text selectable style={styles.sectionDescription}>Each solves the same gap in a different way.</Text>
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
      {showSaveToast ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.duration(160)}
          exiting={reduceMotion ? undefined : FadeOutDown.duration(120)}
          style={[styles.saveToast, { bottom: insets.bottom + spacing.lg }]}
          accessibilityLiveRegion="polite"
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.saveToastText}>Edit saved</Text>
        </Animated.View>
      ) : null}
    </View>
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
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  fullBleedHeader: { marginHorizontal: -spacing.lg },
  stateContent: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.xl },
  stateCard: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  loadingText: { color: colors.mutedForeground, fontSize: typography.size.sm },
  stateTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  stateCopy: { textAlign: 'center', color: colors.mutedForeground, lineHeight: 20 },
  priorityContext: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceSubtle },
  priorityIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.surfaceElevated },
  priorityText: { flex: 1, gap: 4 },
  priorityEyebrow: { ...typography.eyebrow, color: colors.primary },
  priorityLabel: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  priorityUnlocks: { paddingTop: spacing.xs, fontSize: typography.size.xs, lineHeight: 18, fontWeight: typography.weight.medium, color: colors.primary },
  body: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  sectionHeader: { gap: spacing.xs },
  sectionLabel: { fontFamily: typography.family.display, ...typography.display.sm, color: colors.foreground },
  sectionDescription: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  noBuyCard: { padding: spacing.lg, gap: spacing.sm, borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  noBuyTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  primaryButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.full, backgroundColor: colors.primary },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  saveAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  saveActionSaved: { backgroundColor: colors.primary, borderColor: colors.primary },
  saveToast: { position: 'absolute', left: spacing.lg, right: spacing.lg, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, boxShadow: '0 4px 14px rgba(40, 35, 31, 0.12)' },
  saveToastText: { flex: 1, color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
});
