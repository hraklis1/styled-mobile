import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '../../components/primitives/PressableScale';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { categoryIcon } from '../../components/stylist/GapCard';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { useItems } from '../../hooks/useItems';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { addOutfitToWishlist } from '../../hooks/useWishlist';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { track } from '../../lib/analytics';
import { sentenceCase } from '../../components/shopping/ShoppingBriefCard';
import { colors, radii, spacing, typography } from '../../theme';
import type { Item } from '../../types/item';
import type { ShopOutfit } from '../../types/shop';
import type { ShoppingPriorityEditScreenProps } from '../../navigation/types';

export function ShoppingPriorityEditScreen({ navigation, route }: ShoppingPriorityEditScreenProps) {
  const insets = useSafeAreaInsets();
  const { priority, source } = route.params;
  const edit = useShoppingPriorityEdit(priority);
  const { data: items = [] } = useItems();
  const { openStylist } = useGlobalAIStylist();
  const startedAt = useRef(Date.now());
  const wearable = useMemo(() => new Map(items.filter((item) => !item.isArchived && item.condition !== 'needs_repair' && item.condition !== 'donate').map((item) => [item.id, item])), [items]);

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

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('ShoppingBriefDetail');
  }, [navigation]);

  const saveEdit = useCallback(async () => {
    if (!edit.data || edit.data.status !== 'ready' || edit.data.targets.length !== 3) return;
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
      await addOutfitToWishlist(outfit);
      track('shopping_brief_edit_saved', { category: priority.category, reason: priority.reason, rank: priority.priority, source: source ?? 'shopping_brief', targetCount: 3 });
    } catch {
      track('shopping_brief_edit_save_failed', { category: priority.category });
    }
  }, [edit.data, priority, source]);

  const refine = useCallback(() => {
    if (!edit.data || edit.data.status !== 'ready') return;
    track('shopping_brief_stylist_follow_up', { category: priority.category, reason: priority.reason, rank: priority.priority, source: source ?? 'shopping_brief', targetCount: edit.data.targets.length });
    openStylist({
      source: 'shop',
      context: { kind: 'shopping_brief_edit', priority: edit.data.priority, targets: edit.data.targets },
    });
  }, [edit.data, openStylist, priority, source]);

  if (edit.isLoading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Curating your options…</Text></View>;
  }

  if (edit.isError || !edit.data) {
    return (
      <View style={styles.state}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.primary} />
        <Text style={styles.stateTitle}>This edit needs another look</Text>
        <Text style={styles.stateCopy}>We couldn’t build the options just now. Your Shopping Brief is unchanged.</Text>
        <PressableScale contentStyle={styles.primaryButton} onPress={() => { track('shopping_brief_edit_retry', { category: priority.category }); void edit.refetch(); }} accessibilityRole="button" accessibilityLabel="Retry Shopping Edit">
          <Text style={styles.primaryButtonText}>Try again</Text>
        </PressableScale>
        <TouchableOpacity onPress={goBack} accessibilityRole="button" accessibilityLabel="Back to Shopping Brief"><Text style={styles.backText}>Back to brief</Text></TouchableOpacity>
      </View>
    );
  }

  const data = edit.data;
  if (data.status === 'no_buy') {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxxl }]}>
          <ShopSubpageHeader eyebrow="SHOPPING EDIT" title={data.headline} subtitle={data.summary} onBack={goBack} />
          <View style={styles.noBuyCard}>
            <Ionicons name="checkmark-circle-outline" size={30} color={colors.primary} />
            <Text style={styles.noBuyTitle}>You can wait</Text>
            <Text style={styles.body}>{data.noBuyReason}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 96 }]} showsVerticalScrollIndicator={false}>
        <ShopSubpageHeader
          eyebrow="SHOPPING EDIT"
          title={data.headline}
          subtitle={data.summary}
          onBack={goBack}
        />
        <View style={styles.priorityContext}>
          <Ionicons name={categoryIcon(priority.category)} size={16} color={colors.primary} />
          <View style={styles.priorityText}><Text style={styles.priorityLabel}>{sentenceCase(priority.label)}</Text><Text style={styles.body}>{priority.context}</Text></View>
        </View>
        <Text style={styles.sectionLabel}>THREE WAYS TO SOLVE IT</Text>
        {data.targets.map((target, index) => (
          <View key={target.key} style={styles.targetCard}>
            <View style={styles.targetIndex}><Text style={styles.targetIndexText}>0{index + 1}</Text></View>
            <Text style={styles.targetTitle}>{target.title}</Text>
            <Text style={styles.targetRationale}>{target.rationale}</Text>
            <View style={styles.metaGrid}>
              <Meta label="Silhouette" value={target.silhouette} />
              <Meta label="Color" value={target.color} />
              <Meta label="Material" value={target.material} />
              <Meta label="Price band" value={target.priceRange} />
            </View>
            <Text style={styles.retailers}>Places to look: {target.retailerExamples.join(' · ')}</Text>
            {target.unlocks.length > 0 ? <Text style={styles.unlocks}>Unlocks {target.unlocks.join(' · ')}</Text> : null}
            <Text style={styles.pairsLabel}>Pairs from your wardrobe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pairsRail}>
              {target.pairsWithItemIds.map((id) => <WardrobePair key={id} item={wearable.get(id)} />)}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PressableScale contentStyle={styles.primaryButton} onPress={() => void saveEdit()} accessibilityRole="button" accessibilityLabel="Save this edit">
          <Ionicons name="bookmark-outline" size={16} color={colors.primaryForeground} /><Text style={styles.primaryButtonText}>Save this edit</Text>
        </PressableScale>
        <TouchableOpacity style={styles.refineButton} onPress={refine} accessibilityRole="button" accessibilityLabel="Refine with stylist"><Ionicons name="sparkles-outline" size={16} color={colors.action} /><Text style={styles.refineText}>Refine with stylist</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) { return <View style={styles.metaCell}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue}>{value}</Text></View>; }

