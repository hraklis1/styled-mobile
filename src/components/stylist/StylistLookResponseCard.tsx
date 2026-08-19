import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import { GapCard, type GapItem } from './GapCard';
import { ResolvedOutfitCollage } from '../outfits/ResolvedOutfitCollage';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import type { Item } from '../../types/item';
import type { CreateOutfitInput } from '../../hooks/useOutfits';
import type {
  StylistClarification,
  StylistEventPlanData,
  StylistMissingEssential,
  StylistReadinessStatus,
} from '../../features/stylist/types';

type Props = {
  status: StylistReadinessStatus;
  messageText: string;
  lookName?: string;
  itemIds: number[];
  foundationItemIds?: number[];
  missingEssentials?: StylistMissingEssential[];
  clarification?: StylistClarification;
  allItems: Item[];
  createOutfit: { mutateAsync: (input: CreateOutfitInput) => Promise<{ id: number }> };
  eventContext?: { id: number; title: string };
  eventPlan?: StylistEventPlanData | null;
  onAddToEvent?: (itemIds: number[], eventPlan?: StylistEventPlanData | null) => Promise<unknown>;
  onNavigateToShop?: (gap?: StylistMissingEssential) => void;
  onClarificationSelect?: (value: string) => void;
  onToggleAudio?: () => void;
  isPlaying?: boolean;
};

function displayName(items: Item[], fallback = 'Wardrobe foundation') {
  return items.slice(0, 2).map((item) => item.name).join(' · ') || fallback;
}

