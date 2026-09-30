import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { colors, spacing, stroke, typography } from '../../../theme';
import type { WearDetection } from '../../../features/wear-log/types';

type Size = { width: number; height: number };

/** Where a `contain`-fitted image actually lands inside its frame. */
function containRect(frame: Size, image: Size | null) {
  if (!image || !image.width || !image.height) return { x: 0, y: 0, ...frame };
  const scale = Math.min(frame.width / image.width, frame.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (frame.width - width) / 2, y: (frame.height - height) / 2, width, height };
}

/**
 * The photo with a thin numbered box per detection. The numbers are the row
 * numbers below, so the eye can pair "3" in the photo with row 3 without a
 * colour key. Ignored pieces fade their box instead of losing it.
 */
export function PhotoHero({ uri, height, width, detections, numbers, activeId, dimmedIds, onPressBox }: {
  uri: string;
  height: number;
  width: number;
  detections: WearDetection[];
  numbers: Record<string, number>;
  activeId: string | null;
  dimmedIds: Set<string>;
  onPressBox: (id: string) => void;
}) {
  const [natural, setNatural] = useState<Size | null>(null);
  const rect = containRect({ width, height }, natural);

  return (
    <View style={[styles.frame, { height, width }]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="memory-disk"
        onLoad={(e) => setNatural({ width: e.source.width, height: e.source.height })}
        accessibilityIgnoresInvertColors
      />
      {detections.map((d) => {
        const b = d.bbox_pct;
        if (!b) return null;
        const active = d.id === activeId;
        const horizontalHitSlop = Math.max(0, (44 - (b.width / 100) * rect.width) / 2);
        const verticalHitSlop = Math.max(0, (44 - (b.height / 100) * rect.height) / 2);
        return (
          <Pressable
            key={d.id}
            onPress={() => onPressBox(d.id)}
            accessibilityRole="button"
            accessibilityLabel={`Piece ${numbers[d.id]}, ${d.attributes.name}`}
            hitSlop={{ left: horizontalHitSlop, right: horizontalHitSlop, top: verticalHitSlop, bottom: verticalHitSlop }}
            style={[
              styles.box,
              {
                left: rect.x + (b.x / 100) * rect.width,
                top: rect.y + (b.y / 100) * rect.height,
                width: (b.width / 100) * rect.width,
                height: (b.height / 100) * rect.height,
              },
              active && styles.boxActive,
              dimmedIds.has(d.id) && styles.boxDimmed,
            ]}
          >
            <View style={[styles.tag, active && styles.tagActive]}>
              <Text style={[styles.tagText, active && styles.tagTextActive]}>{numbers[d.id]}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.surfaceSubtle, overflow: 'hidden' },
  box: { position: 'absolute', borderWidth: stroke.fine, borderColor: 'rgba(255,255,255,0.85)' },
  boxActive: { borderColor: colors.white, borderWidth: 2 },
  boxDimmed: { opacity: 0.3 },
  tag: {
    position: 'absolute',
    top: -1,
    left: -1,
    minWidth: 18,
    height: 18,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  tagActive: { backgroundColor: colors.foreground },
  tagText: { ...typography.text.meta, fontSize: 11, lineHeight: 14, color: colors.foreground },
  tagTextActive: { color: colors.white },
});
