import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearTransition } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { CATEGORY_LABELS } from '../../types/item';
import type { Item } from '../../types/item';
import { PressableScale } from '../primitives/PressableScale';
import { NORMALIZED_COLOR_HEX } from '../../lib/colorUtils';
import type { NormalizedColor } from '../../types/item';

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

function resolveCardColor(item: Item): string | null {
  if (item.colorPalette?.length > 0) return item.colorPalette[0];
  if (item.colorNormalized) {
    return NORMALIZED_COLOR_HEX[item.colorNormalized as NormalizedColor] ?? null;
  }
  return null;
}

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
  const imageUri = resolveImageUri(item.imageUrl);
  const imageHeight = cardWidth / aspectRatio;
  const handlePress = selectionMode ? onToggleSelect : onPress;
  const colorHex = resolveCardColor(item);

  const showLaundry = !selectionMode && item.laundryStatus && item.laundryStatus !== 'clean';
  const laundryLabel = item.laundryStatus === 'in_wash' ? 'Washing' : 'Stored';
  const laundryColor = item.laundryStatus === 'in_wash' ? '#D97706' : '#6B7280';

  const showConditionDot = item.condition === 'needs_repair' || item.condition === 'donate';
  const conditionColor = item.condition === 'donate' ? colors.error : '#D97706';

  const itemLabel = [
    item.name || 'Unnamed item',
    item.brand || (item.category && CATEGORY_LABELS[item.category]),
  ].filter(Boolean).join(', ');

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
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={String(item.id)}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="shirt-outline" size={40} color={colors.mutedForeground} />
          </View>
        )}

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

        {/* Laundry status pill — top-left */}
        {showLaundry && (
          <View style={[styles.laundryPill, { borderColor: laundryColor + '55' }]}>
            <Text style={[styles.laundryText, { color: laundryColor }]}>{laundryLabel}</Text>
          </View>
        )}

        {/* Condition warning dot — bottom-left */}
        {showConditionDot && (
          <View style={[styles.conditionDot, { backgroundColor: conditionColor }]} />
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          {colorHex && (
            <View style={[styles.colorDot, { backgroundColor: colorHex }]} />
          )}
          <Text style={styles.name} numberOfLines={1}>
            {item.name || 'Unnamed Item'}
          </Text>
        </View>
        {item.brand ? (
          <Text style={styles.brand} numberOfLines={1}>{item.brand}</Text>
        ) : item.category && CATEGORY_LABELS[item.category] ? (
          <Text style={styles.category} numberOfLines={1}>
            {CATEGORY_LABELS[item.category]}
          </Text>
        ) : null}
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
  imageContainer: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#F2F2F2',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F2',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(149, 109, 81, 0.18)',
  },
  selectionBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  favBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  laundryPill: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  laundryText: {
    fontSize: 10,
    fontWeight: '600' as const,
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
    paddingTop: spacing.xs + 2,
    paddingHorizontal: 2,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  name: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    flex: 1,
  },
  brand: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  category: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
});
