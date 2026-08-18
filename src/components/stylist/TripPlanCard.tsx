import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { ResolvedOutfitCollage } from '../outfits/ResolvedOutfitCollage';
import { GapCard } from './GapCard';
import { useCreateOutfit, type CreateOutfitInput } from '../../hooks/useOutfits';
import { colors, radii, spacing, typography } from '../../theme';
import type { Item } from '../../types/item';

export type TripOutfit = { label: string; note: string; itemIds: number[]; status?: 'ready' | 'incomplete'; foundationItemIds?: number[]; missingEssentials?: Array<{ label: string; category: string; reason: string; context: string; priority: number; unlocks?: string[] }> };
export type TripPlanData = {
  intro: string;
  outfits: TripOutfit[];
  packingList: string[];
  kind?: 'trip' | 'board_capsule';
  // Set while the stream is still delivering outfit events so the carousel can
  // show placeholder slots ("filling in…") before the done event arrives.
  pending?: boolean;
};

type EventContext = { id: number; title: string };

function outfitName(items: Item[], fallback: string): string {
  if (items.length === 0) return fallback;
  return items.slice(0, 2).map((i) => i.name).join(' · ');
}

function TripOutfitCard({
  outfit,
  allItems,
  createOutfit,
  cardWidth,
  intro,
  eventContext,
  onAddToEvent,
  onSaveOutfit,
  saveLabel,
}: {
  outfit: TripOutfit;
  allItems: Item[];
  createOutfit: ReturnType<typeof useCreateOutfit>;
  cardWidth: number;
  intro: string;
  eventContext?: EventContext;
  onAddToEvent?: (itemIds: number[]) => Promise<unknown>;
  onSaveOutfit?: (input: CreateOutfitInput) => Promise<unknown>;
  saveLabel?: string;
}) {
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
      await (onSaveOutfit ? onSaveOutfit(input) : createOutfit.mutateAsync(input));
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

  const collageSize = cardWidth - spacing.lg * 2;

  return (
    <View style={[styles.outfitCard, { width: cardWidth }]}>
      <View style={styles.outfitHeader}>
        {outfit.label ? <Text style={styles.outfitLabel} numberOfLines={1}>{outfit.label}</Text> : null}
        {outfit.status === 'incomplete' && <Text style={styles.incompleteLabel}>FOUNDATION</Text>}
      </View>
      {slots.length > 0 && (
        <View style={styles.collageFrame}>
          <ResolvedOutfitCollage
            slots={slots}
            size={collageSize}
            height={Math.round(collageSize * 0.82)}
            borderRadius={radii.md}
          />
        </View>
      )}
      {outfit.note ? <Text style={styles.outfitNote}>{outfit.note}</Text> : null}
      {outfit.status === 'incomplete' && outfit.missingEssentials?.length ? (
        <View style={styles.tripGaps}>
          <Text style={styles.tripGapsTitle}>Complete before packing</Text>
          {outfit.missingEssentials.slice(0, 3).map((gap, index) => <GapCard key={`${gap.category}-${index}`} item={gap} />)}
        </View>
      ) : null}
      {onAddToEvent && eventContext && (
        <TouchableOpacity
          style={[styles.addEventBtn, added && styles.addEventBtnDone]}
          onPress={handleAddToEvent}
          disabled={added || adding || items.length === 0}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Add this look to ${eventContext.title}`}
        >
          <Ionicons
            name={added ? 'checkmark-circle' : 'calendar-outline'}
            size={14}
            color={colors.primaryForeground}
          />
          <Text style={styles.addEventBtnText} numberOfLines={1}>
            {adding ? 'Adding…' : added ? 'Added to event' : `Add to ${eventContext.title}`}
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.saveBtn, (saved || saving) && styles.saveBtnDone]}
        onPress={handleSave}
        disabled={saved || saving || items.length === 0}
        activeOpacity={0.8}
      >
        <Ionicons
          name={saved ? 'checkmark-circle' : 'bookmark-outline'}
          size={14}
          color={saved ? colors.primaryForeground : colors.primary}
        />
        <Text style={[styles.saveBtnText, saved && styles.saveBtnTextDone]}>
          {saving ? 'Saving…' : saved ? 'Saved' : saveLabel ?? (outfit.status === 'incomplete' ? 'Save foundation' : 'Save look')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function TripPlanCard({
  plan,
  allItems,
  createOutfit,
  eventContext,
  onAddToEvent,
  onSaveOutfit,
  saveLabel,
}: {
  plan: TripPlanData;
  allItems: Item[];
  createOutfit: ReturnType<typeof useCreateOutfit>;
  eventContext?: EventContext;
  onAddToEvent?: (itemIds: number[]) => Promise<unknown>;
  /** Override what saving a look does — defaults to createOutfit.mutateAsync. */
  onSaveOutfit?: (input: CreateOutfitInput) => Promise<unknown>;
  saveLabel?: string;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - spacing.xxl * 2, 320);
  const [packed, setPacked] = useState<Record<number, boolean>>({});
  const [activeOutfit, setActiveOutfit] = useState(0);
  const [packingExpanded, setPackingExpanded] = useState(false);
  const isBoardCapsule = plan.kind === 'board_capsule';

  return (
    <View style={styles.container}>
      <View style={styles.sectionEyebrow}>
        <Ionicons name={isBoardCapsule ? 'albums-outline' : 'briefcase-outline'} size={13} color={colors.primary} />
        <Text style={styles.sectionEyebrowText}>{isBoardCapsule ? 'Board capsule' : 'Trip plan'}</Text>
      </View>
      {plan.intro ? <Text style={styles.intro}>{plan.intro}</Text> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        decelerationRate="fast"
        snapToInterval={cardWidth + spacing.md}
        onMomentumScrollEnd={(event) => {
          const page = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + spacing.md));
          setActiveOutfit(Math.max(0, Math.min(page, plan.outfits.length - 1)));
        }}
      >
        {plan.outfits.map((o, i) => (
          <TripOutfitCard
            key={`${o.label}-${i}`}
            outfit={o}
            allItems={allItems}
            createOutfit={createOutfit}
            cardWidth={cardWidth}
            intro={plan.intro}
            eventContext={eventContext}
            onAddToEvent={onAddToEvent}
            onSaveOutfit={onSaveOutfit}
            saveLabel={saveLabel}
          />
        ))}
        {plan.pending && (
          <View style={[styles.outfitCard, styles.placeholderCard, { width: cardWidth }]}>
            <Ionicons name="sparkles-outline" size={22} color={colors.mutedForeground} />
            <Text style={styles.placeholderText}>Filling in your looks…</Text>
          </View>
        )}
      </ScrollView>

      {plan.outfits.length > 1 ? (
        <View style={styles.pagination} accessibilityLabel={`Look ${activeOutfit + 1} of ${plan.outfits.length}`}>
          {plan.outfits.map((_, index) => <View key={index} style={[styles.pageDot, index === activeOutfit && styles.pageDotActive]} />)}
        </View>
      ) : null}

      {plan.packingList.length > 0 && (
        <View style={styles.packing}>
          <TouchableOpacity style={styles.packingHeader} onPress={() => setPackingExpanded((open) => !open)}>
            <View>
              <Text style={styles.packingTitle}>{isBoardCapsule ? 'Capsule checklist' : 'Packing list'}</Text>
              <Text style={styles.packingMeta}>{Object.values(packed).filter(Boolean).length} of {plan.packingList.length} selected</Text>
            </View>
            <Ionicons name={packingExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
          </TouchableOpacity>
          {packingExpanded ? plan.packingList.map((entry, i) => (
              <TouchableOpacity
                key={`${entry}-${i}`}
                style={styles.packingRow}
                onPress={() => setPacked((p) => ({ ...p, [i]: !p[i] }))}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={packed[i] ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={packed[i] ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.packingText, packed[i] && styles.packingTextDone]}>{entry}</Text>
              </TouchableOpacity>
            )) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  sectionEyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionEyebrowText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  intro: {
    fontFamily: typography.family.display,
    fontSize: typography.size.xl,
    color: colors.foreground,
    lineHeight: typography.size.xl * 1.4,
  },
  carousel: { gap: spacing.md, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  outfitCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}24`,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  placeholderCard: { alignItems: 'center', justifyContent: 'center', minHeight: 220 },
  placeholderText: { color: colors.mutedForeground, fontSize: typography.size.sm, marginTop: spacing.xs },
  outfitLabel: {
    fontFamily: typography.family.display,
    fontSize: typography.size.lg,
    color: colors.foreground,
  },
  outfitHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  incompleteLabel: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1, color: colors.action },
  collageFrame: { borderRadius: radii.md, overflow: 'hidden' },
  outfitNote: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    lineHeight: typography.size.sm * 1.5,
  },
  tripGaps: { backgroundColor: '#F7F1E8', borderRadius: radii.md, padding: spacing.sm, gap: spacing.xs },
  tripGapsTitle: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.action, textTransform: 'uppercase', letterSpacing: 0.6 },
  addEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  addEventBtnDone: { backgroundColor: colors.primary },
  addEventBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primaryForeground,
    flexShrink: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  saveBtnDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  saveBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.primary },
  saveBtnTextDone: { color: colors.primaryForeground },
  pagination: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  pageDotActive: { width: 18, backgroundColor: colors.primary },
  packing: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  packingTitle: {
    fontFamily: typography.family.display,
    fontSize: typography.size.lg,
    color: colors.foreground,
  },
  packingHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  packingMeta: { marginTop: 2, color: colors.mutedForeground, fontSize: typography.size.xs },
  packingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  packingText: { flex: 1, fontSize: typography.size.sm, color: colors.foreground },
  packingTextDone: { textDecorationLine: 'line-through', color: colors.mutedForeground },
});
