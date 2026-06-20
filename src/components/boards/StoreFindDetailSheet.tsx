import { useState, useCallback, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, Linking, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';
import type { StoreFind } from '../../types/storeFind';

type Props = {
  storeFind: StoreFind | null;
  onClose: () => void;
  onEdit?: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
  onMarkPurchased?: () => void;
  onArchive?: () => void;
};

const PHOTO_HEIGHT = 320;

export function StoreFindDetailSheet({ storeFind, onClose, onEdit, onRetry, onDelete, onMarkPurchased, onArchive }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Reset to first photo whenever a different find is opened.
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [storeFind?.id]);

  const handlePhotoScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
      setCurrentPhotoIndex(idx);
    },
    [screenWidth],
  );

  const photos =
    storeFind?.imageUrls && storeFind.imageUrls.length > 0
      ? storeFind.imageUrls
      : storeFind?.imageUrl
      ? [storeFind.imageUrl]
      : [];
  const formattedPrice = storeFind?.price != null
    ? new Intl.NumberFormat(undefined, {
        style: 'currency', currency: storeFind.currency ?? 'USD', maximumFractionDigits: 2,
      }).format(storeFind.price)
    : null;

  const openInMaps = useCallback(async () => {
    if (!storeFind) return;
    const coordinates = storeFind.locationData;
    const query = coordinates
      ? `${coordinates.latitude},${coordinates.longitude}`
      : storeFind.location || storeFind.store;
    if (!query) return;
    const url = `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Maps unavailable', 'This location could not be opened.');
    }
  }, [storeFind]);

  return (
    <Modal
      visible={storeFind !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {storeFind?.store || storeFind?.brand || 'Store Find'}
          </Text>
          {onEdit ? (
            <TouchableOpacity
              onPress={onEdit}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.closeBtn} />
          )}
        </View>

        {storeFind && (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {photos.length > 0 ? (
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={{ width: screenWidth, height: PHOTO_HEIGHT }}
                  onScroll={handlePhotoScroll}
                  scrollEventThrottle={16}
                >
                  {photos.map((uri, idx) => (
                    <Image
                      key={`${storeFind.id}-${idx}`}
                      source={{ uri }}
                      style={{ width: screenWidth, height: PHOTO_HEIGHT }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      recyclingKey={`${storeFind.id}-${idx}`}
                      transition={150}
                    />
                  ))}
                </ScrollView>
                {photos.length > 1 && (
                  <View style={styles.dotRow}>
                    {photos.map((_, i) => (
                      <View
                        key={i}
                        style={[styles.dot, i === currentPhotoIndex && styles.dotActive]}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.photoPlaceholder, { height: PHOTO_HEIGHT }]}>
                <Ionicons name="camera-outline" size={40} color={colors.mutedForeground} />
              </View>
            )}

            <View style={styles.details}>
              {!!storeFind.tagImageUrl && (
                <View style={styles.tagPhotoSection}>
                  <View style={styles.tagPhotoHeading}>
                    <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
                    <Text style={styles.tagPhotoTitle}>Tag photo</Text>
                  </View>
                  <Image
                    source={{ uri: storeFind.tagImageUrl }}
                    style={styles.tagPhoto}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                  />
                </View>
              )}
              {!!storeFind.description && (
                <Text style={styles.descriptionText}>{storeFind.description}</Text>
              )}

              <View style={styles.pillRow}>
                {!!formattedPrice && (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{formattedPrice}</Text>
                  </View>
                )}
                {!!storeFind.size && (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Size {storeFind.size}</Text>
                  </View>
                )}
                {!!storeFind.location && (
                  <View style={[styles.pill, styles.locationPill]}>
                    <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.pillText, styles.locationPillText]}>{storeFind.location}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.captureDate}>
                Saved {new Date(storeFind.createdAt).toLocaleDateString(undefined, {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </Text>

              {storeFind.syncStatus && storeFind.syncStatus !== 'synced' && (
                <View style={styles.syncBlock}>
                  <Ionicons
                    name={storeFind.syncStatus === 'failed' ? 'cloud-offline-outline' : 'cloud-upload-outline'}
                    size={18}
                    color={colors.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.syncTitle}>
                      {storeFind.syncStatus === 'failed' ? 'Sync failed — saved on this device' : 'Waiting to sync'}
                    </Text>
                    {!!storeFind.syncError && <Text style={styles.syncMessage}>{storeFind.syncError}</Text>}
                  </View>
                  {onRetry && (
                    <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
                      <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {(storeFind.locationData || storeFind.location) && (
                <TouchableOpacity style={styles.mapButton} onPress={openInMaps}>
                  <Ionicons name="map-outline" size={18} color={colors.primaryForeground} />
                  <Text style={styles.mapButtonText}>Open location in Maps</Text>
                </TouchableOpacity>
              )}

              {onMarkPurchased && storeFind.status !== 'purchased' && (
                <TouchableOpacity style={styles.purchasedButton} onPress={onMarkPurchased}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.purchasedButtonText}>Purchased · Add to closet</Text>
                </TouchableOpacity>
              )}

              {onDelete && (
                <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                  <Ionicons name="trash-outline" size={17} color={colors.destructive} />
                  <Text style={styles.deleteButtonText}>Delete find</Text>
                </TouchableOpacity>
              )}

              {onArchive && (
                <TouchableOpacity style={styles.deleteButton} onPress={onArchive}>
                  <Ionicons name="archive-outline" size={17} color={colors.mutedForeground} />
                  <Text style={styles.archiveButtonText}>Archive find</Text>
                </TouchableOpacity>
              )}

              {(!!storeFind.store || !!storeFind.brand) && (
                <View style={styles.metaRow}>
                  {!!storeFind.store && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Store</Text>
                      <Text style={styles.metaValue}>{storeFind.store}</Text>
                    </View>
                  )}
                  {!!storeFind.brand && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Brand</Text>
                      <Text style={styles.metaValue}>{storeFind.brand}</Text>
                    </View>
                  )}
                </View>
              )}

              {!!storeFind.notes && (
                <View style={styles.notesBlock}>
                  <Text style={styles.metaLabel}>Notes</Text>
                  <Text style={styles.notesText}>{storeFind.notes}</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: spacing.xxxl,
  },
  photoPlaceholder: {
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  tagPhotoSection: { gap: spacing.sm },
  tagPhotoHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tagPhotoTitle: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  tagPhoto: { width: 132, height: 132, borderRadius: radii.lg, backgroundColor: colors.secondary },
  captureDate: { color: colors.mutedForeground, fontSize: typography.size.xs },
  syncBlock: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
  },
  syncTitle: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  syncMessage: { color: colors.mutedForeground, fontSize: typography.size.xs, marginTop: 2 },
  retryButton: { minWidth: 52, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  mapButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  mapButtonText: { color: colors.primaryForeground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  purchasedButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  purchasedButtonText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  deleteButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  deleteButtonText: { color: colors.destructive, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  archiveButtonText: { color: colors.mutedForeground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  descriptionText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.secondary,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationPillText: {
    fontWeight: typography.weight.regular,
    color: colors.mutedForeground,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  metaItem: {
    gap: 2,
  },
  metaLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: typography.size.md,
    color: colors.foreground,
  },
  notesBlock: {
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  notesText: {
    fontSize: typography.size.md,
    color: colors.foreground,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: 6,
    backgroundColor: colors.background,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
