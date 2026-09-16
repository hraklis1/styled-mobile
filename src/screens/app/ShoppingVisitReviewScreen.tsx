import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ShoppingPhotoOrganizer } from '../../components/shopping/ShoppingPhotoOrganizer';
import { useAuth } from '../../contexts/AuthContext';
import { useShoppingItemActions } from '../../hooks/useShoppingItemActions';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { deleteShoppingSnaps } from '../../lib/deleteShoppingSnaps';
import { deleteShoppingPreview } from '../../lib/shoppingPreviews';
import { applyShoppingPreviewUris, mergeShoppingSnaps } from '../../lib/shoppingGallery';
import type { ShoppingSnapOrganizationUpdate } from '../../lib/shoppingSnapOrganizer';
import { buildVisitReviewHeader } from '../../lib/shoppingVisitReview';
import type { ShoppingVisitReviewScreenProps } from '../../navigation/types';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { colors } from '../../theme';

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
  const { data: remoteSnaps = [], isLoading } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const visitPreviews = useShoppingSessionStore((state) => state.visitPreviews);
  const currentSession = useShoppingSessionStore((state) => state.currentSession);
  const pendingVisitMetadata = useShoppingSessionStore((state) => state.pendingVisitMetadata);
  const endVisit = useShoppingSessionStore((state) => state.endVisit);
  const { saveOrganization, isSavingOrganization } = useShoppingItemActions();
  const [isFinishing, setIsFinishing] = useState(false);
  // Reached from the camera this screen closes a trip in progress; reached
  // from the shortlist it is just an organizer over an old one. The copy has
  // to follow, or "Keep shooting" offers a camera that is not there.
  const isLiveVisit = currentSession?.id === sessionId;

  // The raw snaps keep the full-size local file as `imageUri`; the displayed
  // ones swap in the small preview. Deletion has to go through the raw snap,
  // or it would remove the preview and orphan the photo it stands for.
  const rawSnaps = useMemo(() => mergeShoppingSnaps(remoteSnaps, pendingUploads)
    .filter((snap) => snap.shoppingSessionId === sessionId)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      || a.captureSequence - b.captureSequence), [pendingUploads, remoteSnaps, sessionId]);
  const snaps = useMemo(
    () => applyShoppingPreviewUris(rawSnaps, visitPreviews, pendingUploads),
    [pendingUploads, rawSnaps, visitPreviews],
  );

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
    navigation.reset({
      index: 1,
      routes: [{ name: 'ShopMain' }, { name: 'ShoppingGallery' }],
    });
  }, [endVisit, navigation, sessionId]);

  const handleSave = useCallback(async (updates: ShoppingSnapOrganizationUpdate[]) => {
    setIsFinishing(true);
    try {
      await saveOrganization(updates);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      finish();
    } catch (error) {
      Alert.alert(
        'Could not save grouping',
        error instanceof Error ? error.message : 'Please try again.',
      );
      throw error;
    } finally {
      setIsFinishing(false);
    }
  }, [finish, saveOrganization]);

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
      await deleteShoppingSnaps(targets, user?.id ?? null);
      previews.forEach((preview) => deleteShoppingPreview(preview.previewUri));
    } catch (error) {
      Alert.alert(
        'Could not remove photos',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [rawSnaps, user?.id]);

  const confirmRemove = useCallback((snapIds: string[]) => {
    const count = snapIds.length;
    Alert.alert(
      count === 1 ? 'Remove this photo?' : `Remove ${count} photos?`,
      // Deleting reseeds the organizer from what is left, which discards any
      // regrouping not yet saved. Say so rather than let it look like a bug.
      'It will be deleted from this visit. Unsaved grouping changes will be reset.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void removeSnaps(snapIds) },
      ],
    );
  }, [removeSnaps]);

  // Nothing was photographed — there is no review to do, so close the visit
  // out rather than parking on an empty organizer.
  useEffect(() => {
    if (!isLoading && snaps.length === 0) finish();
  }, [finish, isLoading, snaps.length]);

  if (snaps.length === 0) return <View style={styles.root} />;

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
        onClose={handleClose}
        onSave={handleSave}
        onRemove={confirmRemove}
        isSaving={isSavingOrganization || isFinishing}
        eyebrow={header.eyebrow}
        title={header.title}
        subtitle={header.meta}
        saveLabel={isLiveVisit ? 'Finish visit' : 'Done'}
        closeLabel={isLiveVisit ? 'Keep shooting' : 'Back'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
