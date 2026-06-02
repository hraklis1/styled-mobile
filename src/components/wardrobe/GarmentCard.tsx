import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { CATEGORY_LABELS } from '../../types/item';
import type { Item } from '../../types/item';

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
  const imageUri = resolveImageUri(item.imageUrl);
  const imageHeight = cardWidth / aspectRatio;
  const handlePress = selectionMode ? onToggleSelect : onPress;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={handlePress}
      onLongPress={selectionMode ? undefined : onLongPress}
      delayLongPress={450}
      activeOpacity={0.88}
    >
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="shirt-outline" size={28} color={colors.mutedForeground} />
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
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.category && CATEGORY_LABELS[item.category] ? (
          <Text style={styles.category} numberOfLines={1}>
            {CATEGORY_LABELS[item.category]}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export const GarmentCard = React.memo(GarmentCardComponent);

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
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
  info: {
    paddingTop: spacing.xs + 2,
    paddingHorizontal: 2,
    gap: 2,
  },
  name: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  category: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
});
