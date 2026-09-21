import { resolveShoppingSnapPrices } from '../../lib/shoppingPrices';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DraggablePhotoGrid } from './DraggablePhotoGrid';
import { AppText } from '../primitives/AppText';
import { ShoppingPhotoViewer } from './ShoppingPhotoViewer';
import { dismissOrganizerHint, isOrganizerHintDismissed } from '../../lib/shoppingOrganizerHint';
import { heroPieceLayout } from '../../lib/shoppingPieceLayout';
import { formatShoppingPrice, snapRoleLabel } from '../../lib/shoppingPresentation';
import {
  applySelection,
  moveSnapToStage,
  partitionKey,
  seedStages,
  selectionAction,
  splitStage,
  type ShoppingOrganizerStage,
} from '../../lib/shoppingOrganizerStages';
import {
  buildShoppingSnapOrganizationUpdates,
  type ShoppingSnapOrganizationUpdate,
} from '../../lib/shoppingSnapOrganizer';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingCaptureRole, ShoppingSnap } from '../../types/shoppingSnap';
import { SHORTLIST_COPY } from '../../lib/shoppingVocabulary';

const GRID_GAP = spacing.sm;
const DROP_ZONE_HEIGHT = 64;
const SAVE_BAR_HEIGHT = 80;

type Rect = { x: number; y: number; width: number; height: number };
/** Where a dragged photo would land if it were released right now. */
type DropTarget = { kind: 'stage'; stageId: string } | { kind: 'new' };

function nextRole(role: ShoppingCaptureRole): ShoppingCaptureRole {
  if (role === 'unknown') return 'garment';
  if (role === 'garment') return 'tag';
  return 'unknown';
}

function stagePrice(snaps: ShoppingSnap[], snapIds: string[], homeCurrency: string): string | null {
  const snapSet = new Set(snapIds);
  const price = resolveShoppingSnapPrices(snaps.filter((snap) => snapSet.has(snap.id)), homeCurrency);
  return formatShoppingPrice(price.amount, price.currencyCode)
    ?? (price.status === 'ambiguous' ? 'Confirm price' : null);
}

function containsPoint(rect: Rect | null, x: number, y: number): boolean {
  if (!rect) return false;
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function sameTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind !== 'stage' || b.kind !== 'stage' || a.stageId === b.stageId;
}

function pieceLayout(count: number, width: number) {
  return heroPieceLayout(count, width, GRID_GAP);
}

/**
 * The organizer always shows a complete partition of the photos — one section
 * per item, never a loose "unassigned" pool. Opening it on a visit therefore
 * shows the grouping the camera already produced, and the work is corrective.
 *
 * Each item is laid out as a garment with its paperwork: the first photo is
 * the hero plate, the tag and detail shots sit beside it. That is the shape
 * the shortlist tile will take, so what the shopper accepts here is what they
 * will see there.
 *
 * The gestures follow the phone's own photo grids, so none of them has to be
 * taught beyond a one-time hint: tap opens the photo full size, hold-and-
 * release starts selecting, hold-and-drag carries the photo into another item
 * or onto the new-item strip. Only once photos are selected does a toolbar
 * appear to pull them out or group them as one. Splitting an item into single
 * photos and removing a whole item live behind the item's own menu — the
 * blunt tools, out of the way until asked for.
 */
