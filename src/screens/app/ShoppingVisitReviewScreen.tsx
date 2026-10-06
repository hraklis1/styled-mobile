import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Haptics from '../../lib/haptics';

import { ShoppingPhotoOrganizer, type ShoppingPieceRename } from '../../components/shopping/ShoppingPhotoOrganizer';
import { UndoToast } from '../../components/primitives/UndoToast';
import { ShoppingStoreAssignmentSheet } from '../../components/shopping/ShoppingStoreAssignmentSheet';
import { useAuth } from '../../contexts/AuthContext';
import { useAssignShoppingStore } from '../../hooks/useAssignShoppingStore';
import { useShoppingItemActions } from '../../hooks/useShoppingItemActions';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { deleteShoppingSnaps } from '../../lib/deleteShoppingSnaps';
import { deleteShoppingPreview } from '../../lib/shoppingPreviews';
import { applyShoppingPreviewUris, buildShoppingEditItems, mergeShoppingSnaps } from '../../lib/shoppingGallery';
import { buildShoppingStoreOptions } from '../../lib/shoppingStoreFilters';
import { SHORTLIST_COPY } from '../../lib/shoppingVocabulary';
import type { ShoppingSnapOrganizationUpdate } from '../../lib/shoppingSnapOrganizer';
import { buildVisitReviewHeader } from '../../lib/shoppingVisitReview';
import type { ShoppingVisitReviewScreenProps } from '../../navigation/types';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { colors, spacing } from '../../theme';

const UNDO_WINDOW_MS = 5000;
/** The organizer's save bar; the toast floats just above it. */
const SAVE_BAR_HEIGHT = 80;

/**
 * Where a shopping visit ends. The camera now closes into this screen instead
 * of dropping the shopper back on the Shop tab, because the moment they stop
 * shooting is the only moment they still remember which photos were which.
 *
 * The organizer is the review. Photos arrive grouped by the item selected in
 * the camera, so the primary action is to accept that as it stands; but the
 * tools to regroup, relabel or remove a photo are on screen from the start
 * rather than behind an extra step, because a wrong shot is cheapest to fix
 * while the rack is still in front of you.
 */