function WardrobePair({ item }: { item?: Item }) {
  return <View style={styles.pair}><View style={styles.pairImage}>{item && itemImageUri(item) ? <Image source={{ uri: itemImageUri(item) }} style={StyleSheet.absoluteFill} resizeMode={itemImageContentFit(item)} /> : <Ionicons name="shirt-outline" size={18} color={colors.mutedForeground} />}</View><Text style={styles.pairName} numberOfLines={1}>{item?.name ?? 'Wardrobe piece'}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background },
  loadingText: { color: colors.mutedForeground, fontSize: typography.size.sm },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  stateTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  stateCopy: { textAlign: 'center', color: colors.mutedForeground, lineHeight: 20 },
  backText: { color: colors.action, fontWeight: typography.weight.semibold },
  priorityContext: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  priorityText: { flex: 1, gap: 4 },
  priorityLabel: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  sectionLabel: { ...typography.eyebrow, color: colors.mutedForeground, marginTop: spacing.xl, marginBottom: spacing.sm },
  targetCard: { paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, gap: spacing.sm },
  targetIndex: { width: 28, height: 22, borderRadius: radii.sm, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  targetIndexText: { fontSize: 11, fontWeight: typography.weight.bold, color: colors.primary },
  targetTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  targetRationale: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  body: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metaCell: { width: '47%', gap: 2 },
  metaLabel: { ...typography.eyebrow, color: colors.mutedForeground },
  metaValue: { fontSize: typography.size.sm, color: colors.foreground },
  retailers: { fontSize: typography.size.xs, lineHeight: 18, color: colors.mutedForeground },
  unlocks: { fontSize: typography.size.xs, lineHeight: 18, color: colors.primary },
  pairsLabel: { marginTop: spacing.xs, fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.foreground },
  pairsRail: { gap: spacing.sm, paddingVertical: 2 },
  pair: { width: 76, gap: 4 },
  pairImage: { width: 76, height: 76, borderRadius: radii.md, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pairName: { fontSize: 10, color: colors.mutedForeground },
  noBuyCard: { marginTop: spacing.xl, padding: spacing.lg, gap: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated },
  noBuyTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, backgroundColor: colors.background },
  primaryButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.full, backgroundColor: colors.primary },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  refineButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  refineText: { color: colors.action, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
});
