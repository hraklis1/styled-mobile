import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';
import type { StoreFind } from '../../types/storeFind';

type Props = {
  storeFind: StoreFind;
  cardWidth: number;
};

function formatPrice(storeFind: StoreFind): string | null {
  if (storeFind.price == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: storeFind.currency ?? 'USD', maximumFractionDigits: 2,
    }).format(storeFind.price);
  } catch {
    return `$${storeFind.price.toFixed(2)}`;
  }
}

function formatFindDate(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const difference = Math.round((today - day) / 86_400_000);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function BoardStoreFindCard({ storeFind, cardWidth }: Props) {
  const primaryImage = storeFind.imageUrls?.[0] ?? storeFind.imageUrl;
  const photoCount = storeFind.imageUrls?.length ?? (storeFind.imageUrl ? 1 : 0);
  const price = formatPrice(storeFind);

  return (
    <View style={[styles.root, { width: cardWidth, height: cardWidth * 1.25 }]}>
      {primaryImage ? (
        <Image
          source={{ uri: primaryImage }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={storeFind.id}
          transition={150}
        />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Ionicons name="camera-outline" size={32} color={colors.mutedForeground} />
        </View>
      )}

      {primaryImage && (
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
          style={styles.topGradient}
          pointerEvents="none"
        />
      )}

      <View style={styles.badge}>
        <Ionicons name="location-outline" size={12} color="#fff" />
        <Text style={styles.badgeText} numberOfLines={1}>
          {storeFind.store || storeFind.brand || 'Store Find'}
        </Text>
      </View>

      {photoCount > 1 && (
        <View style={styles.photoCountBadge}>
          <Ionicons name="camera" size={10} color="#fff" />
          <Text style={styles.photoCountText}>{photoCount}</Text>
        </View>
      )}

      {storeFind.syncStatus && storeFind.syncStatus !== 'synced' && (
        <View style={styles.syncBadge}>
          <Ionicons
            name={storeFind.syncStatus === 'failed' ? 'cloud-offline-outline' : 'cloud-upload-outline'}
            size={11}
            color="#fff"
          />
          <Text style={styles.syncText}>
            {storeFind.syncStatus === 'failed' ? 'Sync failed' : 'Waiting to sync'}
          </Text>
        </View>
      )}

      <View style={styles.details}>
        {!!storeFind.description && (
          <Text style={styles.descriptionText} numberOfLines={1}>{storeFind.description}</Text>
        )}
        {!!price && <Text style={styles.priceText}>{price}</Text>}
        {!!storeFind.size && (
          <Text style={styles.sizeText}>Size: {storeFind.size}</Text>
        )}
        <Text style={styles.dateText}>{formatFindDate(storeFind.createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.secondary,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    zIndex: 1,
  },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
    gap: 2,
    maxWidth: '90%',
  },
  badgeText: {
    color: '#fff',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: spacing.xs + 36, // above the details section
    right: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
    zIndex: 2,
  },
  photoCountText: {
    color: '#fff',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  syncBadge: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs + 36,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: 'rgba(40,35,31,0.78)',
  },
  syncText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: typography.weight.semibold,
  },
  details: {
    padding: spacing.xs,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  descriptionText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    marginBottom: 2,
  },
  priceText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  sizeText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  dateText: { fontSize: 10, color: colors.mutedForeground, marginTop: 2 },
});
