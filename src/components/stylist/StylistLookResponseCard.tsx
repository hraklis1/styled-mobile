import { useStylistCardState } from './StylistCardState';
import { StylistRichText } from './StylistRichText';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import * as Haptics from '../../lib/haptics';
import { Ionicons } from '@expo/vector-icons';

import { GapCard, humanizeGeneratedCopy, type GapItem } from './GapCard';
import { ItemDetailSheet } from './ChatItemDetailSheet';
import { Reveal } from './Reveal';
import { PressableScale } from '../primitives/PressableScale';
import { ResolvedOutfitCollage } from '../outfits/ResolvedOutfitCollage';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { colors, radii, spacing, typography } from '../../theme';
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
  /** The look's rationale alone; falls back to messageText on older servers. */
  rationale?: string;
  /** 'weather_layer': wearable now, only a weather layer the closet lacks. */
  completion?: 'weather_layer';
  missingEssentials?: StylistMissingEssential[];
  clarification?: StylistClarification;
  allItems: Item[];
  createOutfit: { mutateAsync: (input: CreateOutfitInput) => Promise<{ id: number }> };
  eventContext?: { id: number; title: string };
  eventPlan?: StylistEventPlanData | null;
  onAddToEvent?: (itemIds: number[], eventPlan?: StylistEventPlanData | null) => Promise<unknown>;
  onNavigateToCloset?: (outfitId: number) => void;
  onNavigateToShop?: (gap?: StylistMissingEssential) => void;
  onClarificationSelect?: (value: string) => void;
  onToggleAudio?: () => void;
  isPlaying?: boolean;
  /** Assemble section by section — only for a reply that just arrived. */
  reveal?: boolean;
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
  rationale,
  completion,
  missingEssentials = [],
  clarification,
  allItems,
  createOutfit,
  eventContext,
  eventPlan,
  onAddToEvent,
  onNavigateToCloset,
  onNavigateToShop,
  onClarificationSelect,
  onToggleAudio,
  isPlaying = false,
  reveal = false,
}: Props) {
  const { width } = useWindowDimensions();
  const [savedOutfitId, setSavedOutfitId] = useStylistCardState<number | null>('foundation-id', null);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useStylistCardState('foundation-saved', false);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [detailItem, setDetailItem] = useState<Item | null>(null);

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
    setSaveError(false);
    try {
      const outfit = await createOutfit.mutateAsync({
        name: displayName(items),
        description: messageText.slice(0, 240) || null,
        notes: gaps.length ? `Foundation needs: ${gaps.map((gap) => gap.label).join(', ')}` : null,
        tags: ['stylist-foundation'],
        // A weather add-on look is wearable as it stands; only a true foundation is a draft.
        isDraft: status === 'incomplete' && completion !== 'weather_layer',
        stylistReady: status === 'ready',
        itemIds: items.map((item) => ({ id: item.id, category: item.category ?? 'other' })),
      });
      setSavedOutfitId(outfit.id);
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setSaveError(true);
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

  // A weather add-on is wearable now; only a genuine foundation reads as unfinished.
  const weatherAddOn = status === 'incomplete' && completion === 'weather_layer';
  const isFoundation = status === 'incomplete' && !weatherAddOn;
  const eyebrow = isFoundation ? 'Look foundation' : eventContext ? `Ready for ${eventContext.title}` : 'The look';
  const title = lookName || (isFoundation ? 'Strong foundation' : displayName(items, 'Styled look'));
  const meta = weatherAddOn && gaps[0]
    ? `From your wardrobe · add ${withArticle(gaps[0].label)} if you're out in it`
    : isFoundation && gaps.length
      ? `${piecesPhrase(items.length)} · needs ${gaps.slice(0, 2).map((gap) => bareLabel(gap.label)).join(' and ')}`
      : piecesPhrase(items.length);
  const body = rationale?.trim() || messageText;
  // Each gap row already carries its own Find; a summary button only earns its
  // place when there are several pieces to find.
  const findAll = isFoundation && gaps.length > 1 && !!onNavigateToShop;
  const primarySave = !isFoundation && !(eventContext && onAddToEvent);

  return (
    <>
      <View style={styles.card}>
        <Reveal active={reveal} step={0} style={styles.header}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>{meta}</Text>
        </Reveal>

        {items.length > 0 && (
          <Reveal active={reveal} step={1} style={styles.collageWrap}>
            <ResolvedOutfitCollage
              slots={slots}
              size={collageSize}
              height={Math.round(collageSize * 0.78)}
              borderRadius={radii.lg}
              onSlotPress={(key) => setDetailItem(items.find((item) => String(item.id) === key) ?? null)}
            />
          </Reveal>
        )}

        <Reveal active={reveal} step={2}>
          <StylistRichText text={body} />
        </Reveal>

        {gaps.length > 0 && (
          <Reveal active={reveal} step={3} style={styles.section}>
            {isFoundation ? <Text style={styles.sectionLabel}>Complete the look</Text> : null}
            <View style={styles.gapList}>
              {gaps.map((gap) => (
                <GapCard key={`${gap.category}-${gap.label}`} item={gap as GapItem} ctaLabel="Find" onPress={onNavigateToShop ? () => onNavigateToShop(gap) : undefined} />
              ))}
            </View>
          </Reveal>
        )}

        <Reveal active={reveal} step={4} style={styles.actions}>
          {saveError ? <Text style={styles.error} accessibilityRole="alert">Couldn’t save this outfit. Try again.</Text> : null}
          {status === 'ready' && onAddToEvent && eventContext ? (
            <PressableScale contentStyle={styles.primaryButton} scaleTo={0.97} onPress={addToEvent} disabled={adding || added} accessibilityRole="button">
              <Ionicons name={added ? 'checkmark-circle' : 'calendar-outline'} size={17} color={colors.primaryForeground} />
              <Text style={styles.primaryButtonText}>{adding ? 'Adding…' : added ? 'Added to event' : 'Use this look'}</Text>
            </PressableScale>
          ) : null}
          {findAll ? (
            <PressableScale contentStyle={styles.primaryButton} scaleTo={0.97} onPress={() => gaps[0] && onNavigateToShop?.(gaps[0])} accessibilityRole="button">
              <Ionicons name="bag-handle-outline" size={17} color={colors.primaryForeground} />
              <Text style={styles.primaryButtonText}>{`Find ${gaps.length} missing pieces`}</Text>
            </PressableScale>
          ) : null}
          <View style={styles.actionRow}>
            <PressableScale
              style={primarySave ? styles.grow : undefined}
              contentStyle={primarySave ? styles.primaryButton : styles.outlineButton}
              scaleTo={0.97}
              onPress={saveFoundation}
              disabled={saving || saved || items.length === 0}
              accessibilityRole="button"
            >
              <Ionicons name={saved ? 'checkmark-circle' : 'bookmark-outline'} size={16} color={primarySave ? colors.primaryForeground : colors.primary} />
              <Text style={primarySave ? styles.primaryButtonText : styles.outlineButtonText}>
                {saving ? 'Saving…' : saved ? 'Saved to outfits' : isFoundation ? 'Save foundation' : 'Save outfit'}
              </Text>
            </PressableScale>
            {savedOutfitId !== null && onNavigateToCloset ? (
              <TouchableOpacity style={styles.quietButton} accessibilityRole="button" onPress={() => onNavigateToCloset(savedOutfitId)}>
                <Text style={styles.quietText}>View outfit</Text>
              </TouchableOpacity>
            ) : null}
            {onToggleAudio ? (
              <TouchableOpacity style={styles.quietButton} onPress={onToggleAudio} accessibilityRole="button" accessibilityLabel="Read stylist response aloud">
                <Ionicons name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'} size={17} color={colors.mutedForeground} />
                <Text style={styles.quietText}>{isPlaying ? 'Pause' : 'Listen'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Reveal>
      </View>
      {/* Outside the card's spaced stack, so the hidden sheet adds no gap. */}
      <ItemDetailSheet item={detailItem} onClose={() => setDetailItem(null)} />
    </>
  );
}

function piecesPhrase(count: number): string {
  return count === 1 ? '1 piece from your wardrobe' : `${count} pieces from your wardrobe`;
}

/** "A rain layer" / "Rain layer" → "rain layer": the label as it reads mid-sentence. */
function bareLabel(label: string): string {
  const cleaned = humanizeGeneratedCopy(label).replace(/^(a|an|the)\s+/i, '');
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

function withArticle(label: string): string {
  const bare = bareLabel(label);
  return `${/^[aeiou]/i.test(bare) ? 'an' : 'a'} ${bare}`;
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  clarificationCard: {},
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  header: { gap: spacing.xs },
  // One label per card, matching the complete-look card's "The look".
  eyebrow: { ...typography.text.eyebrow, color: colors.primary },
  title: { ...typography.text.editorialTitle, color: colors.foreground },
  meta: { ...typography.text.meta, color: colors.mutedForeground },
  collageWrap: { backgroundColor: colors.card, borderRadius: radii.lg, overflow: 'hidden', alignItems: 'center' },
  section: { gap: spacing.sm },
  sectionLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  gapList: { gap: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  primaryButton: {
    minHeight: 48, borderRadius: radii.full, borderCurve: 'continuous', backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg,
  },
  primaryButtonText: { ...typography.text.label, color: colors.primaryForeground },
  outlineButton: {
    minHeight: 44, borderRadius: radii.full, borderWidth: 1, borderColor: colors.ghostStroke, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg,
  },
  outlineButtonText: { ...typography.text.bodySmall, color: colors.primary, fontWeight: typography.weight.semibold },
  quietButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  quietText: { ...typography.text.bodySmall, color: colors.mutedForeground },
  error: { ...typography.text.bodySmall, color: colors.error },
  optionGrid: { gap: spacing.sm },
  optionButton: { minHeight: 48, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radii.md, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceSubtle },
  optionText: { ...typography.text.body, flex: 1, color: colors.foreground, fontWeight: typography.weight.medium },
  safestButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  safestText: { ...typography.text.bodySmall, color: colors.action, fontWeight: typography.weight.semibold },
});
