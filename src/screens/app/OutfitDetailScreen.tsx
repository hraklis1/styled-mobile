import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { track } from '../../lib/analytics';
import { useOutfits, useDeleteOutfit, useMarkOutfitWorn, useVisualizeOutfit, useUpdateOutfit } from '../../hooks/useOutfits';
import { useItems } from '../../hooks/useItems';
import { OutfitHero } from '../../components/outfits/OutfitHero';
import { EditorialSection } from '../../components/primitives/Editorial';
import { PressableScale } from '../../components/primitives/PressableScale';
import { GarmentImage } from '../../components/wardrobe/garment-image';
import { getItemCardAccessibilityLabel } from '../../lib/closet-presentation';
import { CommonActions, usePreventRemove } from '@react-navigation/native';
import { colors, editorial, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS } from '../../types/item';
import type { OutfitDetailScreenProps } from '../../navigation/types';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { useEvents } from '../../hooks/useEvents';
import { useAssignOutfitEvents } from '../../hooks/useOutfits';
import { getUpcomingOutfitEvents, parseEventDate } from '../../lib/outfitAssignments';
import { OutfitEventAssignmentModal } from '../../components/outfits/OutfitEventAssignmentModal';
import { TabQuickMenuSheet, type TabQuickMenuOption } from '../../components/navigation/TabQuickMenuSheet';
import { SaveToBoardSheet } from '../../components/boards/SaveToBoardSheet';
import { useEntitlement } from '../../hooks/useEntitlement';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function OutfitDetailScreen({ route, navigation }: OutfitDetailScreenProps) {
  const { outfitId, returnTo, returnToEventId, returnToEventDetail } = route.params;
  const { data: outfits = [] } = useOutfits();
  const { data: items = [] } = useItems();
  const { data: events = [] } = useEvents();
  const outfit = outfits.find((o) => o.id === outfitId);

  const deleteOutfit = useDeleteOutfit();
  const markWorn = useMarkOutfitWorn();
  const visualize = useVisualizeOutfit();
  const updateOutfit = useUpdateOutfit();
  const assignEvents = useAssignOutfitEvents();
  const { openStylist } = useGlobalAIStylist();
  const { costOf } = useEntitlement();

  const [localName, setLocalName] = useState(outfit?.name ?? '');
  const [localNotes, setLocalNotes] = useState(outfit?.notes ?? '');
  const [localTags, setLocalTags] = useState<string[]>(outfit?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [tagInputActive, setTagInputActive] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [eventPickerVisible, setEventPickerVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [returningToTab, setReturningToTab] = useState(false);

  // Opened from another tab (Calendar/Home): swiping or backing out should land on
  // that tab, not on the Closet tab this screen happens to live in.
  usePreventRemove(returnTo != null && !returningToTab, () => {
    setReturningToTab(true);
  });

  useEffect(() => {
    if (!returningToTab || !returnTo) return;
    const timeout = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'ClosetMain' }] });
      navigation.dispatch(CommonActions.navigate({
        name: returnTo,
        params: returnTo === 'Calendar' && returnToEventId != null
          ? { eventId: returnToEventId, openDetail: returnToEventDetail }
          : undefined,
      }));
    }, 0);
    return () => clearTimeout(timeout);
  }, [navigation, returningToTab, returnTo, returnToEventId, returnToEventDetail]);

  useEffect(() => {
    if (outfit) {
      setLocalName(outfit.name);
      setLocalNotes(outfit.notes ?? '');
      setLocalTags(outfit.tags ?? []);
    }
  }, [outfit?.id]);

  useEffect(() => {
    if (outfitId) track('outfit_viewed', { outfit_id: outfitId });
  }, [outfitId]);

  const addTag = useCallback((raw: string) => {
    if (!outfit) return;
    const tag = raw.trim().toLowerCase();
    if (!tag || localTags.includes(tag)) {
      setTagDraft('');
      return;
    }
    const next = [...localTags, tag];
    setLocalTags(next);
    setTagDraft('');
    updateOutfit.mutate({ id: outfit.id, tags: next });
  }, [localTags, outfit, updateOutfit]);

  const removeTag = useCallback((tag: string) => {
    if (!outfit) return;
    const next = localTags.filter(t => t !== tag);
    setLocalTags(next);
    updateOutfit.mutate({ id: outfit.id, tags: next });
  }, [localTags, outfit, updateOutfit]);

  const [notesSaved, setNotesSaved] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<TextInput>(null);
  const tagInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const saveName = useCallback(() => {
    if (!outfit) return;
    const trimmed = localName.trim();
    if (!trimmed || trimmed === outfit.name) return;
    updateOutfit.mutate({ id: outfit.id, name: trimmed });
  }, [localName, outfit, updateOutfit]);

  const beginRename = useCallback(() => setIsNameFocused(true), []);

  const saveNotes = useCallback(() => {
    if (!outfit) return;
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    updateOutfit.mutate(
      { id: outfit.id, notes: localNotes.trim() || null },
      {
        onSuccess: () => {
          notesInputRef.current?.blur();
          setNotesExpanded(false);
          setNotesSaved(true);
          savedTimerRef.current = setTimeout(() => setNotesSaved(false), 2000);
        },
      }
    );
  }, [localNotes, outfit, updateOutfit]);

  const { width } = useWindowDimensions();

  // Four pieces — the common case — then fit one clean row; 5+ wrap left-aligned.
  const { tileWidth, tileHeight } = useMemo(() => {
    const w = Math.floor(
      (width - spacing.lg * 2 - PIECE_GAP * (PIECE_COLUMNS - 1)) / PIECE_COLUMNS,
    );
    return { tileWidth: w, tileHeight: Math.round(w / editorial.garmentAspectRatio) };
  }, [width]);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const pieces = useMemo(() => {
    if (!outfit) return [];
    return (outfit.itemIds ?? []).map((e) => ({
      entry: e,
      item: itemMap.get(e.id) ?? null,
    }));
  }, [outfit, itemMap]);

  const hasDeletedPieces = pieces.some((p) => p.item === null);
  const upcomingEvents = useMemo(
    () => getUpcomingOutfitEvents(events, outfitId),
    [events, outfitId],
  );

  if (!outfit) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isBusy = deleteOutfit.isPending || markWorn.isPending;
  const handleMarkWorn = () => markWorn.mutate(outfit.id);
  const toggleFavourite = () => {
    updateOutfit.mutate({ id: outfit.id, isFavorite: !outfit.isFavorite });
  };
  const favouriteLabel = outfit.isFavorite ? 'Remove from favourites' : 'Add to favourites';

  const handleGenerate = (force = false) => {
    if (!force) {
      visualize.mutate({ id: outfit.id, force });
      return;
    }
    const cost = costOf('flatlay');
    Alert.alert(
      'Regenerate flat-lay?',
      cost > 0
        ? `This uses ${cost} credit${cost === 1 ? '' : 's'} to generate a new version.`
        : 'This will generate a new version.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: () => visualize.mutate({ id: outfit.id, force }) },
      ],
    );
  };

  // When OutfitDetail is the only screen in the ClosetStack (opened from the Home tab),
  // goBack() would bubble up to the tab navigator and go to Home — but leave OutfitDetail
  // at the top of the ClosetStack. Reset to ClosetMain first so the Closet tab is clean.
  const handleBack = () => {
    if (returnTo) {
      setReturningToTab(true);
      return;
    }
    const { routes } = navigation.getState();
    if (routes.length > 1) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'ClosetMain' }] });
      navigation.dispatch(CommonActions.navigate({ name: 'Home' }));
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete outfit',
      `Delete "${outfit.name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteOutfit.mutate(outfit.id);
            handleBack();
          },
        },
      ]
    );
  };

  // Favourite and Save-to-board live in the utility row now, so this is down to
  // renaming and deleting.
  const outfitMenuOptions: TabQuickMenuOption[] = [
    {
      key: 'rename',
      label: 'Rename outfit',
      icon: 'pencil-outline',
      onPress: beginRename,
    },
    {
      key: 'delete',
      label: 'Delete outfit',
      icon: 'trash-outline',
      tone: 'destructive',
      onPress: handleDelete,
    },
  ];

  const openOutfitMenu = () => {
    if (isBusy || updateOutfit.isPending) return;
    Keyboard.dismiss();
    setMenuOpen(true);
  };

  const hasAiImage = !!outfit.aiGeneratedImageUrl;

  const metaLine = [
    outfit.wearCount > 0
      ? `Worn ${outfit.wearCount} ${outfit.wearCount === 1 ? 'time' : 'times'}`
      : 'Never worn',
    outfit.lastWornAt ? `Last worn ${formatDate(outfit.lastWornAt)}` : null,
    pieces.length > 0
      ? `${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}`
      : null,
  ].filter(Boolean).join(' · ');

  const storedNotes = outfit.notes ?? '';
  const notesDirty = localNotes.trim() !== storedNotes;
  const hasNotes = storedNotes.trim().length > 0;

  const savedBadge = notesSaved ? (
    <View style={styles.notesSavedBadge}>
      <Ionicons name="checkmark" size={13} color={colors.primary} />
      <Text style={styles.notesSavedText}>Saved</Text>
    </View>
  ) : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <OutfitHero
          outfit={outfit}
          width={width}
          hasAiImage={hasAiImage}
          isGenerating={visualize.isPending}
          menuDisabled={isBusy || updateOutfit.isPending}
          menuOpen={menuOpen}
          onBack={handleBack}
          onMenu={openOutfitMenu}
          onGenerate={() => handleGenerate(hasAiImage)}
        />

        {visualize.isError && (
          <View style={styles.errorRow} accessibilityLiveRegion="polite">
            <Text style={styles.generateErrorText} numberOfLines={2}>
              {(visualize.error as any)?.response?.data?.message ?? 'Generation failed'}
            </Text>
            <TouchableOpacity
              onPress={() => handleGenerate(hasAiImage)}
              accessibilityRole="button"
              accessibilityLabel="Retry flat-lay generation"
            >
              <Text style={styles.retryLabel}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Title ── */}
        <View style={styles.header}>
          {/*
            Renaming lives in the ⋯ menu, so the title carries no edit affordance
            of its own. A read-only Text wraps a long name; a TextInput would clip
            it. The input only mounts while editing, so autoFocus is race-free.
          */}
          <View style={[styles.nameRow, isNameFocused && styles.nameRowFocused]}>
            {isNameFocused ? (
              <TextInput
                ref={nameInputRef}
                style={styles.name}
                value={localName}
                onChangeText={setLocalName}
                onBlur={() => { setIsNameFocused(false); saveName(); }}
                onSubmitEditing={saveName}
                returnKeyType="done"
                autoCapitalize="words"
                autoFocus
                accessibilityLabel="Outfit name"
              />
            ) : (
              <Text style={styles.name}>{localName}</Text>
            )}
          </View>
          <Text style={styles.nameMeta}>{metaLine}</Text>
        </View>

        {/* ── Primary action ── */}
        <PressableScale
          style={styles.stylistButton}
          contentStyle={styles.stylistButtonSurface}
          onPress={() => openStylist({
            initialQuery: `How can I improve my "${outfit.name}" outfit?`,
            source: 'outfit_detail',
            onNavigateToCloset: (outfitId) => navigation.navigate('OutfitDetail', { outfitId }),
            context: {
              kind: 'outfit',
              outfitId: outfit.id,
              name: outfit.name,
              itemIds: (outfit.itemIds ?? []).map((entry) => entry.id),
            },
          })}
          accessibilityRole="button"
          accessibilityLabel={`Get styling advice for ${outfit.name}`}
        >
          <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
          <Text style={styles.stylistButtonText}>Ask stylist</Text>
        </PressableScale>

        {/* ── Wardrobe utilities ── */}
        <View style={styles.utilityRow}>
          <PressableScale
            style={styles.utilityButton}
            contentStyle={[styles.utilityButtonSurface, markWorn.isPending && styles.actionDisabled]}
            onPress={handleMarkWorn}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${outfit.name} as worn today`}
            accessibilityState={{ disabled: isBusy, busy: markWorn.isPending }}
          >
            {markWorn.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
            )}
            <Text style={styles.utilityLabel}>Worn today</Text>
          </PressableScale>
          <View style={styles.utilityDivider} />
          <PressableScale
            style={styles.utilityButton}
            contentStyle={[styles.utilityButtonSurface, updateOutfit.isPending && styles.actionDisabled]}
            onPress={toggleFavourite}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={favouriteLabel}
            accessibilityState={{ selected: outfit.isFavorite, disabled: isBusy }}
          >
            <Ionicons
              name={outfit.isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={outfit.isFavorite ? colors.primary : colors.foreground}
            />
            <Text style={styles.utilityLabel}>{outfit.isFavorite ? 'Favourited' : 'Favourite'}</Text>
          </PressableScale>
          <View style={styles.utilityDivider} />
          <PressableScale
            style={styles.utilityButton}
            contentStyle={[styles.utilityButtonSurface, isBusy && styles.actionDisabled]}
            onPress={() => { Keyboard.dismiss(); setSaveSheetOpen(true); }}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={`Add ${outfit.name} to a board`}
            accessibilityState={{ disabled: isBusy }}
          >
            <Ionicons name="bookmark-outline" size={20} color={colors.foreground} />
            <Text style={styles.utilityLabel}>Board</Text>
          </PressableScale>
        </View>

        {/* ── Pieces ── */}
        {pieces.length > 0 && (
          <EditorialSection
            title={`Pieces (${pieces.length})`}
            variant="ruled"
            style={styles.section}
          >
            <View style={styles.piecesGrid}>
              {pieces.map(({ entry, item }) => {
                if (!item) {
                  const categoryLabel =
                    CATEGORY_LABELS[entry.category as keyof typeof CATEGORY_LABELS] ?? entry.category;
                  return (
                    <View
                      key={`deleted-${entry.id}`}
                      style={[styles.pieceItem, styles.pieceGhost, { width: tileWidth }]}
                      accessibilityLabel={`Deleted piece, ${categoryLabel}`}
                    >
                      <View
                        style={[styles.pieceGhostFrame, { width: tileWidth, height: tileHeight }]}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.mutedForeground} />
                      </View>
                      <Text style={[styles.pieceName, styles.pieceGhostText]} numberOfLines={1}>Deleted</Text>
                      <Text style={styles.pieceCategory} numberOfLines={1}>{categoryLabel}</Text>
                    </View>
                  );
                }
                return (
                  <PressableScale
                    key={item.id}
                    style={[styles.pieceItem, { width: tileWidth }]}
                    onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
                    accessibilityRole="button"
                    accessibilityLabel={getItemCardAccessibilityLabel(item)}
                  >
                    <GarmentImage
                      item={item}
                      width={tileWidth}
                      height={tileHeight}
                      borderRadius={radii.md}
                      placeholderIconSize={20}
                    />
                    <Text style={styles.pieceName} numberOfLines={1}>{item.name}</Text>
                    {item.category ? (
                      <Text style={styles.pieceCategory} numberOfLines={1}>
                        {CATEGORY_LABELS[item.category]}
                      </Text>
                    ) : null}
                  </PressableScale>
                );
              })}
            </View>
            {hasDeletedPieces && (
              <TouchableOpacity
                style={styles.clearDeletedBtn}
                onPress={() => {
                  const validIds = pieces.filter((p) => p.item).map((p) => p.entry);
                  updateOutfit.mutate({ id: outfit.id, itemIds: validIds });
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Clear deleted items from this outfit"
              >
                <Ionicons name="trash-outline" size={13} color={colors.mutedForeground} />
                <Text style={styles.clearDeletedText}>Clear deleted items</Text>
              </TouchableOpacity>
            )}
          </EditorialSection>
        )}

        {/* ── Upcoming events ── */}
        {upcomingEvents.length === 0 ? (
          <TouchableOpacity
            style={styles.compactRow}
            onPress={() => setEventPickerVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Add ${outfit.name} to an upcoming event`}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.mutedForeground} />
            <Text style={styles.compactRowLabel}>Add to an event</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <EditorialSection
            title="Upcoming events"
            variant="ruled"
            style={styles.section}
            actionLabel="Add to events"
            onAction={() => setEventPickerVisible(true)}
          >
            {upcomingEvents.map((event, index) => (
              <View
                key={event.id}
                style={[
                  styles.assignedEventRow,
                  // The next section supplies the closing rule.
                  index < upcomingEvents.length - 1 && styles.assignedEventRowBorder,
                ]}
              >
                <View style={styles.assignedEventIcon}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                </View>
                <View style={styles.assignedEventBody}>
                  <Text style={styles.assignedEventTitle}>{event.title}</Text>
                  <Text style={styles.assignedEventMeta}>
                    {parseEventDate(event.date).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {event.location ? ` · ${event.location}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => assignEvents.mutate({
                    outfitId: outfit.id,
                    eventIds: upcomingEvents.filter((entry) => entry.id !== event.id).map((entry) => entry.id),
                  })}
                  disabled={assignEvents.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${outfit.name} from ${event.title}`}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ))}
          </EditorialSection>
        )}

        {/* ── Tags ── */}
        {localTags.length > 0 || tagInputActive ? (
          <EditorialSection title="Tags" variant="ruled" style={styles.section}>
            <View style={styles.chipRow}>
              {localTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tagChip}
                  onPress={() => removeTag(tag)}
                  activeOpacity={0.7}
                  disabled={updateOutfit.isPending}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove tag ${tag}`}
                  accessibilityState={{ disabled: updateOutfit.isPending }}
                >
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <Ionicons name="close" size={11} color={colors.mutedForeground} style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              ))}
              {tagInputActive ? (
                <TextInput
                  ref={tagInputRef}
                  style={styles.inlineTagInput}
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  onSubmitEditing={() => addTag(tagDraft)}
                  onBlur={() => { addTag(tagDraft); setTagInputActive(false); }}
                  placeholder="e.g. summer"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                  blurOnSubmit={false}
                  maxLength={40}
                  autoCapitalize="none"
                  returnKeyType="done"
                  accessibilityLabel="New tag name"
                />
              ) : (
                <TouchableOpacity
                  style={styles.addTagButton}
                  onPress={() => setTagInputActive(true)}
                  activeOpacity={0.7}
                  disabled={updateOutfit.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Add tag"
                  accessibilityState={{ disabled: updateOutfit.isPending }}
                >
                  <Ionicons name="add" size={14} color={colors.primary} />
                  <Text style={styles.addTagText}>Add tag</Text>
                </TouchableOpacity>
              )}
            </View>
          </EditorialSection>
        ) : (
          <TouchableOpacity
            style={styles.compactRow}
            onPress={() => setTagInputActive(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add tags to this outfit"
          >
            <Ionicons name="pricetag-outline" size={18} color={colors.mutedForeground} />
            <Text style={styles.compactRowLabel}>Add tags</Text>
            <Ionicons name="add" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {/* ── Notes ── */}
        {notesExpanded || hasNotes ? (
          <EditorialSection
            title="Notes"
            variant="ruled"
            style={styles.section}
            trailing={savedBadge ?? (!notesExpanded ? (
              <TouchableOpacity
                onPress={() => setNotesExpanded(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Edit styling notes"
              >
                <Ionicons name="pencil-outline" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null)}
          >
            {notesExpanded ? (
              <>
                <TextInput
                  ref={notesInputRef}
                  style={styles.notesTextArea}
                  value={localNotes}
                  onChangeText={setLocalNotes}
                  placeholder="Add styling notes, reminders, or outfit inspiration…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                  autoCapitalize="sentences"
                  accessibilityLabel="Styling notes"
                  onBlur={() => {
                    // Blur-to-save mirrors the name field, so tapping away can
                    // never strand an unsaved draft in a collapsed section.
                    if (notesDirty) saveNotes();
                    else setNotesExpanded(false);
                  }}
                />
                {notesDirty && (
                  <View style={styles.notesFooter}>
                    <TouchableOpacity
                      style={[styles.notesSaveBtn, updateOutfit.isPending && styles.actionDisabled]}
                      onPress={saveNotes}
                      disabled={updateOutfit.isPending}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Save styling notes"
                    >
                      <Text style={styles.notesSaveBtnLabel}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <TouchableOpacity
                onPress={() => setNotesExpanded(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Edit styling notes"
              >
                <Text style={styles.notesText} numberOfLines={4}>{storedNotes}</Text>
              </TouchableOpacity>
            )}
          </EditorialSection>
        ) : (
          <TouchableOpacity
            style={styles.compactRow}
            onPress={() => setNotesExpanded(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add styling notes"
          >
            <Ionicons name="create-outline" size={18} color={colors.mutedForeground} />
            <Text style={styles.compactRowLabel}>Add styling notes</Text>
            {savedBadge ?? <Ionicons name="add" size={18} color={colors.mutedForeground} />}
          </TouchableOpacity>
        )}
      </ScrollView>
      <TabQuickMenuSheet
        visible={menuOpen}
        title="Outfit options"
        subtitle={outfit.name}
        options={outfitMenuOptions}
        onClose={() => setMenuOpen(false)}
      />
      <OutfitEventAssignmentModal
        outfit={outfit}
        outfits={outfits}
        events={events}
        visible={eventPickerVisible}
        onClose={() => setEventPickerVisible(false)}
      />
      {saveSheetOpen && (
        <SaveToBoardSheet
          target={{ type: 'outfit', id: outfitId }}
          onClose={() => setSaveSheetOpen(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const PIECE_COLUMNS = 4;
const PIECE_GAP = spacing.sm;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The raised Stylist tab button overhangs its bar by 14pt at the centre.
  scrollContent: { paddingBottom: spacing.xxxl + 14 },
  section: { marginHorizontal: spacing.lg },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 20,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  generateErrorText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.error,
  },
  retryLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },

  // ── Header / Title ──
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: 1.5,
    borderBottomColor: 'transparent',
    paddingBottom: 2,
  },
  nameRowFocused: {
    borderBottomColor: colors.primary,
  },
  name: {
    flex: 1,
    fontFamily: typography.family.display,
    fontSize: typography.size.xxl,
    lineHeight: 34,
    fontWeight: typography.weight.regular,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  nameMeta: {
    marginTop: spacing.xs,
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.inkSubtle,
  },

  // ── Primary action ──
  stylistButton: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  stylistButtonSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    borderCurve: 'continuous',
  },
  stylistButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },

  // ── Wardrobe utilities ──
  // No bottom rule: the ruled section that follows always supplies its own top
  // hairline, and two of them 8pt apart read as a double line.
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    minHeight: 68,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  utilityButton: { flex: 1 },
  utilityButtonSurface: {
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  utilityDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: colors.border,
  },
  utilityLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  actionDisabled: { opacity: 0.5 },

  // ── Collapsed section rows ──
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  compactRowLabel: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.foreground,
  },

  // ── Events ──
  assignedEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  assignedEventRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  assignedEventIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignedEventBody: { flex: 1, gap: 2 },
  assignedEventTitle: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  assignedEventMeta: { color: colors.mutedForeground, fontSize: typography.size.xs },

  // ── Pieces ──
  piecesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: PIECE_GAP,
    rowGap: spacing.md,
  },
  pieceItem: {
    alignItems: 'flex-start',
    gap: 6,
  },
  pieceName: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  pieceCategory: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  pieceGhost: {
    opacity: 0.5,
  },
  pieceGhostFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  pieceGhostText: {
    color: colors.mutedForeground,
  },
  clearDeletedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  clearDeletedText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },

  // ── Tags ──
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
  },
  tagChipText: {
    fontSize: typography.size.xs,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  inlineTagInput: {
    minHeight: 44,
    minWidth: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  addTagText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },

  // ── Notes ──
  notesText: {
    fontSize: typography.size.md,
    lineHeight: 23,
    color: colors.foreground,
  },
  notesTextArea: {
    fontSize: typography.size.md,
    color: colors.foreground,
    lineHeight: typography.size.md * 1.5,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  notesFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 36,
    marginTop: spacing.sm,
  },
  notesSaveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  notesSaveBtnLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  notesSavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notesSavedText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
});
