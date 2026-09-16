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
import { colors, spacing, typography } from '../../theme';

/**
 * Where a shopping visit ends. The camera now closes into this screen instead
 * of dropping the shopper back on the Shop tab, because the moment they stop
 * shooting is the only moment they still remember which photos were which.
 *
 * The grouping arrives already made — one item per shot, tags folded in — so
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

  const pieces = buildShoppingEditItems(snaps);
  if (!organizing) return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
      <Text style={{ ...typography.text.editorialTitle, color: colors.foreground }}>{pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'} saved</Text>
      <Text style={{ ...typography.text.body, marginVertical: spacing.lg, color: colors.mutedForeground }}>Your photos are saved on this phone. Revisit them whenever you’re ready.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>{pieces.map((piece) => <Image key={piece.id} source={{ uri: piece.primarySnap.imageUri }} style={{ width: '46%', aspectRatio: 0.8, backgroundColor: colors.surfaceSubtle }} contentFit="contain" />)}</View>
      <TouchableOpacity style={{ marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.primary, borderRadius: 8 }} onPress={finish}><Text style={{ color: colors.primaryForeground, textAlign: 'center' }}>Done</Text></TouchableOpacity>
      <TouchableOpacity style={{ padding: spacing.lg }} onPress={() => setOrganizing(true)}><Text style={{ color: colors.action, textAlign: 'center' }}>Adjust grouping</Text></TouchableOpacity>
      {isLiveVisit ? <TouchableOpacity style={{ padding: spacing.lg }} onPress={handleClose}><Text style={{ color: colors.foreground, textAlign: 'center' }}>Keep shooting</Text></TouchableOpacity> : null}
    </ScrollView>
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
});
