import { View, StyleSheet, Text } from 'react-native';
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

function getGrid(count: number): { cols: number; rows: number } {
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 };
}

const MAX_SLOTS = 9;

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

  const slots = (outfit.itemIds ?? []).map((e) => {
    const resolved = itemMap.get(e.id);
    return {
      uri: resolveImageUri(resolved?.imageUrl ?? null),
      ghost: !resolved,
    };
  });

  const total = slots.length;

  // Fewer than 2 items — show single large image, ghost, or empty placeholder
  if (total <= 1) {
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

  const overflow = total > MAX_SLOTS ? total - (MAX_SLOTS - 1) : 0;
  const displaySlots = slots.slice(0, MAX_SLOTS);
  const { cols, rows } = getGrid(total);
  const cellW = size / cols;
  const cellH = size / rows;
  const cellCount = cols * rows;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius }]}>
      {Array.from({ length: cellCount }, (_, i) => {
        const left = (i % cols) * cellW;
        const top = Math.floor(i / cols) * cellH;
        const slot = displaySlots[i];
        const isOverflowCell = overflow > 0 && i === MAX_SLOTS - 1;

        return (
          <View key={i} style={{ position: 'absolute', left, top, width: cellW, height: cellH }}>
            {slot?.uri ? (
              <Image source={{ uri: slot.uri }} style={styles.fill} contentFit="cover" />
            ) : slot?.ghost ? (
              <View style={[styles.fill, styles.ghostCell]}>
                <Ionicons name="unlink-outline" size={cellW * 0.3} color={colors.border} />
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
