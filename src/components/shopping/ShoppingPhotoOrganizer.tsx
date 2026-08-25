import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DraggablePhotoGrid } from './DraggablePhotoGrid';
import { AppText } from '../primitives/AppText';
import { ShoppingPhotoViewer } from './ShoppingPhotoViewer';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
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

const TILE_WIDTH = 92;
const PHOTO_HEIGHT = 112;
const CHIP_HEIGHT = 22;
const TILE_INNER_GAP = spacing.xs;
const TILE_HEIGHT = PHOTO_HEIGHT + TILE_INNER_GAP + CHIP_HEIGHT;
const GRID_GAP = spacing.sm;
const DROP_ZONE_HEIGHT = 64;

type Rect = { x: number; y: number; width: number; height: number };
/** Where a dragged photo would land if it were released right now. */
type DropTarget = { kind: 'stage'; stageId: string } | { kind: 'new' };

function nextRole(role: ShoppingCaptureRole): ShoppingCaptureRole {
  if (role === 'unknown') return 'garment';
  if (role === 'garment') return 'tag';
  return 'unknown';
}

function stagePrice(snaps: ShoppingSnap[], snapIds: string[], currencyCode: string): string | null {
  const snapSet = new Set(snapIds);
  const price = snaps.find((snap) => snapSet.has(snap.id) && snap.captureRole === 'tag' && snap.extractedPrice !== null)?.extractedPrice
    ?? snaps.find((snap) => snapSet.has(snap.id) && snap.extractedPrice !== null)?.extractedPrice
    ?? null;
  return formatShoppingPrice(price, currencyCode);
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

/**
 * The organizer always shows a complete partition of the photos — one section
 * per item, never a loose "unassigned" pool. Opening it on a visit therefore
 * shows the grouping the camera already produced, and the work is corrective.
 *
 * The gestures follow the phone's own photo grids, so none of them has to be
 * taught: tap opens the photo full size, hold-and-release starts selecting,
 * hold-and-drag carries the photo into another item or onto the new-item
 * strip. Only once photos are selected does the toolbar offer to pull them
 * out or group them as one. Splitting an item into single photos is still
 * there, but it is now the blunt last resort rather than the only tool.
 */
export function ShoppingPhotoOrganizer({
  snaps,
  onClose,
  onSave,
  isSaving,
  eyebrow = 'ORGANIZE',
  title = 'Group photos',
  subtitle = 'Tap a photo to see it big. Hold to select it, or drag it into another piece.',
  saveLabel = 'Save',
  closeLabel = 'Cancel',
}: {
  snaps: ShoppingSnap[];
  onClose: () => void;
  onSave: (updates: ShoppingSnapOrganizationUpdate[]) => Promise<void>;
  isSaving: boolean;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  saveLabel?: string;
  closeLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const currencyCode = useCurrencyCode();
  const [stages, setStages] = useState<ShoppingOrganizerStage[]>([]);
  const [history, setHistory] = useState<ShoppingOrganizerStage[][]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [rolesBySnapId, setRolesBySnapId] = useState<Record<string, ShoppingCaptureRole>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [viewerSnapId, setViewerSnapId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // Mirrors of the two pieces of state the gesture handlers read and write
  // mid-drag. A drop resolves and commits inside one callback, which is a
  // beat earlier than the re-render that would refresh a closure over state.
  const stagesRef = useRef<ShoppingOrganizerStage[]>([]);
  const historyRef = useRef<ShoppingOrganizerStage[][]>([]);
  const stageRefs = useRef(new Map<string, View>());
  const dropZoneRef = useRef<View | null>(null);
  const stageRects = useRef(new Map<string, Rect>());
  const dropZoneRect = useRef<Rect | null>(null);

  const snapById = useMemo(() => new Map(snaps.map((snap) => [snap.id, snap])), [snaps]);
  const snapsWithStagedRoles = useMemo(
    () => snaps.map((snap) => ({ ...snap, captureRole: rolesBySnapId[snap.id] ?? snap.captureRole })),
    [rolesBySnapId, snaps],
  );
  const seeded = useMemo(() => seedStages(snaps), [snaps]);
  const reusableCaptureGroupIds = useMemo(
    () => [...new Set(snaps.map((snap) => snap.captureGroupId))],
    [snaps],
  );

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

  const hasRoleChanges = snaps.some(
    (snap) => rolesBySnapId[snap.id] && rolesBySnapId[snap.id] !== snap.captureRole,
  );
  const hasGroupChanges = partitionKey(stages) !== partitionKey(seeded);
  const hasChanges = hasRoleChanges || hasGroupChanges;
  const action = selectionAction(stages, selectedIds);

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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [toggleSelected]);

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
  }, []);

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

  const renderPhotoTile = useCallback((snapId: string) => {
    const snap = snapById.get(snapId);
    if (!snap) return null;
    const role = rolesBySnapId[snapId] ?? snap.captureRole;
    const selected = selectedIds.has(snapId);
    const dragging = draggingId === snapId;
    return (
      <View
        style={[styles.photo, selected && styles.photoSelected, dragging && styles.photoDragging]}
      accessibilityLabel={`${snapRoleLabel(role)} photo, tap to select, hold to drag into another piece`}
        accessibilityState={{ selected }}
      >
        <Image source={{ uri: snap.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {selected ? (
          <View style={styles.check}>
            <Ionicons name="checkmark" size={15} color={colors.primaryForeground} />
          </View>
        ) : null}
      </View>
    );
  }, [draggingId, rolesBySnapId, selectedIds, snapById]);

  const renderRoleChip = useCallback((snapId: string) => {
    const snap = snapById.get(snapId);
    if (!snap) return null;
    const role = rolesBySnapId[snapId] ?? snap.captureRole;
    // A recognised role is a caption; only an unrecognised one is a job, and
    // gets the pill. A pill under every photo made the word outweigh the
    // garment it was labelling.
    const unresolved = role === 'unknown';
    return (
      <TouchableOpacity
        style={[styles.roleChip, unresolved && styles.roleChipUnresolved]}
        onPress={() => cycleRole(snapId)}
        disabled={isSaving}
        accessibilityLabel={`Change photo role from ${snapRoleLabel(role)}`}
      >
        <Text style={[styles.roleText, unresolved && styles.roleTextUnresolved]} numberOfLines={1}>
          {snapRoleLabel(role)}
        </Text>
      </TouchableOpacity>
    );
  }, [cycleRole, isSaving, rolesBySnapId, snapById]);

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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="eyebrow" tone="brand">{eyebrow}</AppText>
          <AppText variant="editorialSection" tone="primary" style={styles.title}>{title}</AppText>
          <AppText variant="bodySmall" tone="muted" style={styles.subtitle}>{subtitle}</AppText>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={onClose} disabled={isSaving} accessibilityLabel="Close organizer">
          <Ionicons name="close" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* At rest this is a tally, not a toolbar. The grouping action only
          exists once photos are selected — rendering it greyed out on arrival
          put a dead button where the first photograph should be. Undo and
          reset live here rather than beside the selection action, so taking a
          grouping back does not depend on still being in selection mode. */}
      <View style={styles.toolbar}>
        {selectedIds.size > 0 ? (
          <TouchableOpacity
            style={styles.toolbarCountButton}
            onPress={clearSelection}
            disabled={isSaving}
            accessibilityLabel={`Clear ${selectedIds.size} selected photos`}
          >
            <Text style={styles.toolbarCountStrong}>{selectedIds.size} selected</Text>
            <Text style={styles.toolbarClear}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.toolbarCount}>
            {stages.length} {stages.length === 1 ? SHORTLIST_COPY.piece : SHORTLIST_COPY.pieces} · {snaps.length} {SHORTLIST_COPY.photos}
          </Text>
        )}
        <View style={styles.toolbarActions}>
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
          {selectedIds.size > 0 ? (
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
          ) : null}
        </View>
      </View>

      <ScrollView
        scrollEnabled={draggingId === null}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 + DROP_ZONE_HEIGHT }]}
      >
        {stages.map((stage, index) => {
          const hovered = dropTarget?.kind === 'stage' && dropTarget.stageId === stage.id;
          return (
            <View
              key={stage.id}
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
                  <Text style={styles.sectionTitle}>
                    {snapsWithStagedRoles.find((snap) => stage.snapIds.includes(snap.id))?.category ?? `Piece ${index + 1}`}
                  </Text>
                  <Text style={styles.sectionMeta}>
                    {hovered
                      ? 'Release to add this photo'
                      : `${stage.snapIds.length} photo${stage.snapIds.length === 1 ? '' : 's'}${
                        stagePrice(snapsWithStagedRoles, stage.snapIds, currencyCode)
                          ? ` · ${stagePrice(snapsWithStagedRoles, stage.snapIds, currencyCode)}`
                          : ''}`}
                  </Text>
                </View>
                {stage.snapIds.length > 1 ? (
                  <TouchableOpacity
                    style={styles.splitButton}
                    onPress={() => splitAll(stage.id)}
                    disabled={isSaving}
                    accessibilityLabel={`Separate photos in piece ${index + 1}`}
                  >
                    <Ionicons name="cut-outline" size={16} color={colors.action} />
                    <Text style={styles.splitText}>{SHORTLIST_COPY.separatePhotos}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <DraggablePhotoGrid
                ids={stage.snapIds}
                onReorder={(nextIds) => applyStages(stagesRef.current.map((item) => (
                  item.id === stage.id ? { ...item, snapIds: nextIds } : item
                )))}
                onTap={handleTap}
                onHold={handleHold}
                renderPhoto={renderPhotoTile}
                renderChip={renderRoleChip}
                disabled={isSaving}
                tileWidth={TILE_WIDTH}
                tileHeight={TILE_HEIGHT}
                photoHeight={PHOTO_HEIGHT}
                innerGap={TILE_INNER_GAP}
                gap={GRID_GAP}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragDrop={handleDragDrop}
              />
            </View>
          );
        })}

        {saveError ? (
          <View style={styles.error}>
            <Ionicons name="alert-circle-outline" size={17} color={colors.error} />
            <Text selectable style={styles.errorText}>{saveError}</Text>
          </View>
        ) : null}
      </ScrollView>

      {viewerSnapId !== null && viewerSnaps.length > 0 ? (
        <ShoppingPhotoViewer
          snaps={viewerSnaps}
          initialSnapId={viewerSnapId}
            itemLabel={`Piece ${viewerStageIndex + 1}`}
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
        bottom={insets.bottom + 76}
      />

      <View style={[styles.saveBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isSaving}>
          <Text style={styles.cancelText}>{closeLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, (isSaving || snaps.length === 0) && styles.saveButtonDisabled]}
          onPress={save}
          disabled={isSaving || snaps.length === 0}
        >
          {isSaving ? <ActivityIndicator color={colors.primaryForeground} /> : <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />}
          <Text style={styles.saveText}>{saveLabel}</Text>
        </TouchableOpacity>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerCopy: { flex: 1 },
  eyebrow: { ...typography.text.eyebrow, color: colors.primary },
  title: { paddingTop: 2 },
  subtitle: { paddingTop: spacing.xs },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surfaceSubtle },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  toolbarCount: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  toolbarCountButton: { flexShrink: 1, minHeight: 38, justifyContent: 'center' },
  toolbarCountStrong: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground, fontVariant: ['tabular-nums'] },
  toolbarClear: { fontSize: typography.text.caption.fontSize, color: colors.primary },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ghostButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  // An item is a band of the page, separated by a hairline — the same shape
  // the shortlist uses for a visit, so the two screens read as one product.
  pool: {
    gap: spacing.md,
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
  sectionHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.bold, color: colors.foreground },
  sectionMeta: { paddingTop: 2, fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  makeButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary },
  makeButtonDisabled: { opacity: 0.45 },
  makeText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  // Text, not a filled chip: splitting is the blunt last resort, and a filled
  // button on every item argued the opposite.
  splitButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingLeft: spacing.sm },
  splitText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.medium, color: colors.action },
  photo: { width: TILE_WIDTH, height: PHOTO_HEIGHT, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', borderRadius: radii.photo, backgroundColor: colors.surfaceSubtle },
  photoSelected: { borderColor: colors.primary },
  photoDragging: { borderColor: colors.primary },
  check: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  roleChip: { minHeight: CHIP_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  roleChipUnresolved: { borderRadius: radii.full, backgroundColor: colors.accent },
  roleText: { ...typography.text.caption, color: colors.mutedForeground },
  roleTextUnresolved: { fontWeight: typography.weight.semibold, color: colors.primary },
  dropZone: { position: 'absolute', left: spacing.lg, right: spacing.lg, height: DROP_ZONE_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: radii.lg, backgroundColor: colors.accent },
  dropZoneHovered: { borderStyle: 'solid', backgroundColor: colors.primary },
  dropZoneText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primary },
  dropZoneTextHovered: { color: colors.primaryForeground },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: '#FBEDEA' },
  errorText: { flex: 1, fontSize: typography.text.bodySmall.fontSize, lineHeight: 20, color: colors.error },
  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
  cancelButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  cancelText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  saveButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.md, backgroundColor: colors.primary },
  saveButtonDisabled: { opacity: 0.45 },
  saveText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
});
