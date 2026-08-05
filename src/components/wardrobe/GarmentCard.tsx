import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { getItemCardAccessibilityLabel } from '../../lib/closet-presentation';
import type { Item } from '../../types/item';
import { PressableScale } from '../primitives/PressableScale';
import { GarmentImage } from './garment-image';
import { ItemSecondaryMeta } from './item-secondary-meta';

type Props = {
  item: Item;
  aspectRatio: number;
  cardWidth: number;
  onPress?: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
};

function GarmentCardComponent({
  item,
  aspectRatio,
  cardWidth,
  onPress,
  onLongPress,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: Props) {
  const imageHeight = cardWidth / aspectRatio;
  const handlePress = selectionMode ? onToggleSelect : onPress;


  const showConditionDot = item.condition === 'needs_repair' || item.condition === 'donate';
  const conditionColor = item.condition === 'donate' ? colors.error : '#D97706';

  const itemLabel = getItemCardAccessibilityLabel(item);

  return (
    <PressableScale
      contentStyle={[styles.card, { width: cardWidth }]}
      onPress={handlePress}
      onLongPress={selectionMode ? undefined : onLongPress}
      delayLongPress={450}
      layout={LinearTransition.springify().damping(16).stiffness(200)}
      accessibilityRole="button"
      accessibilityLabel={selectionMode ? `${itemLabel}, ${isSelected ? 'selected' : 'not selected'}` : itemLabel}
      accessibilityState={selectionMode ? { selected: isSelected } : undefined}
    >
      <GarmentImage item={item} width={cardWidth} height={imageHeight}>
        {selectionMode && isSelected && <View style={styles.selectedOverlay} />}

        {selectionMode && (
          <View style={styles.selectionBadge}>
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={isSelected ? colors.primary : colors.white}
            />
          </View>
        )}

        {/* Favorite heart — top-right, hidden in selection mode */}
        {!selectionMode && item.isFavorite && (
          <View style={styles.favBadge}>
            <Ionicons name="heart" size={12} color={colors.primary} />
          </View>
        )}


        {/* Condition warning dot — bottom-left */}
        {showConditionDot && (
          <View style={[styles.conditionDot, { backgroundColor: conditionColor }]} />
        )}
      </GarmentImage>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name || 'Unnamed Item'}
        </Text>
        <ItemSecondaryMeta item={item} />
      </View>
    </PressableScale>
  );
}

export const GarmentCard = React.memo(GarmentCardComponent);

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    marginHorizontal: spacing.sm / 2,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(149, 109, 81, 0.12)',
  },
  selectionBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  favBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 21,
    height: 21,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,252,247,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  conditionDot: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.white,
  },
  info: {
    paddingTop: spacing.sm + 1,
    paddingHorizontal: 2,
    gap: 3,
    minHeight: 62,
  },
  name: {
    fontSize: typography.size.sm,
    lineHeight: 17,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    minHeight: 34,
  },
});
