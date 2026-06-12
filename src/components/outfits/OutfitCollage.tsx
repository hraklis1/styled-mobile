import { View, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, radii } from '../../theme';
import { useItems } from '../../hooks/useItems';
import type { Outfit } from '../../types/outfit';
import type { ItemCategory } from '../../types/item';
import { useMemo } from 'react';
import {
  getOutfitCategoryPriority,
  getOutfitMosaicRects,
  MAX_OUTFIT_MOSAIC_SLOTS,
} from './outfitMosaic';

type Props = {
  outfit: Outfit;
  size: number;
  height?: number;
  borderRadius?: number;
};

const EDITORIAL_MIN_SIZE = 260;

export function OutfitCollage({ outfit, size, height = size, borderRadius = radii.md }: Props) {
  const { data: items = [] } = useItems();

  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items]
  );

  const slots = useMemo(
    () =>
      (outfit.itemIds ?? [])
        .map((entry, originalIndex) => {
          const resolved = itemMap.get(entry.id);
          const category = resolved?.category ?? (entry.category as ItemCategory | null);
          return {
            uri: resolveImageUri(resolved?.imageUrl ?? null),
            ghost: !resolved,
            priority: getOutfitCategoryPriority(category),
            originalIndex,
          };
        })
        .sort((a, b) => a.priority - b.priority || a.originalIndex - b.originalIndex),
    [itemMap, outfit.itemIds],
  );

  // Prefer AI-generated image if available
  if (outfit.aiGeneratedImageUrl) {
    const uri = resolveImageUri(outfit.aiGeneratedImageUrl);
    return (
      <View style={[styles.container, { width: size, height, borderRadius }]}>
        <Image source={{ uri }} style={styles.fill} contentFit="cover" />
      </View>
    );
  }

  const total = slots.length;

  // Fewer than 2 items — show single large image, ghost, or empty placeholder
  if (total <= 1) {
    const slot = slots[0];
    return (
      <View style={[styles.container, { width: size, height, borderRadius }]}>
        {slot?.uri ? (
          <Image source={{ uri: slot.uri }} style={styles.fill} contentFit="cover" transition={150} />
        ) : slot?.ghost ? (
          <View style={styles.placeholder}>
            <Ionicons name="unlink-outline" size={Math.min(size, height) * 0.25} color={colors.border} />
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="layers-outline" size={Math.min(size, height) * 0.3} color={colors.border} />
          </View>
        )}
      </View>
    );
  }

  const overflow = total > MAX_OUTFIT_MOSAIC_SLOTS ? total - (MAX_OUTFIT_MOSAIC_SLOTS - 1) : 0;
  const displaySlots = slots.slice(0, MAX_OUTFIT_MOSAIC_SLOTS);
  const rects = getOutfitMosaicRects(total);
  const editorial = Math.min(size, height) >= EDITORIAL_MIN_SIZE;
  const inset = editorial ? Math.max(8, Math.round(Math.min(size, height) * 0.035)) : 0;
  const gap = editorial ? Math.max(4, Math.round(Math.min(size, height) * 0.015)) : 1;
  const canvasWidth = size - inset * 2;
  const canvasHeight = height - inset * 2;
  const tileRadius = editorial ? Math.min(radii.md, gap * 1.5) : 0;

  return (
    <View style={[styles.container, editorial && styles.editorialContainer, { width: size, height, borderRadius }]}>
      {rects.map((rect, i) => {
        const left = inset + rect.left * canvasWidth + gap / 2;
        const top = inset + rect.top * canvasHeight + gap / 2;
        const cellW = rect.width * canvasWidth - gap;
        const cellH = rect.height * canvasHeight - gap;
        const slot = displaySlots[i];
        const isOverflowCell = overflow > 0 && i === MAX_OUTFIT_MOSAIC_SLOTS - 1;

        return (
          <View
            key={`${slot?.originalIndex ?? 'empty'}-${i}`}
            style={[styles.tile, { left, top, width: cellW, height: cellH, borderRadius: tileRadius }]}
          >
            {slot?.uri ? (
              <Image source={{ uri: slot.uri }} style={styles.fill} contentFit="cover" transition={150} />
            ) : slot?.ghost ? (
              <View style={[styles.fill, styles.ghostCell]}>
                <Ionicons name="unlink-outline" size={Math.min(cellW, cellH) * 0.3} color={colors.border} />
              </View>
            ) : (
              <View style={[styles.fill, { backgroundColor: colors.muted }]} />
            )}
            {isOverflowCell && (
              <View style={styles.overflowBadge}>
                <Text style={[styles.overflowText, { fontSize: Math.max(10, cellW * 0.3) }]}>
                  +{overflow}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  editorialContainer: {
    backgroundColor: colors.card,
  },
  tile: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostCell: {
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    color: '#fff',
    fontWeight: '600',
  },
});
