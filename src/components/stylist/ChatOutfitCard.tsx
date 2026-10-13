import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStylistCardState } from './StylistCardState';
import { Pressable, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from '../../lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { useCreateOutfit, useDeleteOutfit, useGenerateEventOutfitPlan, useMarkOutfitWorn, type CreateOutfitInput } from '../../hooks/useOutfits';
import { ItemPickerSheet } from '../outfits/ItemPickerSheet';
import type { BoardEntryRef } from '../../hooks/useBoards';
import { ResolvedOutfitCollage } from '../outfits/ResolvedOutfitCollage';
import { StylistRichText } from './StylistRichText';
import { StylingMovesStrip } from './StylingMovesStrip';
import { colors, radii, spacing } from '../../theme';
import { STYLIST_NEGATIVE_REASON_CHIPS, type StylistEventPlanData, type StylistFeedbackMetadata, type StylistNegativeReason, type StylistPieceNote } from '../../features/stylist/types';
import type { Item } from '../../types/item';
import { ItemDetailSheet } from './ChatItemDetailSheet';
import { EventContext } from './ChatModel';
import { styles } from './ChatStyles';

// ── OutfitSuggestionCard ──────────────────────────────────────────────────────

const OUTFIT_CATEGORY_ORDER = ['full_body', 'top', 'bottom', 'shoes', 'outerwear', 'accessory'];

function outfitNameFromItems(items: Item[]): string {
  if (items.length === 0) return 'AI Outfit';
  const sorted = [...items].sort(
    (a, b) => OUTFIT_CATEGORY_ORDER.indexOf(a.category ?? '') - OUTFIT_CATEGORY_ORDER.indexOf(b.category ?? ''),
  );
  return sorted.slice(0, 2).map((i) => i.name).join(' · ');
}

type OutfitCompleteLookOverviewProps = {
  items: Item[];
  pieceNotes?: StylistPieceNote[];
  onItemPress: (item: Item) => void;
  onSwapItem: (itemId: number) => void;
  onAddItem: () => void;
};

function categoryLabel(category: Item['category']): string {
  return category ? category.replace(/_/g, ' ') : 'piece';
}

// The stylist's wearing tip for a piece ("half-tuck the front"), if it gave one.
export function pieceTip(notes: StylistPieceNote[] | undefined, itemId: number): string | undefined {
  const tip = notes?.find((note) => note.itemId === itemId)?.tip;
  return tip ? tip.charAt(0).toUpperCase() + tip.slice(1) : undefined;
}

function OutfitCompleteLookOverview({
  items,
  pieceNotes,
  onItemPress,
  onSwapItem,
  onAddItem,
}: OutfitCompleteLookOverviewProps) {
  const overviewItems = useMemo(
    () =>
      items.map((item) => ({
        item,
        uri: itemImageUri(item),
        contentFit: itemImageContentFit(item),
      })),
    [items],
  );

  if (overviewItems.length === 0) return null;

  return (
    <View style={styles.lineSheet}>
      <Text style={[styles.rationaleLabel, styles.lineSheetLabel]}>Complete look</Text>

      {overviewItems.map(({ item, uri, contentFit }) => (
        <Pressable
          key={item.id}
          style={styles.lineSheetRow}
          onPress={() => onItemPress(item)}
          onLongPress={() => onSwapItem(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${item.name}`}
        >
          <View style={styles.lineSheetThumb}>
            {uri ? (
              <ExpoImage
                source={{ uri }}
                style={styles.lineSheetThumbImage}
                contentFit={contentFit}
                transition={120}
                cachePolicy="memory-disk"
                recyclingKey={`overview-${item.id}`}
              />
            ) : (
              <Ionicons name="shirt-outline" size={16} color={colors.mutedForeground} />
            )}
          </View>
          <View style={styles.lineSheetCopy}>
            <Text style={styles.lineSheetCategory} numberOfLines={1}>
              {categoryLabel(item.category)}
            </Text>
            <Text style={styles.lineSheetName} numberOfLines={1}>
              {item.name}
            </Text>
            {pieceTip(pieceNotes, item.id) ? (
              <Text style={styles.lineSheetTip} numberOfLines={2}>
                {pieceTip(pieceNotes, item.id)}
              </Text>
            ) : null}
          </View>
          <Pressable
            style={styles.lineSheetSwapBtn}
            onPress={() => onSwapItem(item.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Swap ${categoryLabel(item.category)}`}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.mutedForeground} />
          </Pressable>
        </Pressable>
      ))}

      <Pressable
        style={[styles.lineSheetRow, styles.lineSheetAddRow]}
        onPress={onAddItem}
        accessibilityRole="button"
        accessibilityLabel="Add an item from your wardrobe"
      >
        <View style={[styles.lineSheetThumb, styles.lineSheetAddThumb]}>
          <Ionicons name="add" size={18} color={colors.primary} />
        </View>
        <View style={styles.lineSheetCopy}>
          <Text style={styles.lineSheetCategory} numberOfLines={1}>
            Add a piece
          </Text>
          <Text style={styles.lineSheetName} numberOfLines={1}>
            From your wardrobe
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

type OutfitSuggestionCardProps = {
  messageText: string;
  lookName?: string;
  itemIds: number[];
  allItems: Item[];
  createOutfit: ReturnType<typeof useCreateOutfit>;
  eventContext?: EventContext;
  eventPlan?: StylistEventPlanData | null;
  onAddToEvent?: (itemIds: number[], eventPlan?: StylistEventPlanData | null) => Promise<unknown>;
  recId?: number;
  isPlaying?: boolean;
  onToggleAudio?: () => void;
  onNavigateToCloset?: (outfitId: number) => void;
  /** Offered only once the look exists in the closet — boards reference real outfit ids. */
  onSaveToBoard?: (ref: BoardEntryRef) => void;
  /** Per-piece wearing tips; a swapped-in piece simply has none. */
  pieceNotes?: StylistPieceNote[];
  stylingMoves?: string[];
};

export function OutfitSuggestionCard({
  messageText,
  lookName,
  itemIds,
  allItems,
  createOutfit,
  eventContext,
  eventPlan,
  onAddToEvent,
  recId,
  isPlaying,
  onToggleAudio,
  onNavigateToCloset,
  onSaveToBoard,
  pieceNotes,
  stylingMoves,
}: OutfitSuggestionCardProps) {
  const [saved, setSaved] = useStylistCardState('outfit-saved', false);
  const [saving, setSaving] = useState(false);
  const [unsaving, setUnsaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savedOutfitId, setSavedOutfitId] = useStylistCardState<number | null>('outfit-id', null);
  const [wornToday, setWornToday] = useStylistCardState('outfit-worn-today', false);
  const markWorn = useMarkOutfitWorn();
  const [activeEventPlan, setActiveEventPlan] = useState<StylistEventPlanData | null>(eventPlan ?? null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  // When the user taps 👎 we reveal reason chips before finalizing — a labeled
  // rejection is a much stronger learning signal than a bare thumbs-down.
  const [choosingReason, setChoosingReason] = useState(false);

  // Local, editable copy of the suggested item set. Edits stay local until the
  // user taps "Save outfit", which persists whatever set is current.
  const [editedIds, setEditedIds] = useStylistCardState<number[]>('outfit-items', itemIds);
  // Reset when the underlying suggestion changes (keyed on a stable join).
  const itemIdsKey = itemIds.join(',');
  const initialItemsKey = useRef(itemIdsKey);
  useEffect(() => {
    if (initialItemsKey.current !== itemIdsKey) {
      setEditedIds(itemIds);
      initialItemsKey.current = itemIdsKey;
    }
    setActiveEventPlan(eventPlan ?? null);
    setAdded(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdsKey, eventPlan]);

  const [picker, setPicker] = useState<'add' | { swapId: number } | null>(null);
  const generateEventPlan = useGenerateEventOutfitPlan();
  const deleteOutfit = useDeleteOutfit();
  const currentMessageText = activeEventPlan?.stylistNotes ?? messageText;
  const currentLookName = activeEventPlan?.outfitName ?? lookName;

  const matchedItems = useMemo(
    () => editedIds.map((id) => allItems.find((i) => i.id === id)).filter((i): i is Item => !!i),
    [editedIds, allItems],
  );
  const lookTitle = currentLookName?.trim() || outfitNameFromItems(matchedItems);

  // Hero collage: card spans the list width, so derive the collage size from the
  // window minus the list and card padding. At that size the collage renders in
  // its editorial matted mode. Category order puts the dominant tile on the top.
  const { width: windowWidth } = useWindowDimensions();
  const collageSize = windowWidth - spacing.md * 2 - spacing.md * 2;
  const collageSlots = useMemo(
    () =>
      [...matchedItems]
        .sort(
          (a, b) =>
            OUTFIT_CATEGORY_ORDER.indexOf(a.category ?? '') - OUTFIT_CATEGORY_ORDER.indexOf(b.category ?? ''),
        )
        .map((item) => ({
          key: String(item.id),
          uri: itemImageUri(item),
          contentFit: itemImageContentFit(item),
        })),
    [matchedItems],
  );
  // Event planning keeps one filled decision CTA; regeneration and saving for
  // later share the quiet utility row beneath it.
  const hasEventCta = !!(onAddToEvent && eventContext);

  // ── Edit handlers (clear the saved/added flags so the refined look can be re-saved) ──
  const swapItem = useCallback((oldId: number, newItem: Item) => {
    setEditedIds((ids) => ids.map((x) => (x === oldId ? newItem.id : x)));
    setSaved(false);
    setAdded(false);
    if (oldId === newItem.id) return;
    // The piece taken out becomes a taste signal the stylist sees on later turns.
    api.post('/api/stylist/feedback', {
      itemIds: [newItem.id],
      source: 'outfit_card_swap',
      swap: { outItemId: oldId, inItemId: newItem.id },
      ...(recId ? { recId } : {}),
    }).catch(() => {});
  }, [recId]);
  const addItem = useCallback((newItem: Item) => {
    setEditedIds((ids) => (ids.includes(newItem.id) ? ids : [...ids, newItem.id]));
    setSaved(false);
    setAdded(false);
  }, []);

  // ── Picker candidate pool ────────────────────────────────────────────────
  const swapTarget = picker && picker !== 'add'
    ? allItems.find((i) => i.id === picker.swapId) ?? null
    : null;
  const pickerItems = useMemo(() => {
    if (!picker) return [];
    if (picker === 'add') {
      return allItems.filter((i) => !editedIds.includes(i.id));
    }
    const targetCategory = swapTarget?.category ?? null;
    return allItems.filter(
      (i) => i.category === targetCategory && (i.id === picker.swapId || !editedIds.includes(i.id)),
    );
  }, [picker, allItems, editedIds, swapTarget]);
  const pickerTitle = picker === 'add'
    ? 'Add an item'
    : `Swap ${(swapTarget?.category ?? 'item').replace(/_/g, ' ')}`;

  function handlePickerSelect(item: Item) {
    if (picker === 'add') addItem(item);
    else if (picker) swapItem(picker.swapId, item);
  }

  function recordStylistFeedback(metadata: Omit<StylistFeedbackMetadata, 'itemIds'>) {
    api.post('/api/stylist/feedback', {
      itemIds: editedIds,
      source: 'outfit_card',
      ...(recId ? { recId } : {}),
      ...(eventContext?.id ? { eventId: eventContext.id } : {}),
      ...metadata,
    }).catch(() => {});
  }

  async function handleSave(): Promise<number | null> {
    if (saved) return savedOutfitId;
    if (saving || matchedItems.length === 0) return null;
    setSaving(true);
    try {
      const input: CreateOutfitInput = {
        name: currentLookName?.trim() || outfitNameFromItems(matchedItems),
        description: currentMessageText.slice(0, 200) || null,
        stylistReady: true,
        itemIds: matchedItems.map((i) => ({ id: i.id, category: i.category as string })),
      };
      const outfit = await createOutfit.mutateAsync(input);
      setSavedOutfitId(outfit.id);
      setSaved(true);
      recordStylistFeedback({ rating: 'up', signal: 'saved' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return outfit.id;
    } catch {
      // Error alert handled by the mutation
      return null;
    } finally {
      setSaving(false);
    }
  }

  // Logging a wear needs a real outfit, so an unsaved look is saved first.
  // The wear feeds wear counts, idle/pairs hints and the stylist's learning.
  async function handleWoreToday() {
    if (wornToday || markWorn.isPending) return;
    const outfitId = await handleSave();
    if (outfitId == null) return;
    try {
      await markWorn.mutateAsync(outfitId);
      setWornToday(true);
      recordStylistFeedback({ rating: 'up', signal: 'worn_later' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Error alert and optimistic rollback are handled by the mutation.
    }
  }

  async function handleSaveToggle() {
    if (!saved) {
      await handleSave();
      return;
    }
    if (unsaving || savedOutfitId == null) return;

    setUnsaving(true);
    try {
      await deleteOutfit.mutateAsync(savedOutfitId);
      setSaved(false);
      setSavedOutfitId(null);
      Haptics.selectionAsync().catch(() => {});
    } catch {
      // Error alert and optimistic cache rollback are handled by the mutation.
    } finally {
      setUnsaving(false);
    }
  }

  async function handleAddToEvent() {
    if (!onAddToEvent || added || adding || matchedItems.length === 0) return;
    setAdding(true);
    try {
      // Persist the refined set (editedIds), matching what feedback/save use.
      const ids = matchedItems.map((i) => i.id);
      const planIsUnedited = !!activeEventPlan
        && ids.length === activeEventPlan.itemIds.length
        && ids.every((id, index) => id === activeEventPlan.itemIds[index]);
      const result = await onAddToEvent(ids, planIsUnedited ? activeEventPlan : null);
      if (typeof result === 'object' && result !== null && 'outfitId' in result) {
        const outfitId = (result as { outfitId?: unknown }).outfitId;
        if (typeof outfitId === 'number') setSavedOutfitId(outfitId);
      }
      setAdded(true);
      recordStylistFeedback({ rating: 'up', signal: 'accepted_for_event' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Error alert handled by the mutation
    } finally {
      setAdding(false);
    }
  }

  async function handleTryAnother() {
    if (!eventContext || generateEventPlan.isPending) return;
    try {
      const next = await generateEventPlan.mutateAsync({
        eventId: eventContext.id,
        ...(activeEventPlan?.candidateId ? { previousCandidateId: activeEventPlan.candidateId } : {}),
      });
      setActiveEventPlan(next);
      setEditedIds(next.itemIds);
      setSaved(false);
      setSavedOutfitId(null);
      setAdded(false);
      Haptics.selectionAsync().catch(() => {});
    } catch {
      // The mutation presents its own error alert.
    }
  }

  function handleFeedback(rating: 'up' | 'down') {
    if (feedback) return;
    if (rating === 'down') {
      // Don't finalize yet — let the user say why.
      setChoosingReason(true);
      return;
    }
    setFeedback('up');
    recordStylistFeedback({ rating: 'up', signal: 'up' });
  }

  function submitDownFeedback(reason?: StylistNegativeReason, reasonLabel?: string) {
    if (feedback) return;
    setFeedback('down');
    setChoosingReason(false);
    recordStylistFeedback({
      rating: 'down',
      ...(reason ? { reason } : {}),
      ...(reasonLabel ? { reasonLabel } : {}),
    });
  }

  return (
    <View style={styles.outfitCard}>
      <View style={styles.lookHeader}>
        <View style={styles.lookHeaderTop}>
          <View style={styles.sectionEyebrow}>
            <Text style={styles.sectionEyebrowText}>The look</Text>
          </View>
          <View style={styles.headerCardActions}>
            {onToggleAudio ? (
              <TouchableOpacity
                style={[styles.headerIconBtn, isPlaying && styles.headerIconBtnActive]}
                onPress={onToggleAudio}
                accessibilityRole="button"
                accessibilityLabel="Read styling notes aloud"
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isPlaying ? 'pause-circle-outline' : 'volume-medium-outline'}
                  size={17}
                  color={isPlaying ? colors.primary : colors.mutedForeground}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.headerIconBtn, feedback === 'up' && styles.headerIconBtnActive]}
              onPress={() => handleFeedback('up')}
              disabled={!!feedback}
              accessibilityRole="button"
              accessibilityLabel="This outfit works for me"
              activeOpacity={0.7}
            >
              <Ionicons
                name="thumbs-up-outline"
                size={15}
                color={feedback === 'up' ? colors.primary : colors.mutedForeground}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                (feedback === 'down' || choosingReason) && styles.headerIconBtnActive,
              ]}
              onPress={() => handleFeedback('down')}
              disabled={!!feedback}
              accessibilityRole="button"
              accessibilityLabel="This outfit doesn't work for me"
              activeOpacity={0.7}
            >
              <Ionicons
                name="thumbs-down-outline"
                size={15}
                color={feedback === 'down' || choosingReason ? colors.primary : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.lookTitle} numberOfLines={2}>{lookTitle}</Text>
        <Text style={styles.lookMeta}>{matchedItems.length} pieces from your wardrobe</Text>
      </View>

      {collageSlots.length > 0 && (
        <ResolvedOutfitCollage
          slots={collageSlots}
          size={collageSize}
          height={Math.round(collageSize * 0.82)}
          borderRadius={radii.lg}
        />
      )}

      <View style={styles.stylistNoteBlock}>
        <Text style={styles.rationaleLabel}>Why it works</Text>
        <StylistRichText text={currentMessageText} />
      </View>

      {matchedItems.length > 0 && (
        <OutfitCompleteLookOverview
          items={matchedItems}
          pieceNotes={pieceNotes}
          onItemPress={setSelectedItem}
          onSwapItem={(itemId) => setPicker({ swapId: itemId })}
          onAddItem={() => setPicker('add')}
        />
      )}
      {stylingMoves?.length ? (
        <View style={styles.stylingMoves}>
          <StylingMovesStrip moves={stylingMoves} />
        </View>
      ) : null}

      {onAddToEvent && eventContext && (
        <View style={styles.eventActionGroup}>
          <TouchableOpacity
            style={[
              styles.addEventBtn,
              added && styles.addEventBtnDone,
              matchedItems.length === 0 && styles.saveBtnDisabled,
            ]}
            onPress={handleAddToEvent}
            disabled={added || adding || matchedItems.length === 0}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Add this outfit to ${eventContext.title}`}
          >
            <Ionicons
              name={added ? 'checkmark-circle' : 'calendar-outline'}
              size={16}
              color={colors.primaryForeground}
            />
            <Text style={styles.addEventBtnText} numberOfLines={1}>
              {adding ? 'Adding look…' : added ? 'Look added' : 'Use this look'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.eventActionMeta} numberOfLines={1}>
            {added ? 'On this event · Saved to Closet' : 'Assigns to this event · Saves to Closet'}
          </Text>
        </View>
      )}

      {hasEventCta && eventContext ? (
        <View style={styles.eventUtilityActions}>
          <TouchableOpacity
            style={styles.eventUtilityBtn}
            onPress={handleTryAnother}
            disabled={generateEventPlan.isPending || adding}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Try another outfit for ${eventContext.title}`}
          >
            <Ionicons name="refresh-outline" size={15} color={colors.primary} />
            <Text style={styles.eventUtilityText} numberOfLines={1}>
              {generateEventPlan.isPending ? 'Styling…' : 'Another look'}
            </Text>
          </TouchableOpacity>

          <View style={styles.eventUtilityDivider} />

          <TouchableOpacity
            style={styles.eventUtilityBtn}
            onPress={handleSaveToggle}
            disabled={added || saving || unsaving || matchedItems.length === 0}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={saved
              ? 'Remove this saved look from Closet'
              : 'Save this outfit to Closet without adding it to the event'}
            accessibilityState={{ selected: saved, busy: saving || unsaving }}
          >
            <Ionicons
              name={saved || added ? 'checkmark-circle' : 'bookmark-outline'}
              size={15}
              color={colors.primary}
            />
            <Text style={styles.eventUtilityText} numberOfLines={1}>
              {saving ? 'Saving…' : unsaving ? 'Removing…' : saved || added ? 'Saved' : 'Save for later'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.outfitCardActions}>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (saved || saving) && styles.saveBtnDone,
              matchedItems.length === 0 && styles.saveBtnDisabled,
            ]}
            onPress={handleSaveToggle}
            // A worn look is in the wear log; unsaving would delete that history.
            disabled={saving || unsaving || matchedItems.length === 0 || (saved && wornToday)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove this saved outfit from Closet' : 'Save this outfit to Closet'}
            accessibilityState={{ selected: saved, busy: saving || unsaving }}
          >
            <Ionicons
              name={saved ? 'checkmark-circle' : 'bookmark-outline'}
              size={15}
              color={colors.white}
            />
            <Text style={styles.saveBtnText} numberOfLines={1}>
              {saving ? 'Saving…' : unsaving ? 'Removing…' : saved ? 'Saved to Closet → Outfits' : 'Save outfit'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.woreBtn, wornToday && styles.woreBtnDone]}
            onPress={handleWoreToday}
            disabled={wornToday || saving || unsaving || markWorn.isPending || matchedItems.length === 0}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={wornToday ? 'Logged as worn today' : 'Log this outfit as worn today'}
            accessibilityState={{ selected: wornToday, busy: markWorn.isPending }}
          >
            <Ionicons name={wornToday ? 'checkmark-circle' : 'calendar-outline'} size={15} color={colors.primary} />
            <Text style={styles.woreBtnText} numberOfLines={1}>
              {markWorn.isPending ? 'Logging…' : wornToday ? 'Worn today' : 'Wore it'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {savedOutfitId != null ? (
        <View style={styles.savedOutfitActions}>
          <TouchableOpacity
            style={styles.viewClosetBtn}
            onPress={() => onNavigateToCloset?.(savedOutfitId)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="View saved outfit in Closet"
          >
            <Text style={styles.viewClosetText}>View outfit</Text>
            <Ionicons name="arrow-forward-outline" size={15} color={colors.primary} />
          </TouchableOpacity>
          {onSaveToBoard && (
            <TouchableOpacity
              style={styles.viewClosetBtn}
              onPress={() => onSaveToBoard({ type: 'outfit', id: savedOutfitId })}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Save this outfit to a board"
            >
              <Ionicons name="albums-outline" size={15} color={colors.primary} />
              <Text style={styles.viewClosetText}>Save to board</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {choosingReason && !feedback && (
        <View style={styles.reasonChips}>
          {STYLIST_NEGATIVE_REASON_CHIPS.map((reason) => (
            <TouchableOpacity
              key={reason.value}
              style={styles.reasonChip}
              onPress={() => submitDownFeedback(reason.value, reason.label)}
              activeOpacity={0.7}
            >
              <Text style={styles.reasonChipText}>{reason.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.reasonChip}
            onPress={() => submitDownFeedback('just_not_it', 'Just not it')}
            activeOpacity={0.7}
          >
            <Text style={styles.reasonChipText}>Just not it</Text>
          </TouchableOpacity>
        </View>
      )}

      <ItemDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />

      <ItemPickerSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={pickerTitle}
        items={pickerItems}
        selectedId={picker && picker !== 'add' ? picker.swapId : undefined}
        onSelect={handlePickerSelect}
      />
    </View>
  );
}
