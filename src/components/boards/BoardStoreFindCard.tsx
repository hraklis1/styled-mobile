import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';
import type { StoreFind } from '../../types/storeFind';

type Props = {
  storeFind: StoreFind;
  cardWidth: number;
};

export function BoardStoreFindCard({ storeFind, cardWidth }: Props) {
  const hasImage = !!storeFind.imageUrl;
  
  return (
    <View style={[styles.root, { width: cardWidth, height: cardWidth * 1.25 }]}>
      {hasImage ? (
        <Image source={{ uri: storeFind.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Ionicons name="camera-outline" size={32} color={colors.mutedForeground} />
        </View>
      )}
      
      <View style={styles.badge}>
        <Ionicons name="location-outline" size={12} color="#fff" />
        <Text style={styles.badgeText} numberOfLines={1}>
          {storeFind.store || storeFind.brand || 'Store Find'}
        </Text>
      </View>

      <View style={styles.details}>
        <Text style={styles.priceText}>
          {storeFind.price != null ? `$${storeFind.price.toFixed(2)}` : 'Price unknown'}
        </Text>
        {!!storeFind.size && (
          <Text style={styles.sizeText}>Size: {storeFind.size}</Text>
        )}
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
  badge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
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
  details: {
    padding: spacing.xs,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
});
