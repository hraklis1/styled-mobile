import { StylistRichText } from './StylistRichText';
import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { ResolvedOutfitCollage } from '../outfits/ResolvedOutfitCollage';
import { GapCard } from './GapCard';
import { useCreateOutfit, type CreateOutfitInput } from '../../hooks/useOutfits';
import { colors, radii, spacing, stroke, typography } from '../../theme';
import type { Item } from '../../types/item';

export type TripOutfit = { label: string; note: string; itemIds: number[]; status?: 'ready' | 'incomplete'; foundationItemIds?: number[]; missingEssentials?: Array<{ label: string; category: string; reason: string; context: string; priority: number; unlocks?: string[] }> };
export type TripPlanData = {
  intro: string;
  outfits: TripOutfit[];
  packingList: string[];
  /** Owned pieces in packingList (server v12+). */
  packingItemIds?: number[];
  kind?: 'trip' | 'board_capsule' | 'style_item';
  /** style_item: the owned piece every look is built around. */
  anchorItemId?: number;
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

export function TripPlanCard({
  plan,
  allItems,
  createOutfit,
  eventContext,
  onAddToEvent,
  onNavigateToCloset,
  onSaveOutfit,
  saveLabel,
  eyebrowLabel,
}: {
  plan: TripPlanData;
  allItems: Item[];
  createOutfit: ReturnType<typeof useCreateOutfit>;
  eventContext?: EventContext;
  onAddToEvent?: (itemIds: number[]) => Promise<unknown>;
  /** Override what saving a look does — defaults to createOutfit.mutateAsync. */
  onNavigateToCloset?: (outfitId: number) => void;
  onSaveOutfit?: (input: CreateOutfitInput) => Promise<unknown>;
  saveLabel?: string;
  /** Replaces the "Trip plan" / "Board capsule" eyebrow, e.g. for a single board look. */
  eyebrowLabel?: string;
}) {
  const { width } = useWindowDimensions();
  // One card fills the column with the next peeking in by a clear margin,
  // so the rail reads as swipeable rather than clipped.
  const CARD_GAP = spacing.lg;
  const PEEK = 36;
  const cardWidth = Math.min(width - spacing.page * 2 - PEEK, 360);
  // Trailing room equal to the leftover column width lets the LAST card snap
  // flush left too, instead of stopping with the previous card showing.
  const trailing = Math.max(0, width - spacing.page * 2 - cardWidth);
  const [packed, setPacked] = useState<Record<number, boolean>>({});
  const [activeOutfit, setActiveOutfit] = useState(0);
  // A horizontal rail is as tall as its tallest card, which strands a short
  // look above empty space. Measure each card and fit the rail to the one in
  // view, easing the change as the reader swipes.
  const [cardHeights, setCardHeights] = useState<Record<number, number>>({});
  const activeHeight = cardHeights[activeOutfit];
  const goToOutfit = (next: number) => {
    if (next === activeOutfit) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setActiveOutfit(next);
  };
  const [packingExpanded, setPackingExpanded] = useState(false);
  const isBoardCapsule = plan.kind === 'board_capsule';
  const isStyleItem = plan.kind === 'style_item';
  // Only a real trip (it comes with a packing list) talks about packing;
  // capsules, style-item looks and multi-event plans just need the piece.
  const isPackingTrip = (!plan.kind || plan.kind === 'trip') && plan.packingList.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.sectionEyebrow}>
        <Ionicons name={isBoardCapsule ? 'albums-outline' : isStyleItem ? 'shirt-outline' : 'briefcase-outline'} size={13} color={colors.primary} />
        <Text style={styles.sectionEyebrowText}>{eyebrowLabel ?? (isBoardCapsule ? 'Board capsule' : isStyleItem ? 'Ways to wear it' : 'Trip plan')}</Text>
      </View>
      {plan.intro ? <StylistRichText text={plan.intro} /> : null}

      <ScrollView
        horizontal
        style={activeHeight && !plan.pending ? { height: activeHeight + spacing.xs * 2 } : undefined}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.carousel, { paddingRight: trailing }]}
        decelerationRate="fast"
        snapToInterval={cardWidth + CARD_GAP}
        onMomentumScrollEnd={(event) => {
          const page = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP));
          goToOutfit(Math.max(0, Math.min(page, plan.outfits.length - 1)));
        }}
      >
        {plan.outfits.map((o, i) => (
          <View
            key={`${o.label}-${i}`}
            onLayout={(event) => {
              const h = Math.round(event.nativeEvent.layout.height);
              setCardHeights((prev) => (prev[i] === h ? prev : { ...prev, [i]: h }));
            }}
          >
          <TripOutfitCard
            gapsTitle={isPackingTrip ? 'Complete before packing' : 'Complete the look'}
            index={i}
            total={plan.outfits.length}
            outfit={o}
            allItems={allItems}
            createOutfit={createOutfit}
            cardWidth={cardWidth}
            intro={plan.intro}
            eventContext={eventContext}
            onAddToEvent={onAddToEvent}
            onNavigateToCloset={onNavigateToCloset}
            onSaveOutfit={onSaveOutfit}
            saveLabel={saveLabel}
          />
          </View>
        ))}
        {plan.pending && (
          <View style={[styles.outfitCard, styles.placeholderCard, { width: cardWidth }]}>
            <Ionicons name="sparkles-outline" size={22} color={colors.mutedForeground} />
            <Text style={styles.placeholderText}>Filling in your looks…</Text>
          </View>
        )}
      </ScrollView>


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
    ...typography.text.eyebrow,
    color: colors.primary,
  },
  intro: {
    fontSize: typography.text.sheetTitle.fontSize,
    color: colors.foreground,
    lineHeight: typography.text.sheetTitle.fontSize * 1.4,
  },
  // Top-aligned, content-height cards: a short look keeps its button close
  // instead of stretching to the tallest card in the rail.
  carousel: { gap: spacing.lg, paddingVertical: spacing.xs, alignItems: 'flex-start' },
  outfitCard: { gap: spacing.md },
  placeholderCard: {
    alignItems: 'center', justifyContent: 'center', minHeight: 320,
    borderWidth: stroke.hairline, borderColor: colors.hairline, borderStyle: 'dashed',
  },
  placeholderText: { color: colors.mutedForeground, fontSize: typography.text.bodySmall.fontSize, marginTop: spacing.xs },
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
    fontSize: typography.text.bodySmall.fontSize,
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
  packing: {
    paddingVertical: spacing.md, gap: spacing.xs,
  },
  packingTitle: {
    fontSize: typography.text.sectionTitle.fontSize,
    color: colors.foreground,
  },
  packingHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  packingMeta: { marginTop: 2, color: colors.mutedForeground, fontSize: typography.text.caption.fontSize },
  packingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  packingText: { flex: 1, fontSize: typography.text.bodySmall.fontSize, color: colors.foreground },
  packingTextDone: { textDecorationLine: 'line-through', color: colors.mutedForeground },
});
