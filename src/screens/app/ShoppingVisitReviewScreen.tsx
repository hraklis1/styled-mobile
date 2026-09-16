import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View, StyleSheet, Text, ScrollView, TouchableOpacity } from 'react-native';

import { ShoppingPhotoOrganizer } from '../../components/shopping/ShoppingPhotoOrganizer';
import { useShoppingItemActions } from '../../hooks/useShoppingItemActions';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { deleteShoppingPreview } from '../../lib/shoppingPreviews';
import { buildShoppingEditItems, mergeShoppingSnaps } from '../../lib/shoppingGallery';
import type { ShoppingSnapOrganizationUpdate } from '../../lib/shoppingSnapOrganizer';
import type { ShoppingVisitReviewScreenProps } from '../../navigation/types';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { colors, radii, spacing, typography } from '../../theme';

/**
 * Where a shopping visit ends. The camera now closes into this screen instead
 * of dropping the shopper back on the Shop tab, because the moment they stop
 * shooting is the only moment they still remember which photos were which.
 *
 * Photos arrive grouped by the item selected in the camera, so
 * the primary action is to accept it. Correcting it is optional and costs one
 * tap; that is the whole point of landing here rather than being asked to
 * sort a photo dump days later.
 */
export function ShoppingVisitReviewScreen({ navigation, route }: ShoppingVisitReviewScreenProps) {
  const insets = useSafeAreaInsets();
  const [organizing, setOrganizing] = useState(false);
  const { sessionId } = route.params;
  const { data: remoteSnaps = [], isLoading } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const currentSessionId = useShoppingSessionStore((state) => state.currentSession?.id ?? null);
  const endVisit = useShoppingSessionStore((state) => state.endVisit);
  const { saveOrganization, isSavingOrganization } = useShoppingItemActions();
  const [isFinishing, setIsFinishing] = useState(false);
  // Reached from the camera this screen closes a trip in progress; reached
  // from the shortlist it is just an organizer over an old one. The copy has
  // to follow, or "Keep shooting" offers a camera that is not there.
  const isLiveVisit = currentSessionId === sessionId;

  const snaps = useMemo(() => mergeShoppingSnaps(remoteSnaps, pendingUploads)
    .filter((snap) => snap.shoppingSessionId === sessionId)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      || a.captureSequence - b.captureSequence),
  [pendingUploads, remoteSnaps, sessionId]);

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

  // Nothing was photographed — there is no review to do, so close the visit
  // out rather than parking on an empty organizer.
  useEffect(() => {
    if (!isLoading && snaps.length === 0) finish();
  }, [finish, isLoading, snaps.length]);

  if (snaps.length === 0) return <View style={styles.root} />;

  // Preserve the camera's item order, even when an earlier item gets another photo.
  const groupOrder = [...new Set(snaps.map((snap) => snap.captureGroupId))];
  const pieces = buildShoppingEditItems(snaps).sort((a, b) =>
    groupOrder.indexOf(a.captureGroupId) - groupOrder.indexOf(b.captureGroupId));
  if (!organizing) return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.summaryContent}>
        <Text style={styles.eyebrow}>{isLiveVisit ? 'THIS VISIT' : 'EARLIER VISIT'}</Text>
        <Text style={styles.title}>Your photos, together</Text>
        <Text style={styles.summaryCount}>
          {pieces.length} {pieces.length === 1 ? 'item' : 'items'} · {snaps.length} {snaps.length === 1 ? 'photo' : 'photos'}
        </Text>
        <Text style={styles.subtitle}>A quick look at what you captured. You can adjust the grouping now or come back later.</Text>
        {pieces.map((piece, index) => (
          <View key={piece.id} style={styles.itemCard}>
            <View style={styles.itemHeading}>
              <Text style={styles.itemTitle}>Item {index + 1}</Text>
              <Text style={styles.photoCount}>{piece.photoCount} {piece.photoCount === 1 ? 'photo' : 'photos'}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={piece.photoCount > 2} contentContainerStyle={styles.photoStrip}>
              {piece.snaps.map((snap, photoIndex) => (
                <View key={snap.id} style={styles.photoTile}>
                  <Image
                    source={{ uri: snap.imageUri }}
                    style={styles.photo}
                    contentFit="contain"
                    recyclingKey={snap.id}
                    accessible
                    accessibilityLabel={`Item ${index + 1}, photo ${photoIndex + 1}${snap.captureRole === 'tag' ? ', tag' : ''}`}
                  />
                  <Text style={styles.photoLabel}>{snap.captureRole === 'tag' ? 'Tag' : `Photo ${photoIndex + 1}`}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
      <View style={[styles.summaryActions, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity style={styles.doneButton} onPress={finish} accessibilityRole="button">
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setOrganizing(true)} accessibilityRole="button">
            <Text style={styles.adjustText}>Adjust grouping</Text>
          </TouchableOpacity>
          {isLiveVisit ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleClose} accessibilityRole="button">
              <Text style={styles.keepShootingText}>Keep shooting</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
  return (
    <View style={styles.root}>
      <ShoppingPhotoOrganizer
        snaps={snaps}
        onClose={() => setOrganizing(false)}
        onSave={handleSave}
        isSaving={isSavingOrganization || isFinishing}
        eyebrow={isLiveVisit ? 'THIS VISIT' : 'EARLIER VISIT'}
        title="Everything you photographed"
        subtitle="Grouped for you. Adjust anything, or just save."
        saveLabel="Done"
        closeLabel={isLiveVisit ? 'Keep shooting' : 'Cancel'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  summaryContent: { padding: spacing.lg, gap: spacing.md },
  eyebrow: { ...typography.text.caption, fontWeight: typography.weight.bold, letterSpacing: 1.5, color: colors.primary },
  title: { ...typography.text.editorialTitle, color: colors.foreground },
  summaryCount: { ...typography.text.body, fontWeight: typography.weight.semibold, color: colors.foreground },
  subtitle: { ...typography.text.bodySmall, color: colors.mutedForeground, lineHeight: 22, marginBottom: spacing.sm },
  itemCard: { padding: spacing.md, gap: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
  itemHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  itemTitle: { ...typography.text.body, fontWeight: typography.weight.semibold, color: colors.foreground },
  photoCount: { ...typography.text.caption, color: colors.mutedForeground },
  photoStrip: { gap: spacing.sm, paddingBottom: spacing.xs },
  photoTile: { width: 112, gap: spacing.xs },
  photo: { width: 112, height: 140, borderRadius: radii.sm, backgroundColor: colors.background },
  photoLabel: { ...typography.text.caption, textAlign: 'center', color: colors.mutedForeground },
  summaryActions: { padding: spacing.lg, gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  doneButton: { minHeight: 48, padding: spacing.md, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  doneButtonText: { ...typography.text.body, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  secondaryButton: { minHeight: 44, padding: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  adjustText: { ...typography.text.bodySmall, color: colors.action, fontWeight: typography.weight.medium },
  keepShootingText: { ...typography.text.bodySmall, color: colors.foreground, fontWeight: typography.weight.medium },
});
