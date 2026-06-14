import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii } from '../../theme';
import {
  getOutfitMosaicRects,
  MAX_OUTFIT_MOSAIC_SLOTS,
} from './outfitMosaic';

export type ResolvedOutfitSlot = {
  key: string;
  uri: string | null | undefined;
  ghost?: boolean;
};

type Props = {
  slots: ResolvedOutfitSlot[];
  size: number;
  height?: number;
  borderRadius?: number;
};

const EDITORIAL_MIN_SIZE = 260;

export function ResolvedOutfitCollage({
  slots,
  size,
  height = size,
  borderRadius = radii.md,
}: Props) {
  const total = slots.length;

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
            key={`${slot?.key ?? 'empty'}-${i}`}
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
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    color: colors.white,
    fontWeight: '600',
  },
});
