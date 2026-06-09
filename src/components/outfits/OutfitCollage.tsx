import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
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
        <Image source={{ uri }} style={styles.fill} contentFit="cover" />
      </View>
    );
  }

  const slots = (outfit.itemIds ?? [])
    .slice(0, 4)
    .map((e) => {
      const resolved = itemMap.get(e.id);
      return {
        uri: resolveImageUri(resolved?.imageUrl ?? null),
        ghost: !resolved,
      };
    });

  const cellSize = size / 2;

  // Fewer than 2 items — show single large image, ghost, or empty placeholder
  if (slots.length <= 1) {
    const slot = slots[0];
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius }]}>
        {slot?.uri ? (
          <Image source={{ uri: slot.uri }} style={styles.fill} contentFit="cover" />
        ) : slot?.ghost ? (
          <View style={styles.placeholder}>
            <Ionicons name="unlink-outline" size={size * 0.25} color={colors.border} />
          </View>
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
      {cells.map((i) => {
        const slot = slots[i];
        return (
          <View key={i} style={{ width: cellSize, height: cellSize }}>
            {slot?.uri ? (
              <Image source={{ uri: slot.uri }} style={styles.fill} contentFit="cover" />
            ) : slot?.ghost ? (
              <View style={[styles.fill, styles.ghostCell]}>
                <Ionicons name="unlink-outline" size={cellSize * 0.3} color={colors.border} />
              </View>
            ) : (
              <View style={[styles.fill, { backgroundColor: colors.muted }]} />
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
  ghostCell: {
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
