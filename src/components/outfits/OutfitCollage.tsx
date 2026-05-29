import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, radii } from '../../theme';
import { useItems } from '../../hooks/useItems';
import type { Outfit } from '../../types/outfit';
import { useMemo } from 'react';

type Props = {
  outfit: Outfit;
  size: number;
  borderRadius?: number;
};

export function OutfitCollage({ outfit, size, borderRadius = radii.md }: Props) {
  const { data: items = [] } = useItems();

  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items]
  );

  // Prefer AI-generated image if available
  if (outfit.aiGeneratedImageUrl) {
    const uri = resolveImageUri(outfit.aiGeneratedImageUrl);
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius }]}>
        <Image source={{ uri }} style={styles.fill} resizeMode="cover" />
      </View>
    );
  }

  const slotIds = [
    outfit.topId,
    outfit.bottomId,
    outfit.shoesId,
    outfit.outerwearId,
    outfit.accessoryId,
  ].filter((id): id is number => id !== null);

  const imageUris = slotIds
    .map((id) => resolveImageUri(itemMap.get(id)?.imageUrl ?? null))
    .filter((uri): uri is string => !!uri)
    .slice(0, 4);

  const cellSize = size / 2;

  // Fewer than 2 items — show single large image or placeholder
  if (imageUris.length <= 1) {
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius }]}>
        {imageUris[0] ? (
          <Image source={{ uri: imageUris[0] }} style={styles.fill} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="layers-outline" size={size * 0.3} color={colors.border} />
          </View>
        )}
      </View>
    );
  }

  // 2–4 items — 2×2 grid
  const cells = [0, 1, 2, 3];

  return (
    <View style={[styles.container, styles.grid, { width: size, height: size, borderRadius }]}>
      {cells.map((i) => (
        <View key={i} style={{ width: cellSize, height: cellSize }}>
          {imageUris[i] ? (
            <Image
              source={{ uri: imageUris[i] }}
              style={styles.fill}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.fill, { backgroundColor: colors.muted }]} />
          )}
        </View>
      ))}
    </View>
  );
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
