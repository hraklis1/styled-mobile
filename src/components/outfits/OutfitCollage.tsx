import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, radii } from '../../theme';
import { useItems } from '../../hooks/useItems';
import type { Outfit } from '../../types/outfit';
import type { ItemCategory } from '../../types/item';
import { useMemo } from 'react';
import { getOutfitCategoryPriority } from './outfitMosaic';
import { ResolvedOutfitCollage } from './ResolvedOutfitCollage';

type Props = {
  outfit: Outfit;
  size: number;
  height?: number;
  borderRadius?: number;
};

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
            key: String(entry.id),
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
        <Image source={{ uri }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={String(outfit.id)} />
      </View>
    );
  }

  return <ResolvedOutfitCollage slots={slots} size={size} height={height} borderRadius={borderRadius} />;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});
