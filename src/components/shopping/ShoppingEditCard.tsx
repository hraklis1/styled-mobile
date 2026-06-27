import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import {
  formatShoppingPrice,
  itemRoleSummary,
  shoppingCatalogChips,
  shoppingItemBadges,
} from '../../lib/shoppingPresentation';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';
import type { ShoppingSnap } from '../../types/shoppingSnap';

export function ShoppingEditCard({
  item,
  width,
  isSelected,
  selectionMode,
  onPress,
  onLongPress,
}: {
  item: ShoppingEditItem;
  width: number;
  isSelected: boolean;
  selectionMode: boolean;
  onPress: (snap: ShoppingSnap) => void;
  onLongPress: () => void;
}) {
  const price = formatShoppingPrice(item.extractedPrice);
  const badges = shoppingItemBadges(item);
  const catalogChips = shoppingCatalogChips(item);
  const accessibilityStateLabel = item.needsReview
    ? ', needs review'
    : item.syncStatus === 'pending'
      ? ', waiting to sync'
      : '';

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
        <Image
          source={{ uri: item.primarySnap.imageUri }}
          style={StyleSheet.absoluteFill}
          contentFit={item.primarySnap.captureRole === 'garment' ? 'contain' : 'cover'}
          contentPosition="center"
          cachePolicy="memory-disk"
          recyclingKey={item.primarySnap.id}
          transition={220}
        />
        <LinearGradient
          colors={['rgba(20, 15, 12, 0.04)', 'transparent', 'rgba(20, 15, 12, 0.28)']}
          style={StyleSheet.absoluteFill}
          locations={[0, 0.55, 1]}
        />
        <View style={styles.topOverlay}>
          {price ? (
            <View style={[styles.priceBadge, selectionMode && styles.priceBadgeSelecting]}>
              <Text style={styles.priceBadgeText}>{price}</Text>
            </View>
          ) : (
            <View style={[styles.priceBadge, styles.priceBadgeMuted, selectionMode && styles.priceBadgeSelecting]}>
              <Text style={[styles.priceBadgeText, styles.priceBadgeTextMuted]}>No price</Text>
            </View>
          )}
          {selectionMode ? (
            <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeActive]}>
              {isSelected ? <Ionicons name="checkmark" size={16} color={colors.primaryForeground} /> : null}
            </View>
          ) : null}
        </View>
        <View style={styles.photoCountPill}>
          <Ionicons name={item.photoCount > 1 ? 'albums-outline' : 'image-outline'} size={13} color="#FFFFFF" />
          <Text style={styles.photoCountText}>{item.photoCount}</Text>
        </View>
      </View>

      <View style={styles.copy}>
        <View style={styles.copyTopRow}>
          <Text style={styles.storeText} numberOfLines={1}>{item.storeName ?? 'Store not set'}</Text>
          {item.syncStatus === 'pending' ? (
            <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} />
          ) : null}
        </View>
        <Text style={styles.roleText} numberOfLines={1}>{itemRoleSummary(item)}</Text>
        {catalogChips.length > 0 ? (
          <Text style={styles.catalogText} numberOfLines={1}>{catalogChips.join(' · ')}</Text>
        ) : null}
        <View style={styles.badgeRow}>
          {badges.map((badge) => (
            <View
              key={badge.key}
              style={[
                styles.badge,
                badge.tone === 'attention' && styles.badgeAttention,
                badge.tone === 'success' && styles.badgeSuccess,
              ]}
            >
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceElevated,
    ...shadows.sm,
  },
  cardSelected: { borderWidth: 3, borderColor: colors.primary },
  imageFrame: {
    aspectRatio: 0.88,
    overflow: 'hidden',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  topOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  priceBadge: {
    maxWidth: 112,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: 'rgba(250, 248, 245, 0.96)',
  },
  priceBadgeMuted: { backgroundColor: 'rgba(24, 20, 18, 0.62)' },
  priceBadgeSelecting: { marginLeft: 38 },
  priceBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  priceBadgeTextMuted: { color: '#FFFFFF' },
  selectionBadge: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 15,
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
  roleText: { fontSize: 11, color: colors.mutedForeground },
  catalogText: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },
  badgeRow: { minHeight: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge: {
    maxWidth: '100%',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  badgeAttention: { backgroundColor: colors.accent },
  badgeSuccess: { backgroundColor: '#E6F1E9' },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
  },
  badgeTextAttention: { color: colors.primary },
  badgeTextSuccess: { color: colors.success },
});