export function ShoppingVisitReviewScreen({ navigation, route }: ShoppingVisitReviewScreenProps) {
  const { sessionId } = route.params;
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: remoteSnaps = [], isLoading } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const visitPreviews = useShoppingSessionStore((state) => state.visitPreviews);
  const currentSession = useShoppingSessionStore((state) => state.currentSession);
  const pendingVisitMetadata = useShoppingSessionStore((state) => state.pendingVisitMetadata);
  const endVisit = useShoppingSessionStore((state) => state.endVisit);
  const { saveOrganization, isSavingOrganization, saveCatalog } = useShoppingItemActions();
  const assignShoppingStore = useAssignShoppingStore();
  const storeSheetRef = useRef<BottomSheetModal>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const insets = useSafeAreaInsets();
  // A removal waits out its undo window before anything is deleted; until
  // then its photos are only hidden.
  const [pendingRemoval, setPendingRemoval] = useState<{ snapIds: string[]; message: string } | null>(null);
  const pendingRef = useRef<{ snapIds: string[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  // Reached from the camera this screen closes a trip in progress; reached
  // from the shortlist it is just an organizer over an old one. The copy has
  // to follow, or "Keep shooting" offers a camera that is not there.
  const isLiveVisit = currentSession?.id === sessionId;

  // The raw snaps keep the full-size local file as `imageUri`; the displayed
  // ones swap in the small preview. Deletion has to go through the raw snap,
  // or it would remove the preview and orphan the photo it stands for.
  const allSnaps = useMemo(() => mergeShoppingSnaps(remoteSnaps, pendingUploads), [pendingUploads, remoteSnaps]);
  const rawSnaps = useMemo(() => allSnaps
    .filter((snap) => snap.shoppingSessionId === sessionId)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      || a.captureSequence - b.captureSequence), [allSnaps, sessionId]);
  // Stores the shopper has used before, offered first in the store sheet.
  const storeOptions = useMemo(() => buildShoppingStoreOptions(buildShoppingEditItems(allSnaps)), [allSnaps]);
  const allVisitSnaps = useMemo(
    () => applyShoppingPreviewUris(rawSnaps, visitPreviews, pendingUploads),
    [pendingUploads, rawSnaps, visitPreviews],
  );
  const snaps = useMemo(() => {
    if (!pendingRemoval) return allVisitSnaps;
    const hidden = new Set(pendingRemoval.snapIds);
    return allVisitSnaps.filter((snap) => !hidden.has(snap.id));
  }, [allVisitSnaps, pendingRemoval]);
  const fullImageUris = useMemo(() => new Map(rawSnaps.map((snap) => [snap.id, snap.imageUri])), [rawSnaps]);

  /**
   * Ends the visit and releases the rail's preview files. Cleanup lives here
   * rather than in the camera's close handler: the previews are what this
   * screen renders, so destroying them on the way out of the camera left
   * nothing to review.
   */
  const finish = useCallback(() => {
    const state = useShoppingSessionStore.getState();
    state.visitPreviews
      .filter((preview) => preview.shoppingSessionId === sessionId)
      .forEach((preview) => deleteShoppingPreview(preview.previewUri));
    // Only the visit that is still open gets closed. Reached from the
    // shortlist this screen is just an organizer over an old trip, and must
    // not end whatever visit happens to be live.
    if (state.currentSession?.id === sessionId) endVisit();
    // A finished visit belongs in the shortlist, not back on the camera it
    // came from. Resetting rather than pushing also means the shortlist's own
    // back button leads to Shop, instead of reopening a camera the shopper
    // has already closed.
    if (!isLiveVisit && navigation.canGoBack()) navigation.goBack();
    else navigation.popTo('ShopMain', { view: 'shortlist' });
  }, [endVisit, isLiveVisit, navigation, sessionId]);

  // A failure is rethrown for the organizer to show inline, beside the
  // button that caused it; an alert on top of that told the shopper twice.
  const handleSave = useCallback(async (updates: ShoppingSnapOrganizationUpdate[], renames: ShoppingPieceRename[] = []) => {
    setIsFinishing(true);
    try {
      // A removal still inside its undo window is final once the visit is.
      await commitPendingRef.current();
      await saveOrganization(updates);
      // Names go on after the regroup, so each lands on its piece's final group.
      for (const rename of renames) {
        await saveCatalog(rename.captureGroupId, { productName: rename.productName });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      finish();
    } finally {
      setIsFinishing(false);
    }
  }, [finish, saveCatalog, saveOrganization]);

  /**
   * The store is asked for here because this is the last moment the shopper
   * is certain to still be standing in it. It lands on every photo of the
   * visit and on the visit itself, the same write the shortlist does later.
   */
  const openStoreSheet = useCallback(() => {
    void Haptics.selectionAsync();
    storeSheetRef.current?.present();
  }, []);

  const saveStore = useCallback((storeName: string) => {
    void assignShoppingStore({ snaps: rawSnaps, shoppingSessionId: sessionId }, storeName);
  }, [assignShoppingStore, rawSnaps, sessionId]);

  /**
   * Backing out keeps the visit open and the grouping as it stands, so the
   * shopper can return to the camera for one more rack without being made to
   * commit first.
   */
  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const removeSnaps = useCallback(async (snapIds: string[]) => {
    const ids = new Set(snapIds);
    const targets = rawSnaps.filter((snap) => ids.has(snap.id));
    if (targets.length === 0) return;
    // Read the previews before deleting: markCaptureDeleted drops them from
    // the store, but only this screen knows to remove the files behind them.
    const previews = useShoppingSessionStore.getState().visitPreviews.filter((preview) => ids.has(preview.id));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await deleteShoppingSnaps(targets, userId);
      previews.forEach((preview) => deleteShoppingPreview(preview.previewUri));
    } catch (error) {
      Alert.alert(
        'Could not remove photos',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [rawSnaps, userId]);

  /** Deletes whatever is waiting in the undo window, now. */
  const commitPendingRemoval = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setPendingRemoval(null);
    await removeSnaps(pending.snapIds);
  }, [removeSnaps]);
  const commitPendingRef = useRef(commitPendingRemoval);
  commitPendingRef.current = commitPendingRemoval;

  /**
   * Hide now, delete after the undo window. Hiding still reseeds the
   * organizer from what is left, as a real delete always did.
   */
  const stageRemove = useCallback((snapIds: string[]) => {
    void commitPendingRef.current();
    const isWholePiece = snapIds.length > 1
      && new Set(rawSnaps.filter((snap) => snapIds.includes(snap.id)).map((snap) => snap.captureGroupId)).size === 1;
    const message = snapIds.length === 1
      ? 'Photo removed'
      : isWholePiece ? 'Piece removed' : `${snapIds.length} photos removed`;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const timer = setTimeout(() => { void commitPendingRef.current(); }, UNDO_WINDOW_MS);
    pendingRef.current = { snapIds, timer };
    setPendingRemoval({ snapIds, message });
  }, [rawSnaps]);

  const undoRemoval = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setPendingRemoval(null);
    void Haptics.selectionAsync();
  }, []);

  // Leaving the screen or the app must not strand a hidden-but-undeleted photo.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') void commitPendingRef.current();
    });
    return () => {
      subscription.remove();
      void commitPendingRef.current();
    };
  }, []);

  // Nothing was photographed — there is no review to do, so close the visit
  // out rather than parking on an empty organizer.
  useEffect(() => {
    if (!isLoading && allVisitSnaps.length === 0) finish();
  }, [finish, isLoading, allVisitSnaps.length]);

  if (allVisitSnaps.length === 0) return <View style={styles.root} />;

  const header = buildVisitReviewHeader(snaps, {
    isLiveVisit,
    fallbackStoreName: isLiveVisit
      ? currentSession?.storeName
      : pendingVisitMetadata.find((session) => session.id === sessionId)?.storeName,
  });

  return (
    <View style={styles.root}>
      <ShoppingPhotoOrganizer
        snaps={snaps}
        fullImageUris={fullImageUris}
        onClose={handleClose}
        onSave={handleSave}
        onRemove={stageRemove}
        isSaving={isSavingOrganization || isFinishing}
        eyebrow={header.eyebrow}
        title={header.storeName ?? SHORTLIST_COPY.todaysVisit}
        onPressTitle={openStoreSheet}
        titleAction={header.storeName === null ? { label: SHORTLIST_COPY.addStore, onPress: openStoreSheet } : undefined}
        showHeaderClose={false}
        canRename
        subtitle={header.meta}
        saveLabel={isLiveVisit ? 'Finish visit' : 'Done'}
        countInSaveLabel={isLiveVisit}
        closeLabel={isLiveVisit ? 'Keep shooting' : 'Back'}
      />
      {pendingRemoval ? (
        <UndoToast
          message={pendingRemoval.message}
          onUndo={undoRemoval}
          bottom={insets.bottom + SAVE_BAR_HEIGHT + spacing.md}
        />
      ) : null}
      <ShoppingStoreAssignmentSheet
        sheetRef={storeSheetRef}
        options={storeOptions}
        onSelect={saveStore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
