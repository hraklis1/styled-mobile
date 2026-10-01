import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { itemCoverPresentation } from '../../lib/itemImage';
import { colors, radii, spacing, typography } from '../../theme';
import type { Item } from '../../types/item';

type Props = {
  items: Array<Item | undefined>;
  width: number;
  height: number;
  maxFrames?: number;
};

const GUTTER = spacing.sm;
// Frames grow taller (up to 1:2) before leaving dead ground above and below.
const MIN_ASPECT = 1 / 2;
const MAX_ASPECT = 3 / 4;

// Mixed sources (studio cutouts beside tight photo crops) read as one capsule
// when every piece sits in an identical frame on one ground: cutouts float
// inset with `contain`, crops fill with `cover` under a faint shared wash.
export function LineSheetFrames({ items, width, height, maxFrames = 4 }: Props) {
  const overflow = Math.max(0, items.length - maxFrames);
  const shown = overflow > 0 ? items.slice(0, maxFrames - 1) : items;
  const count = shown.length + (overflow > 0 ? 1 : 0);
  const innerW = width - GUTTER * 2;
  const innerH = height - GUTTER * 2;
  const byWidth = (innerW - GUTTER * (count - 1)) / Math.max(1, count);
  const frameW = Math.floor(Math.min(byWidth, innerH * MAX_ASPECT));
  const frameH = Math.floor(Math.min(innerH, frameW / MIN_ASPECT));

  return (
    <View style={[styles.ground, { width, height }]}>
      {shown.map((item, index) => {
        const cover = itemCoverPresentation(item);
        const isCutout = cover.contentFit === 'contain';
        return (
          <View
            key={item?.id ?? `missing-${index}`}
            style={[styles.frame, isCutout && styles.cutoutFrame, { width: frameW, height: frameH }]}
          >
            {cover.uri ? (
              <>
                <Image
                  source={{ uri: cover.uri }}
                  style={isCutout ? [styles.cutout, { top: frameW * 0.12, right: frameW * 0.12, bottom: frameW * 0.12, left: frameW * 0.12 }] : StyleSheet.absoluteFill}
                  contentFit={cover.contentFit}
                />
                {isCutout ? null : <View style={styles.wash} pointerEvents="none" />}
              </>
            ) : (
              <Ionicons name="shirt-outline" size={22} color={colors.mutedForeground} />
            )}
          </View>
        );
      })}
      {overflow > 0 ? (
        <View style={[styles.frame, styles.more, { width: frameW, height: frameH }]}>
          <Text style={styles.moreText}>+{overflow + 1}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ground: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GUTTER,
    padding: GUTTER,
    backgroundColor: colors.muted,
  },
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cutout: { position: 'absolute' },
  wash: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(243, 239, 232, 0.08)',
  },
  // Cutouts carry their own neutral backdrop; matching the ground lets them float.
  cutoutFrame: { backgroundColor: colors.muted },
  more: { backgroundColor: colors.muted },
  moreText: { ...typography.text.sectionTitle, color: colors.mutedForeground },
});
