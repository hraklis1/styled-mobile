import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import {
  formatShoppingPrice,
  itemRoleSummary,
  shoppingCatalogChips,
  shoppingItemBadges,
} from '../../lib/shoppingPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';
import type { ShoppingSnap } from '../../types/shoppingSnap';

function fallbackIcon(category: string | null): keyof typeof Ionicons.glyphMap {
  const value = category?.toLowerCase() ?? '';
  if (/outerwear|coat|jacket|blazer/.test(value)) return 'layers-outline';
  if (/shoe|boot|sneaker|heel|footwear/.test(value)) return 'footsteps-outline';
  if (/bag|purse|tote/.test(value)) return 'bag-handle-outline';
  if (/accessor|jewel|watch|belt|scarf|hat/.test(value)) return 'diamond-outline';
  return 'shirt-outline';
}

export function ShoppingEditCard({
  item,
  width,
  isSelected,
  selectionMode,
  showStore = true,
  onPress,
  onLongPress,
}: {
  item: ShoppingEditItem;
  width: number;
  isSelected: boolean;
  selectionMode: boolean;
  /** Off inside a trip bundle, whose header already names the store. */
  showStore?: boolean;
  onPress: (snap: ShoppingSnap) => void;
  onLongPress: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const currencyCode = useCurrencyCode();
  const price = formatShoppingPrice(item.extractedPrice, currencyCode);
  const badges = shoppingItemBadges(item);
  const title = showStore ? item.storeName ?? 'Store not set' : item.category;
  const catalogChips = shoppingCatalogChips(showStore ? item : { ...item, category: null });
  const accessibilityStateLabel = item.needsReview
    ? ', needs review'
    : item.syncStatus === 'pending'
      ? ', waiting to sync'
      : '';

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
  }, [item.primarySnap.id, item.primarySnap.imageUri]);

  return (
    <TouchableOpacity
      style={[styles.card, { width }, isSelected && styles.cardSelected]}
      activeOpacity={0.9}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress(item.primarySnap);
      }}
      onLongPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onLongPress();
      }}
      accessibilityLabel={`${item.storeName ?? 'Shopping'} item${price ? `, ${price}` : ''}${accessibilityStateLabel}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.imageFrame}>
        <View style={styles.imageSkeleton} />
        {!imageFailed ? (
          <Image
            source={{ uri: item.primarySnap.imageUri }}
            style={[StyleSheet.absoluteFill, !imageLoaded && styles.imagePending]}
            contentFit={item.primarySnap.captureRole === 'garment' ? 'contain' : 'cover'}
            contentPosition="center"
            cachePolicy="memory-disk"
            recyclingKey={item.primarySnap.id}
            transition={220}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.imageFallback}>
            <View style={styles.fallbackEmblem}>
              <Ionicons name={fallbackIcon(item.category)} size={28} color={colors.primary} />
            </View>
            <Text style={styles.fallbackText}>Preview unavailable</Text>
          </View>
        )}
        {item.primarySnap.captureRole === 'unknown' && !imageFailed ? (
          <View style={styles.unsortedVeil}>
            <View style={styles.unsortedLabel}>
              <View style={styles.unsortedDot} />
              <Text style={styles.unsortedText}>Unsorted photo</Text>
            </View>
          </View>
        ) : null}
        {imageLoaded && !imageFailed ? (
          <LinearGradient
            colors={['transparent', 'rgba(20, 15, 12, 0.24)']}
            style={styles.bottomGradient}
          />
        ) : null}
        {selectionMode ? (
          <View style={styles.topOverlay}>
            <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeActive]}>
              {isSelected ? <Ionicons name="checkmark" size={16} color={colors.primaryForeground} /> : null}
            </View>
          </View>
        ) : null}
        <View style={styles.photoCountPill}>
          <Ionicons name={item.photoCount > 1 ? 'albums-outline' : 'image-outline'} size={13} color="#FFFFFF" />
          <Text style={styles.photoCountText}>{item.photoCount}</Text>
        </View>
      </View>

      <View style={styles.copy}>
        {title ? (
          <View style={styles.copyTopRow}>
            <Text style={styles.storeText} numberOfLines={1}>{title}</Text>
            {item.syncStatus === 'pending' ? (
              <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} />
            ) : null}
          </View>
        ) : null}
        <View style={styles.detailRow}>
          <Text style={styles.roleText} numberOfLines={1}>{itemRoleSummary(item)}</Text>
          {price ? <Text style={styles.priceText} numberOfLines={1}>{price}</Text> : null}
        </View>
        {catalogChips.length > 0 ? (
          <Text style={styles.catalogText} numberOfLines={1}>{catalogChips.join(' · ')}</Text>
        ) : null}
        <View style={styles.badgeRow} pointerEvents="none">
          {badges.map((badge) => (
            <View key={badge.key} style={styles.badge}>
              <View style={[
                styles.badgeDot,
                badge.tone === 'attention' && styles.badgeDotAttention,
                badge.tone === 'success' && styles.badgeDotSuccess,
              ]} />
              <Text
                style={[
                  styles.badgeText,
                  badge.tone === 'attention' && styles.badgeTextAttention,
                  badge.tone === 'success' && styles.badgeTextSuccess,
                ]}
                numberOfLines={1}
              >
                {badge.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {isSelected ? <View pointerEvents="none" style={styles.selectionRing} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceElevated,
    boxShadow: '0 2px 8px rgba(40, 35, 31, 0.06)',
  },
  cardSelected: { boxShadow: '0 2px 10px rgba(111, 89, 72, 0.14)' },
  selectionRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  imageFrame: {
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  imageSkeleton: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.surfaceSubtle },
  imagePending: { opacity: 0 },
  imageFallback: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  fallbackEmblem: { width: 58, height: 58, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.primary}10` },
  fallbackText: { fontSize: typography.size.xs, color: colors.mutedForeground },
  unsortedVeil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'flex-start', justifyContent: 'flex-start', padding: spacing.sm, backgroundColor: 'rgba(251, 250, 247, 0.36)' },
  unsortedLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radii.full, backgroundColor: 'rgba(251, 250, 247, 0.92)' },
  unsortedDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  unsortedText: { fontSize: 10, fontWeight: typography.weight.medium, color: colors.primary },
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 },
  topOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionBadge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 16,
    backgroundColor: 'rgba(24, 20, 18, 0.42)',
  },
  selectionBadgeActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  photoCountPill: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    minWidth: 34,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    backgroundColor: 'rgba(24, 20, 18, 0.62)',
  },
  photoCountText: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  copy: { gap: spacing.xs, padding: spacing.sm },
  copyTopRow: { minHeight: 18, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  storeText: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  detailRow: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  roleText: { flex: 1, fontSize: 11, color: colors.mutedForeground },
  priceText: { flexShrink: 0, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground, fontVariant: ['tabular-nums'] },
  catalogText: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },
  badgeRow: { minHeight: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  badge: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mutedForeground },
  badgeDotAttention: { backgroundColor: colors.primary },
  badgeDotSuccess: { backgroundColor: colors.success },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  badgeTextAttention: { color: colors.primary },
  badgeTextSuccess: { color: colors.success },
});
