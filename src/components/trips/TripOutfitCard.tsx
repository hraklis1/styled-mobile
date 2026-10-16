import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { ResolvedOutfitCollage } from '../outfits/ResolvedOutfitCollage';
import { GapCard } from '../stylist/GapCard';
import type { useCreateOutfit, CreateOutfitInput } from '../../hooks/useOutfits';
import { colors, radii, spacing, stroke, typography } from '../../theme';
import type { Item } from '../../types/item';

// Lives outside stylist/TripPlanCard so the Trip screen can render a look
// without importing the chat card (which imports the Trip screen back).
export type TripOutfit = { label: string; note: string; itemIds: number[]; status?: 'ready' | 'incomplete'; foundationItemIds?: number[]; missingEssentials?: Array<{ label: string; category: string; reason: string; context: string; priority: number; unlocks?: string[] }> };

export type EventContext = { id: number; title: string };

function outfitName(items: Item[], fallback: string): string {
  if (items.length === 0) return fallback;
  return items.slice(0, 2).map((i) => i.name).join(' · ');
}

export function TripOutfitCard({
  outfit,
  allItems,
  createOutfit,
  cardWidth,
  intro,
  eventContext,
  onAddToEvent,
  onNavigateToCloset,
  onSaveOutfit,
  saveLabel,
  gapsTitle = 'Complete before packing',
  index,
  total,
}: {
  gapsTitle?: string;
  index: number;
  total: number;
  outfit: TripOutfit;
  allItems: Item[];
  createOutfit: ReturnType<typeof useCreateOutfit>;
  cardWidth: number;
  intro: string;
  eventContext?: EventContext;
  onAddToEvent?: (itemIds: number[]) => Promise<unknown>;
  onNavigateToCloset?: (outfitId: number) => void;
  onSaveOutfit?: (input: CreateOutfitInput) => Promise<unknown>;
  saveLabel?: string;
}) {
  const [savedOutfitId, setSavedOutfitId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  const items = useMemo(
    () => (outfit.status === 'incomplete' ? (outfit.foundationItemIds ?? []) : outfit.itemIds).map((id) => allItems.find((i) => i.id === id)).filter((i): i is Item => !!i),
    [outfit.itemIds, outfit.foundationItemIds, outfit.status, allItems],
  );
  const slots = useMemo(
    () => items.map((i) => ({
      key: String(i.id),
      uri: itemImageUri(i),
      contentFit: itemImageContentFit(i),
    })),
    [items],
  );

  const handleSave = useCallback(async () => {
    if (saved || saving || items.length === 0) return;
    setSaving(true);
    try {
      const input: CreateOutfitInput = {
        name: outfitName(items, outfit.label || 'Trip look'),
        description: (outfit.note || intro).slice(0, 200) || null,
        isDraft: outfit.status === 'incomplete',
        itemIds: items.map((i) => ({ id: i.id, category: i.category as string })),
      };
      // Defaults to a plain closet save; the board capsule sheet passes a
      // wrapper that also files the new outfit onto the board.
      const savedOutfit = await (onSaveOutfit ? onSaveOutfit(input) : createOutfit.mutateAsync(input));
      if (savedOutfit && typeof savedOutfit === 'object' && 'id' in savedOutfit && typeof savedOutfit.id === 'number') setSavedOutfitId(savedOutfit.id);
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Mutation surfaces its own error
    } finally {
      setSaving(false);
    }
  }, [saved, saving, items, outfit.label, outfit.note, intro, createOutfit, onSaveOutfit]);

  const handleAddToEvent = useCallback(async () => {
    if (!onAddToEvent || outfit.status === 'incomplete' || added || adding || items.length === 0) return;
    setAdding(true);
    try {
      await onAddToEvent(items.map((i) => i.id));
      setAdded(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Mutation surfaces its own error
    } finally {
      setAdding(false);
    }
  }, [onAddToEvent, added, adding, items]);

  // Full card width: at carousel size the collage clears the editorial
  // threshold and gets the same white mat as the single-look card.
  const collageSize = cardWidth;
  const incomplete = outfit.status === 'incomplete';
  const actionLabel = saving ? 'Saving…' : saved ? 'Saved' : saveLabel ?? (incomplete ? 'Save as draft' : 'Save outfit');

  return (
    <View style={[styles.outfitCard, { width: cardWidth }]}>
      <View style={styles.outfitHeader}>
        <Text style={styles.lookIndex}>{total > 1 ? `Look ${index + 1} of ${total}` : 'The look'}</Text>
        {incomplete ? (
          <View style={styles.statusTag}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Needs a piece</Text>
          </View>
        ) : null}
      </View>
      {outfit.label ? <Text style={styles.outfitLabel} numberOfLines={2}>{outfit.label}</Text> : null}
      {slots.length > 0 && (
        <ResolvedOutfitCollage
          slots={slots}
          size={collageSize}
          height={Math.round(collageSize * 0.84)}
          borderRadius={radii.mat}
        />
      )}
      {outfit.note ? <Text style={styles.outfitNote}>{outfit.note}</Text> : null}
      {incomplete && outfit.missingEssentials?.length ? (
        <View style={styles.tripGaps}>
          <Text style={styles.tripGapsTitle}>{gapsTitle}</Text>
          {outfit.missingEssentials.slice(0, 3).map((gap, gapIndex) => <GapCard key={`${gap.category}-${gapIndex}`} item={gap} />)}
        </View>
      ) : null}
      <View style={styles.actions}>
        {onAddToEvent && eventContext && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleAddToEvent}
            disabled={added || adding || items.length === 0}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Add this look to ${eventContext.title}`}
          >
            <Ionicons name={added ? 'checkmark' : 'calendar-outline'} size={15} color={colors.primaryForeground} />
            <Text style={styles.primaryBtnText} numberOfLines={1}>
              {adding ? 'Adding…' : added ? 'Added to event' : `Add to ${eventContext.title}`}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnDone]}
          onPress={handleSave}
          disabled={saved || saving || items.length === 0}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Saved to Closet' : actionLabel}
          accessibilityState={{ selected: saved, busy: saving }}
        >
          <Ionicons
            name={saved ? 'checkmark' : 'bookmark-outline'}
            size={15}
            color={saved ? colors.primaryForeground : colors.primary}
          />
          <Text style={[styles.saveBtnText, saved && styles.saveBtnTextDone]}>{actionLabel}</Text>
        </TouchableOpacity>
        {savedOutfitId !== null && onNavigateToCloset ? (
          <TouchableOpacity style={styles.viewLink} accessibilityRole="button" onPress={() => onNavigateToCloset(savedOutfitId)}>
            <Text style={styles.viewLinkText}>View outfit</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outfitCard: { gap: spacing.md },
  outfitHeader: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  lookIndex: { ...typography.text.eyebrow, color: colors.mutedForeground },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accentInk },
  statusText: { ...typography.text.eyebrow, color: colors.accentInk },
  outfitLabel: {
    ...typography.text.editorialSection,
    color: colors.foreground,
    marginTop: -spacing.xs,
  },
  outfitNote: {
    ...typography.text.bodySmall,
    color: colors.inkSubtle,
    lineHeight: typography.text.bodySmall.fontSize * 1.5,
  },
  tripGaps: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: stroke.hairline,
    borderTopColor: colors.hairline,
  },
  tripGapsTitle: { ...typography.text.eyebrow, color: colors.accentInk },
  actions: { paddingTop: spacing.xs, gap: spacing.sm },
  primaryBtn: {
    minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.lg, borderRadius: radii.action, backgroundColor: colors.primary,
  },
  primaryBtnText: { ...typography.text.label, color: colors.primaryForeground, flexShrink: 1 },
  saveBtn: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.action,
    borderWidth: stroke.fine,
    borderColor: colors.ghostStroke,
  },
  saveBtnDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  saveBtnText: { ...typography.text.label, color: colors.primary },
  saveBtnTextDone: { color: colors.primaryForeground },
  viewLink: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs },
  viewLinkText: { ...typography.text.label, color: colors.primary, textDecorationLine: 'underline' },
});
