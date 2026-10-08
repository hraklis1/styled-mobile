import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import { getItemCardAccessibilityLabel } from '../../lib/closet-presentation';
import type { Item } from '../../types/item';
import { PressableScale } from '../primitives/PressableScale';
import { GarmentImage } from './garment-image';
import { PolishingBadge } from './PolishingBadge';
import { CATEGORY_LABELS } from '../../types/item';
import { SelectionCheck } from '../../features/closet-selection/SelectionCheck';

type Props = {
  item: Item;
  aspectRatio: number;
  cardWidth: number;
  onPress?: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  /** Something else is selected: recede so the selection reads at a glance. */
  dimmed?: boolean;
  onToggleSelect?: () => void;
  /** Board Detail can own the outer grid rhythm without changing Closet cards. */
  bottomSpacing?: number;
  /** Image-only tile for dense grids; the name lives in the accessibility label. */
  compact?: boolean;
};

function GarmentCardComponent({
  item,
  aspectRatio,
  cardWidth,
  onPress,
  onLongPress,
  selectionMode = false,
  isSelected = false,
  dimmed = false,
  onToggleSelect,
  bottomSpacing = spacing.gridRow,
  compact = false,
}: Props) {
  const imageHeight = cardWidth / aspectRatio;
  const handlePress = selectionMode ? onToggleSelect : onPress;


  const showConditionDot = item.condition === 'needs_repair' || item.condition === 'donate';
  const conditionColor = item.condition === 'donate' ? colors.error : '#D97706';

  const itemLabel = getItemCardAccessibilityLabel(item);

  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const selectedNow = selectionMode && isSelected;
  const dimNow = selectionMode && dimmed && !isSelected;
  useEffect(() => {
    const target = selectedNow ? 0.94 : 1;
    scale.value = reduceMotion ? target : withSpring(target, { damping: 18, stiffness: 260 });
    opacity.value = withTiming(dimNow ? 0.82 : 1, { duration: 160 });
  }, [selectedNow, dimNow, reduceMotion, scale, opacity]);
  const plateStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  return (
    <PressableScale
      contentStyle={[styles.card, { width: cardWidth, marginBottom: bottomSpacing }]}
      onPress={handlePress}
      onLongPress={selectionMode ? undefined : onLongPress}
      delayLongPress={450}
      layout={LinearTransition.springify().damping(16).stiffness(200)}
      accessibilityRole="button"
      accessibilityLabel={selectionMode ? `${itemLabel}, ${isSelected ? 'selected' : 'not selected'}` : itemLabel}
      accessibilityState={selectionMode ? { selected: isSelected } : undefined}
    >
      <View style={[styles.plateWell, selectedNow && styles.plateWellSelected]}>
        <Animated.View style={plateStyle}>
          <GarmentImage item={item} width={cardWidth} height={imageHeight}>
            {selectedNow && <View style={styles.selectedOverlay} />}

            {!selectionMode && <PolishingBadge itemId={item.id} />}

            {/* Favorite heart — top-right, hidden in selection mode */}
            {!selectionMode && item.isFavorite && (
              <View style={styles.favBadge}>
                <Ionicons name="heart" size={12} color={colors.primary} />
              </View>
            )}

            {/* Condition warning dot — bottom-left */}
            {!selectionMode && showConditionDot && (
              <View style={[styles.conditionDot, { backgroundColor: conditionColor }]} />
            )}
          </GarmentImage>
        </Animated.View>

        {/* Outside the scaled plate so the check stays pinned to the corner. */}
        {selectionMode && <SelectionCheck selected={isSelected} onPhoto style={styles.selectionBadge} />}
      </View>

      {!compact && (
        <View style={[styles.info, dimNow && styles.infoDimmed]}>
          {/* Maker first, like a shop tag; category stands in when there's no brand. */}
          <Text style={styles.eyebrow} numberOfLines={1}>
            {item.brand?.trim() || (item.category ? CATEGORY_LABELS[item.category] : ' ')}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {item.name || 'Unnamed Item'}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

export const GarmentCard = React.memo(GarmentCardComponent);

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.gridRow,
  },
  plateWell: {
    borderRadius: radii.photo,
    backgroundColor: colors.surfaceSelected,
  },
  plateWellSelected: {
    // The well shows around the shrunken plate as a quiet inset frame.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.controlOutline,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(36, 36, 34, 0.06)',
  },
  selectionBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  infoDimmed: { opacity: 0.6 },
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
    paddingTop: 10, gap: 2,
  },
  eyebrow: {
    ...typography.text.eyebrow, fontSize: 10, letterSpacing: 1, color: colors.mutedForeground,
  },
  name: {
    ...typography.text.productName, color: colors.foreground,
  },
});
