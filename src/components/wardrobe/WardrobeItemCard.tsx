import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';
import { resolveImageUri } from '../../lib/resolveImageUri';
import type { Item } from '../../types/item';

const COLUMN_COUNT = 2;
const COLUMN_GAP = spacing.md;
const SIDE_PADDING = spacing.lg;

type Props = {
  item: Item;
  onPress?: () => void;
  onLongPress?: () => void;
  onFavorite?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
};

export function WardrobeItemCard({
  item,
  onPress,
  onLongPress,
  onFavorite,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - SIDE_PADDING * 2 - COLUMN_GAP) / COLUMN_COUNT;
  const imageHeight = cardWidth * 1.25; // 4:5 portrait ratio

  const imageUri = resolveImageUri(item.imageUrl);

  const handlePress = selectionMode ? onToggleSelect : onPress;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={handlePress}
      onLongPress={selectionMode ? undefined : onLongPress}
      delayLongPress={450}
      activeOpacity={0.85}
    >
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="shirt-outline" size={32} color={colors.border} />
          </View>
        )}

        {/* Selection checkbox — top-left */}
        {selectionMode && (
          <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeActive]}>
            {isSelected && <Ionicons name="checkmark" size={13} color={colors.primaryForeground} />}
          </View>
        )}

        {/* Favourite heart — top-right (hidden in selection mode) */}
        {!selectionMode && (
          <TouchableOpacity
            style={styles.favoriteBadge}
            onPress={onFavorite}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={item.isFavorite ? 'heart' : 'heart-outline'}
              size={13}
              color={item.isFavorite ? '#E53E3E' : colors.mutedForeground}
            />
          </TouchableOpacity>
        )}

        {/* Selected overlay tint */}
        {selectionMode && isSelected && <View style={styles.selectedOverlay} />}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        {item.brand ? (
          <Text style={styles.brand} numberOfLines={1}>
            {item.brand}
          </Text>
        ) : null}
        {item.wearCount > 0 ? (
          <Text style={styles.wornCount}>Worn {item.wearCount}×</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  imageContainer: {
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(149, 109, 81, 0.15)', // primary color tint
  },
  selectionBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBadgeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  favoriteBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  info: {
    paddingTop: spacing.sm,
    paddingHorizontal: 2,
  },
  name: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  brand: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  wornCount: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