export function ShoppingPhotoOrganizer({
  snaps,
  onClose,
  onSave,
  isSaving,
  eyebrow = 'ORGANIZE',
  title = 'Group photos',
  titleIsPlaceholder = false,
  onPressTitle,
  subtitle,
  saveLabel = 'Save',
  countInSaveLabel = false,
  closeLabel = 'Cancel',
  onRemove,
}: {
  snaps: ShoppingSnap[];
  onClose: () => void;
  onSave: (updates: ShoppingSnapOrganizationUpdate[]) => Promise<void>;
  isSaving: boolean;
  eyebrow?: string;
  title?: string;
  /** The title stands in for a value not yet given ("Add store"); drawn as an action, not a name. */
  titleIsPlaceholder?: boolean;
  /** Makes the title tappable. */
  onPressTitle?: () => void;
  /** Short — it shares a line with the piece and photo tally. */
  subtitle?: string;
  saveLabel?: string;
  /** Appends the piece count to the save label: "Finish visit · 3 pieces". */
  countInSaveLabel?: boolean;
  closeLabel?: string;
  /**
   * Offered on the selection and in each item's menu when present. The caller
   * confirms and deletes; the organizer reseeds itself when `snaps` shrinks.
   */
  onRemove?: (snapIds: string[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [stages, setStages] = useState<ShoppingOrganizerStage[]>([]);
  const [history, setHistory] = useState<ShoppingOrganizerStage[][]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [rolesBySnapId, setRolesBySnapId] = useState<Record<string, ShoppingCaptureRole>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [viewerSnapId, setViewerSnapId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [hintVisible, setHintVisible] = useState(false);

  // Mirrors of the two pieces of state the gesture handlers read and write
  // mid-drag. A drop resolves and commits inside one callback, which is a
  // beat earlier than the re-render that would refresh a closure over state.
  const stagesRef = useRef<ShoppingOrganizerStage[]>([]);
  const historyRef = useRef<ShoppingOrganizerStage[][]>([]);
  const stageRefs = useRef(new Map<string, View>());
  const dropZoneRef = useRef<View | null>(null);
  const stageRects = useRef(new Map<string, Rect>());
  const dropZoneRect = useRef<Rect | null>(null);

  const homeCurrency = useCurrencyCode();
  const snapById = useMemo(() => new Map(snaps.map((snap) => [snap.id, snap])), [snaps]);
  const snapsWithStagedRoles = useMemo(
    () => snaps.map((snap) => ({ ...snap, captureRole: rolesBySnapId[snap.id] ?? snap.captureRole })),
    [rolesBySnapId, snaps],
  );
  const seededKey = useMemo(() => partitionKey(seedStages(snaps)), [snaps]);
  const reusableCaptureGroupIds = useMemo(
    () => [...new Set(snaps.map((snap) => snap.captureGroupId))],
    [snaps],
  );
  // What each section header says, computed once per change rather than
  // twice per section per render — this is the tree that re-renders on
  // every drag frame.
  const stageSummaries = useMemo(() => stages.map((stage, index) => ({
    title: snapsWithStagedRoles.find((snap) => stage.snapIds.includes(snap.id))?.category ?? `Piece ${index + 1}`,
    price: stagePrice(snapsWithStagedRoles, stage.snapIds, homeCurrency),
  })), [homeCurrency, snapsWithStagedRoles, stages]);

  const applyStages = useCallback((next: ShoppingOrganizerStage[]) => {
    stagesRef.current = next;
    setStages(next);
  }, []);

  useEffect(() => {
    applyStages(seedStages(snaps));
    historyRef.current = [];
    setHistory([]);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setViewerSnapId(null);
    setRolesBySnapId(Object.fromEntries(snaps.map((snap) => [snap.id, snap.captureRole])));
    setSaveError(null);
  }, [applyStages, snaps]);

  useEffect(() => {
    let cancelled = false;
    void isOrganizerHintDismissed().then((dismissed) => {
      if (!cancelled && !dismissed) setHintVisible(true);
    });
    return () => { cancelled = true; };
  }, []);

  /** The hint has been read — or made redundant by the gesture it describes. */
  const retireHint = useCallback(() => {
    setHintVisible((visible) => {
      if (visible) void dismissOrganizerHint();
      return false;
    });
  }, []);

  const hasRoleChanges = snaps.some(
    (snap) => rolesBySnapId[snap.id] && rolesBySnapId[snap.id] !== snap.captureRole,
  );
  const hasGroupChanges = partitionKey(stages) !== seededKey;
  const hasChanges = hasRoleChanges || hasGroupChanges;
  const action = selectionAction(stages, selectedIds);
  const selecting = selectedIds.size > 0;

  /**
   * Every structural edit goes through here, so each one is undoable. Regret
   * is the normal case in this screen — a split or a merge is a guess about
   * what the shopper meant, and the cheapest way to make guessing safe is to
   * make taking it back cost one tap rather than a full reset.
   */
  const commitStages = useCallback((
    change: (current: ShoppingOrganizerStage[]) => ShoppingOrganizerStage[],
  ) => {
    const current = stagesRef.current;
    const next = change(current);
    // A change that leaves the same partition — a drop back where it started,
    // a split of a single photo — is not worth an undo step.
    if (next === current || partitionKey(next) === partitionKey(current)) return false;
    historyRef.current = [...historyRef.current, current].slice(-25);
    setHistory(historyRef.current);
    applyStages(next);
    setSaveError(null);
    return true;
  }, [applyStages]);

  const undo = useCallback(() => {
    const past = historyRef.current;
    if (past.length === 0) return;
    applyStages(past[past.length - 1]);
    historyRef.current = past.slice(0, -1);
    setHistory(historyRef.current);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setSaveError(null);
    void Haptics.selectionAsync();
  }, [applyStages]);

  const toggleSelected = useCallback((snapId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(snapId)) next.delete(snapId);
      else next.add(snapId);
      // Deselecting the last photo leaves selection mode, so a tap goes back
      // to opening the photo rather than silently re-selecting it.
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  /** A tap means look at the photo, until the shopper is picking photos. */
  const handleTap = useCallback((snapId: string) => {
    if (selectionMode) {
      toggleSelected(snapId);
      return;
    }
    setViewerSnapId(snapId);
  }, [selectionMode, toggleSelected]);

  /** Held and let go on the spot: start picking, with this one picked. */
  const handleHold = useCallback((snapId: string) => {
    setSelectionMode(true);
    toggleSelected(snapId);
    retireHint();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [retireHint, toggleSelected]);

  const selectFromViewer = useCallback((snapId: string) => {
    setViewerSnapId(null);
    setSelectionMode(true);
    setSelectedIds((current) => new Set(current).add(snapId));
    void Haptics.selectionAsync();
  }, []);

  const cycleRole = useCallback((snapId: string) => {
    setRolesBySnapId((current) => {
      const snap = snapById.get(snapId);
      const currentRole = current[snapId] ?? snap?.captureRole ?? 'unknown';
      return { ...current, [snapId]: nextRole(currentRole) };
    });
  }, [snapById]);

  /**
   * One button for both directions: photos picked across items become one
   * item, photos picked inside an item leave it. Which of the two is happening
   * is obvious from what the shopper just tapped, so it does not need to be a
   * second control.
   */
  const runSelection = useCallback(() => {
    if (action === 'none') return;
    if (commitStages((current) => applySelection(current, selectedIds, () => Crypto.randomUUID()))) {
      void Haptics.selectionAsync();
    }
    clearSelection();
  }, [action, clearSelection, commitStages, selectedIds]);

  const splitAll = useCallback((stageId: string) => {
    if (commitStages((current) => splitStage(current, stageId, () => Crypto.randomUUID()))) {
      void Haptics.selectionAsync();
    }
    clearSelection();
  }, [clearSelection, commitStages]);

  /**
   * The item's own menu: the operations that act on the whole item rather
   * than on chosen photos. A native sheet, because both are blunt and one is
   * destructive — they deserve the pause a sheet imposes.
   */
  const openStageMenu = useCallback((stage: ShoppingOrganizerStage, index: number) => {
    const options: { label: string; destructive?: boolean; run: () => void }[] = [];
    if (stage.snapIds.length > 1) {
      options.push({ label: SHORTLIST_COPY.separatePhotos, run: () => splitAll(stage.id) });
    }
    if (onRemove) {
      options.push({ label: SHORTLIST_COPY.removePiece, destructive: true, run: () => onRemove(stage.snapIds) });
    }
    if (options.length === 0) return;
    void Haptics.selectionAsync();
    const title = `Piece ${index + 1}`;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: [...options.map((option) => option.label), 'Cancel'],
          cancelButtonIndex: options.length,
          destructiveButtonIndex: options.findIndex((option) => option.destructive) >= 0
            ? options.findIndex((option) => option.destructive)
            : undefined,
        },
        (chosen) => options[chosen]?.run(),
      );
      return;
    }
    Alert.alert(title, undefined, [
      ...options.map((option) => ({
        text: option.label,
        style: option.destructive ? ('destructive' as const) : ('default' as const),
        onPress: option.run,
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [onRemove, splitAll]);

  const resetStages = useCallback(() => {
    commitStages(() => seedStages(snaps));
    void Haptics.selectionAsync();
    clearSelection();
    setRolesBySnapId(Object.fromEntries(snaps.map((snap) => [snap.id, snap.captureRole])));
  }, [clearSelection, commitStages, snaps]);

  /**
   * Drop targets are measured once, when the photo is picked up. Nothing can
   * move under the finger mid-drag — the list only re-lays-out on release —
   * so measuring per frame would buy nothing and cost a bridge round trip on
   * every one.
   */
  const handleDragStart = useCallback((snapId: string) => {
    setDraggingId(snapId);
    setDropTarget(null);
    retireHint();
    stageRects.current.clear();
    dropZoneRect.current = null;
    stageRefs.current.forEach((node, stageId) => {
      node.measureInWindow((x, y, width, height) => {
        stageRects.current.set(stageId, { x, y, width, height });
      });
    });
    dropZoneRef.current?.measureInWindow((x, y, width, height) => {
      dropZoneRect.current = { x, y, width, height };
    });
  }, [retireHint]);

  const resolveTarget = useCallback((snapId: string, windowX: number, windowY: number): DropTarget | null => {
    // The strip floats over the list, so it wins any overlap.
    if (containsPoint(dropZoneRect.current, windowX, windowY)) return { kind: 'new' };
    for (const [stageId, rect] of stageRects.current) {
      if (!containsPoint(rect, windowX, windowY)) continue;
      const stage = stagesRef.current.find((item) => item.id === stageId);
      // Highlighting the item a photo already belongs to would promise a move
      // that will not happen.
      if (!stage || stage.snapIds.includes(snapId)) return null;
      return { kind: 'stage', stageId };
    }
    return null;
  }, []);

  const handleDragMove = useCallback((snapId: string, windowX: number, windowY: number) => {
    const next = resolveTarget(snapId, windowX, windowY);
    setDropTarget((current) => {
      if (sameTarget(current, next)) return current;
      if (next) void Haptics.selectionAsync();
      return next;
    });
  }, [resolveTarget]);

  const handleDragDrop = useCallback((
    snapId: string,
    windowX: number,
    windowY: number,
    escaped: boolean,
  ) => {
    setDraggingId(null);
    setDropTarget(null);
    if (!escaped) return;
    const target = resolveTarget(snapId, windowX, windowY);
    if (!target) return;
    const moved = commitStages((current) => moveSnapToStage(
      current,
      snapId,
      target.kind === 'new' ? null : target.stageId,
      () => Crypto.randomUUID(),
    ));
    if (moved) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [commitStages, resolveTarget]);

  const save = useCallback(() => {
    // Accepting the grouping unchanged is the common case — the button is the
    // way out of the screen, not a reward for having edited something.
    const updates = hasChanges
      ? buildShoppingSnapOrganizationUpdates(snaps, stages, rolesBySnapId, {
        reusableCaptureGroupIds,
        createGroupId: () => Crypto.randomUUID(),
      })
      : [];
    setSaveError(null);
    void onSave(updates).catch((error) => {
      setSaveError(error instanceof Error ? error.message : 'Please try again.');
    });
  }, [hasChanges, onSave, reusableCaptureGroupIds, rolesBySnapId, snaps, stages]);

  /**
   * The photo fills whatever slot the grid gives it. Its role is a mark on
   * the photo, not a caption under it: a garment carries nothing, because
   * that is the default and the picture says so; a tag gets a small corner
   * badge; only an unsorted photo is a job, and gets the accent pill.
   */
  const renderPhotoTile = useCallback((snapId: string, index: number) => {
    const snap = snapById.get(snapId);
    if (!snap) return null;
    const role = rolesBySnapId[snapId] ?? snap.captureRole;
    const selected = selectedIds.has(snapId);
    const dragging = draggingId === snapId;
    const hero = index === 0;
    return (
      <View
        style={[styles.photo, (selected || dragging) && styles.photoActive]}
        accessibilityLabel={`${snapRoleLabel(role)} photo, tap to see it big, hold to select or drag`}
        accessibilityState={{ selected }}
      >
        <Image
          source={{ uri: snap.imageUri }}
          style={StyleSheet.absoluteFill}
          // The hero shows the whole garment; the paperwork beside it can crop.
          contentFit={hero ? 'contain' : 'cover'}
        />
        {role === 'tag' ? (
          <View pointerEvents="none" style={styles.tagBadge}>
            <Text style={styles.tagBadgeText}>{snapRoleLabel(role)}</Text>
          </View>
        ) : null}
        {role === 'unknown' ? (
          <View pointerEvents="none" style={styles.unsortedBadge}>
            <Text style={styles.unsortedBadgeText}>{snapRoleLabel(role)}</Text>
          </View>
        ) : null}
        {selected ? (
          <View style={styles.check}>
            <Ionicons name="checkmark" size={15} color={colors.primaryForeground} />
          </View>
        ) : null}
      </View>
    );
  }, [draggingId, rolesBySnapId, selectedIds, snapById]);

  const viewerStageIndex = viewerSnapId === null
    ? -1
    : stages.findIndex((stage) => stage.snapIds.includes(viewerSnapId));
  const viewerSnaps = viewerStageIndex >= 0
    ? stages[viewerStageIndex].snapIds
      .map((snapId) => snapById.get(snapId))
      .filter((snap): snap is ShoppingSnap => Boolean(snap))
    : [];

  const actionLabel = action === 'merge'
    ? `Group ${selectedIds.size} as one`
    : action === 'pull-out'
      ? `Pull ${selectedIds.size} out`
      : 'Group as one';

  const tally = `${stages.length} ${stages.length === 1 ? SHORTLIST_COPY.piece : SHORTLIST_COPY.pieces} · ${snaps.length} ${SHORTLIST_COPY.photos}`;
  const finishLabel = countInSaveLabel
    ? `${saveLabel} · ${stages.length} ${stages.length === 1 ? SHORTLIST_COPY.piece : SHORTLIST_COPY.pieces}`
    : saveLabel;
  const bottomInset = insets.bottom + SAVE_BAR_HEIGHT;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* One header block, one hairline. The tally used to have a band of
          its own below this, which left an edgeless bar for the list to
          scroll under; it now shares the meta line. Undo and reset sit with
          the close button so taking a grouping back never depends on still
          being in selection mode. */}
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="eyebrow" tone="brand">{eyebrow}</AppText>
          {onPressTitle ? (
            <TouchableOpacity
              style={styles.titleButton}
              onPress={onPressTitle}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={titleIsPlaceholder ? title : `Change store, currently ${title}`}
            >
              <AppText
                variant="editorialSection"
                tone={titleIsPlaceholder ? 'action' : 'primary'}
                style={styles.title}
                numberOfLines={1}
              >
                {title}
              </AppText>
              <Ionicons name="pencil-outline" size={16} color={colors.action} style={styles.titleIcon} />
            </TouchableOpacity>
          ) : (
            <AppText variant="editorialSection" tone="primary" style={styles.title} numberOfLines={1}>{title}</AppText>
          )}
          <Text style={styles.meta} numberOfLines={1}>
            {[subtitle, tally].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {history.length > 0 ? (
            <TouchableOpacity
              style={styles.ghostButton}
              onPress={undo}
              disabled={isSaving}
              accessibilityLabel="Undo the last grouping change"
            >
              <Ionicons name="arrow-undo-outline" size={16} color={colors.secondaryForeground} />
            </TouchableOpacity>
          ) : null}
          {hasChanges ? (
            <TouchableOpacity
              style={styles.ghostButton}
              onPress={resetStages}
              disabled={isSaving}
              accessibilityLabel="Reset to the original grouping"
            >
              <Ionicons name="refresh-outline" size={16} color={colors.secondaryForeground} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.iconButton} onPress={onClose} disabled={isSaving} accessibilityLabel="Close organizer">
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* The selection toolbar exists only while photos are selected. At
          rest there is nothing here — a greyed-out grouping button on
          arrival put a dead control where the first photograph should be. */}
      {selecting ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.toolbar}>
          <TouchableOpacity
            style={styles.toolbarCountButton}
            onPress={clearSelection}
            disabled={isSaving}
            accessibilityLabel={`Clear ${selectedIds.size} selected photos`}
          >
            <Text style={styles.toolbarCountStrong}>{selectedIds.size} selected</Text>
            <Text style={styles.toolbarClear}>Clear</Text>
          </TouchableOpacity>
          <View style={styles.toolbarActions}>
            {onRemove ? (
              <TouchableOpacity
                style={styles.ghostButton}
                onPress={() => onRemove([...selectedIds])}
                disabled={isSaving}
                accessibilityLabel={`Remove ${selectedIds.size} selected photos`}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.makeButton, action === 'none' && styles.makeButtonDisabled]}
              onPress={runSelection}
              disabled={action === 'none' || isSaving}
              accessibilityLabel={actionLabel}
            >
              <Ionicons
                name={action === 'pull-out' ? 'exit-outline' : 'albums-outline'}
                size={16}
                color={colors.primaryForeground}
              />
              <Text style={styles.makeText}>{actionLabel}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}

      <ScrollView
        scrollEnabled={draggingId === null}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + DROP_ZONE_HEIGHT + spacing.md }]}
      >
        {hintVisible && !selecting ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} layout={LinearTransition} style={styles.hint}>
            <Ionicons name="hand-left-outline" size={18} color={colors.primary} />
            <Text style={styles.hintText}>
              Hold a photo to select it. Drag it into another piece, or down to start a new one.
            </Text>
            <TouchableOpacity onPress={retireHint} hitSlop={8} accessibilityLabel="Dismiss hint">
              <Ionicons name="close" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {stages.map((stage, index) => {
          const hovered = dropTarget?.kind === 'stage' && dropTarget.stageId === stage.id;
          const summary = stageSummaries[index];
          const hasMenu = stage.snapIds.length > 1 || Boolean(onRemove);
          return (
            // The outer view animates the band into place when a split or
            // merge changes the list; the inner one is what gets measured
            // as a drop target, and stays a plain View so measureInWindow
            // reads the settled frame.
            <Animated.View key={stage.id} layout={LinearTransition.duration(220)} entering={FadeIn.duration(180)}>
              <View
                ref={(node) => {
                  if (node) stageRefs.current.set(stage.id, node);
                  else stageRefs.current.delete(stage.id);
                }}
                style={[
                  styles.pool,
                  index === stages.length - 1 && styles.poolLast,
                  hovered && styles.poolHovered,
                ]}
              >
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.sectionTitle}>{summary?.title}</Text>
                    <Text style={styles.sectionMeta}>
                      {hovered
                        ? 'Release to add this photo'
                        : `${stage.snapIds.length} photo${stage.snapIds.length === 1 ? '' : 's'}${
                          summary?.price ? ` · ${summary.price}` : ''}`}
                    </Text>
                  </View>
                  {hasMenu ? (
                    <TouchableOpacity
                      style={styles.menuButton}
                      onPress={() => openStageMenu(stage, index)}
                      disabled={isSaving}
                      hitSlop={6}
                      accessibilityLabel={`More options for piece ${index + 1}`}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <DraggablePhotoGrid
                  ids={stage.snapIds}
                  layout={pieceLayout}
                  onReorder={(nextIds) => applyStages(stagesRef.current.map((item) => (
                    item.id === stage.id ? { ...item, snapIds: nextIds } : item
                  )))}
                  onTap={handleTap}
                  onHold={handleHold}
                  renderPhoto={renderPhotoTile}
                  disabled={isSaving}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragDrop={handleDragDrop}
                />
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      {viewerSnapId !== null && viewerSnaps.length > 0 ? (
        <ShoppingPhotoViewer
          snaps={viewerSnaps}
          initialSnapId={viewerSnapId}
          itemLabel={stageSummaries[viewerStageIndex]?.title ?? `Piece ${viewerStageIndex + 1}`}
          roleFor={(snapId) => rolesBySnapId[snapId] ?? snapById.get(snapId)?.captureRole ?? 'unknown'}
          onCycleRole={cycleRole}
          onSelect={selectFromViewer}
          onClose={() => setViewerSnapId(null)}
        />
      ) : null}

      <NewItemDropZone
        ref={dropZoneRef}
        visible={draggingId !== null}
        hovered={dropTarget?.kind === 'new'}
        bottom={bottomInset + spacing.sm}
      />

      <View style={[styles.saveBar, { paddingBottom: insets.bottom + spacing.md }]}>
        {saveError ? (
          <View style={styles.error}>
            <Ionicons name="alert-circle-outline" size={17} color={colors.error} />
            <Text selectable style={styles.errorText}>{saveError}</Text>
          </View>
        ) : null}
        <View style={styles.saveRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isSaving}>
            <Text style={styles.cancelText}>{closeLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, (isSaving || snaps.length === 0) && styles.saveButtonDisabled]}
            onPress={save}
            disabled={isSaving || snaps.length === 0}
          >
            {isSaving ? <ActivityIndicator color={colors.primaryForeground} /> : <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />}
            <Text style={styles.saveText}>{finishLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/**
 * The escape hatch for "this photo isn't part of anything here". It stays
 * mounted so its position is measurable the instant a drag begins, and fades
 * in over the list only while one is in flight — a permanent empty box would
 * read as an item the shopper had failed to fill.
 */
function NewItemDropZone({
  ref,
  visible,
  hovered,
  bottom,
}: {
  ref: React.RefObject<View | null>;
  visible: boolean;
  hovered: boolean;
  bottom: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: 160 });
  }, [progress, visible]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));

  return (
    <Animated.View
      ref={ref}
      pointerEvents="none"
      style={[styles.dropZone, { bottom }, hovered && styles.dropZoneHovered, style]}
    >
      <Ionicons
        name={hovered ? 'add-circle' : 'add-circle-outline'}
        size={20}
        color={hovered ? colors.primaryForeground : colors.primary}
      />
      <Text style={[styles.dropZoneText, hovered && styles.dropZoneTextHovered]}>
        {hovered ? 'Release to make a new piece' : 'Drag here to make a new piece'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerCopy: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },
  title: { paddingTop: 2 },
  titleButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start' },
  titleIcon: { marginTop: 4 },
  meta: { paddingTop: spacing.xs, fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surfaceSubtle },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surfaceSubtle },
  toolbarCountButton: { flexShrink: 1, minHeight: 44, justifyContent: 'center' },
  toolbarCountStrong: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground, fontVariant: ['tabular-nums'] },
  toolbarClear: { fontSize: typography.text.caption.fontSize, color: colors.primary },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ghostButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  content: { paddingHorizontal: spacing.lg },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  hintText: { flex: 1, fontSize: typography.text.caption.fontSize, lineHeight: 17, color: colors.mutedForeground },
  // An item is a band of the page, separated by a hairline — the same shape
  // the shortlist uses for a visit, so the two screens read as one product.
  pool: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  poolLast: { borderBottomWidth: 0 },
  // A drop target has to be unmistakable mid-drag, so this is the one place
  // the band is allowed to become a surface.
  poolHovered: {
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderBottomColor: 'transparent',
    backgroundColor: colors.surfaceSelected,
  },
  sectionHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  sectionMeta: { paddingTop: 2, fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  menuButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  makeButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary },
  makeButtonDisabled: { opacity: 0.45 },
  makeText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  photo: { flex: 1, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', borderRadius: radii.photo, backgroundColor: colors.surfaceSubtle },
  photoActive: { borderColor: colors.primary },
  check: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  tagBadge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.full, backgroundColor: colors.foreground },
  tagBadgeText: { fontSize: 11, fontWeight: typography.weight.medium, letterSpacing: 0.2, color: colors.primaryForeground },
  unsortedBadge: { position: 'absolute', left: 6, right: 6, bottom: 6, alignItems: 'center', paddingVertical: 3, borderRadius: radii.full, backgroundColor: colors.accent },
  unsortedBadgeText: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },
  dropZone: { position: 'absolute', left: spacing.lg, right: spacing.lg, height: DROP_ZONE_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: radii.lg, backgroundColor: colors.accent },
  dropZoneHovered: { borderStyle: 'solid', backgroundColor: colors.primary },
  dropZoneText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primary },
  dropZoneTextHovered: { color: colors.primaryForeground },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, marginBottom: spacing.md, borderRadius: radii.md, backgroundColor: '#FBEDEA' },
  errorText: { flex: 1, fontSize: typography.text.bodySmall.fontSize, lineHeight: 20, color: colors.error },
  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cancelButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  cancelText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  saveButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.md, backgroundColor: colors.primary },
  saveButtonDisabled: { opacity: 0.45 },
  saveText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
});