export function StylistLookResponseCard({
  status,
  messageText,
  lookName,
  itemIds,
  foundationItemIds,
  missingEssentials = [],
  clarification,
  allItems,
  createOutfit,
  eventContext,
  eventPlan,
  onAddToEvent,
  onNavigateToShop,
  onClarificationSelect,
  onToggleAudio,
  isPlaying = false,
}: Props) {
  const { width } = useWindowDimensions();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  const resolvedIds = status === 'incomplete' ? (foundationItemIds?.length ? foundationItemIds : itemIds) : itemIds;
  const items = useMemo(
    () => resolvedIds.map((id) => allItems.find((item) => item.id === id)).filter((item): item is Item => !!item),
    [allItems, resolvedIds],
  );
  const slots = useMemo(
    () => items.map((item) => ({ key: String(item.id), uri: itemImageUri(item), contentFit: itemImageContentFit(item) })),
    [items],
  );
  const gaps = missingEssentials.slice().sort((a, b) => a.priority - b.priority).slice(0, 3);
  const collageSize = Math.min(width - spacing.lg * 2, 430);

  async function saveFoundation() {
    if (saving || saved || items.length === 0) return;
    setSaving(true);
    try {
      await createOutfit.mutateAsync({
        name: displayName(items),
        description: messageText.slice(0, 240) || null,
        notes: gaps.length ? `Foundation needs: ${gaps.map((gap) => gap.label).join(', ')}` : null,
        tags: ['stylist-foundation'],
        isDraft: status === 'incomplete',
        itemIds: items.map((item) => ({ id: item.id, category: item.category ?? 'other' })),
      });
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setSaving(false);
    }
  }

  async function addToEvent() {
    if (!onAddToEvent || !eventContext || adding || added || status !== 'ready' || items.length === 0) return;
    setAdding(true);
    try {
      await onAddToEvent(items.map((item) => item.id), eventPlan);
      setAdded(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setAdding(false);
    }
  }

  if (status === 'needs_clarification') {
    const options = clarification?.options ?? [];
    return (
      <View style={[styles.card, styles.clarificationCard]}>
        <View style={styles.eyebrowRow}>
          <Ionicons name="sparkles-outline" size={14} color={colors.action} />
          <Text style={styles.eyebrow}>ONE DETAIL BEFORE I STYLE THIS</Text>
        </View>
        <Text style={styles.title}>{clarification?.question || messageText}</Text>
        <View style={styles.optionGrid}>
          {options.slice(0, 4).map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.optionButton}
              onPress={() => onClarificationSelect?.(option.value)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${option.label}`}
            >
              <Text style={styles.optionText}>{option.label}</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
        {clarification?.safestOption && (
          <TouchableOpacity onPress={() => onClarificationSelect?.(clarification.safestOption!)} style={styles.safestButton}>
            <Text style={styles.safestText}>Use the safest option</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const isIncomplete = status === 'incomplete';
  const eyebrow = isIncomplete ? 'LOOK FOUNDATION' : eventContext ? `READY FOR ${eventContext.title}` : 'READY FROM YOUR WARDROBE';
  const title = isIncomplete ? (lookName || 'Strong Foundation') : (lookName || displayName(items, 'Styled Look'));

  return (
    <View style={[styles.card, isIncomplete && styles.incompleteCard]}>
      <View style={styles.headerRow}>
        <View style={styles.eyebrowRow}>
          <Ionicons name={isIncomplete ? 'layers-outline' : 'checkmark-circle-outline'} size={15} color={isIncomplete ? colors.action : colors.success} />
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        </View>
        {isIncomplete && gaps.length > 0 && <Text style={styles.gapCount}>NEEDS {gaps.length} PIECE{gaps.length === 1 ? '' : 'S'}</Text>}
      </View>

      {items.length > 0 && (
        <View style={styles.collageWrap}>
          <ResolvedOutfitCollage slots={slots} size={collageSize} height={Math.round(collageSize * 0.78)} borderRadius={radii.lg} />
        </View>
      )}

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{messageText}</Text>

      {isIncomplete && items.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WHAT ALREADY WORKS</Text>
          <View style={styles.itemLedger}>
            {items.slice(0, 5).map((item) => {
              const uri = itemImageUri(item);
              return (
                <View key={item.id} style={styles.ledgerItem}>
                  <View style={styles.ledgerThumb}>
                    {uri ? <ExpoImage source={{ uri }} style={StyleSheet.absoluteFill} contentFit={itemImageContentFit(item)} /> : <Ionicons name="shirt-outline" size={16} color={colors.mutedForeground} />}
                  </View>
                  <Text style={styles.ledgerText} numberOfLines={2}>{item.name}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {isIncomplete && gaps.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>COMPLETE THE LOOK</Text>
          <View style={styles.gapList}>
            {gaps.map((gap) => (
              <GapCard key={`${gap.category}-${gap.label}`} item={gap as GapItem} ctaLabel="Find" onPress={onNavigateToShop ? () => onNavigateToShop(gap) : undefined} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.actions}>
        {!isIncomplete && onAddToEvent && eventContext && (
          <TouchableOpacity style={styles.primaryButton} onPress={addToEvent} disabled={adding || added} activeOpacity={0.8} accessibilityRole="button">
            <Ionicons name={added ? 'checkmark-circle' : 'calendar-outline'} size={17} color={colors.primaryForeground} />
            <Text style={styles.primaryButtonText}>{adding ? 'Adding…' : added ? 'Added to event' : `Use this look`}</Text>
          </TouchableOpacity>
        )}
        {!isIncomplete && !eventContext && (
          <TouchableOpacity style={styles.primaryButton} onPress={saveFoundation} disabled={saving || saved} activeOpacity={0.8} accessibilityRole="button">
            <Ionicons name={saved ? 'checkmark-circle' : 'bookmark-outline'} size={17} color={colors.primaryForeground} />
            <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : saved ? 'Saved to outfits' : 'Save this look'}</Text>
          </TouchableOpacity>
        )}
        {isIncomplete && (
          <TouchableOpacity style={[styles.primaryButton, (!gaps.length || !onNavigateToShop) && styles.disabledButton]} onPress={() => gaps[0] && onNavigateToShop?.(gaps[0])} disabled={!gaps.length || !onNavigateToShop} activeOpacity={0.8} accessibilityRole="button">
            <Ionicons name="bag-handle-outline" size={17} color={colors.primaryForeground} />
            <Text style={styles.primaryButtonText}>Find missing pieces</Text>
          </TouchableOpacity>
        )}
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={saveFoundation} disabled={saving || saved || items.length === 0} accessibilityRole="button">
            <Ionicons name={saved ? 'checkmark' : 'bookmark-outline'} size={16} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>{saved ? 'Saved' : isIncomplete ? 'Save foundation' : 'Save look'}</Text>
          </TouchableOpacity>
          {onToggleAudio && (
            <TouchableOpacity style={styles.quietButton} onPress={onToggleAudio} accessibilityRole="button" accessibilityLabel="Read stylist response aloud">
              <Ionicons name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'} size={17} color={colors.mutedForeground} />
              <Text style={styles.quietText}>{isPlaying ? 'Pause' : 'Listen'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceElevated, borderRadius: radii.xl, borderCurve: 'continuous', padding: spacing.lg, gap: spacing.md, ...shadows.sm },
  incompleteCard: { backgroundColor: '#F7F1E8' },
  clarificationCard: { backgroundColor: colors.surfaceElevated },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  eyebrow: { ...typography.text.eyebrow, color: colors.primary },
  gapCount: { ...typography.text.eyebrow, color: colors.action },
  title: { ...typography.text.editorialTitle, color: colors.foreground },
  body: { fontSize: typography.text.body.fontSize, lineHeight: typography.text.body.fontSize * 1.5, color: colors.inkSubtle },
  collageWrap: { backgroundColor: colors.card, borderRadius: radii.lg, overflow: 'hidden', alignItems: 'center' },
  section: { gap: spacing.sm },
  sectionLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  itemLedger: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ledgerItem: { width: 76, gap: spacing.xs },
  ledgerThumb: { width: 76, height: 76, backgroundColor: colors.surfaceElevated, borderRadius: radii.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  ledgerText: { fontSize: typography.text.caption.fontSize, lineHeight: 15, color: colors.secondaryForeground },
  gapList: { gap: spacing.sm },
  actions: { gap: spacing.sm },
  primaryButton: { minHeight: 48, borderRadius: radii.md, borderCurve: 'continuous', backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.text.body.fontSize, fontWeight: typography.weight.semibold },
  secondaryActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  secondaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  secondaryButtonText: { color: colors.primary, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold },
  quietButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  quietText: { color: colors.mutedForeground, fontSize: typography.text.bodySmall.fontSize },
  optionGrid: { gap: spacing.sm },
  optionButton: { minHeight: 48, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radii.md, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceSubtle },
  optionText: { flex: 1, color: colors.foreground, fontSize: typography.text.body.fontSize, fontWeight: typography.weight.medium },
  safestButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  safestText: { color: colors.action, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold },
});
