import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

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

const DOT = 12;
const MIN_GAP = 24;

/** Dot centres in frame points, pushed apart so overlapping pieces stay tappable. */
function dotPositions(detections: WearDetection[], rect: { x: number; y: number; width: number; height: number }) {
  const pts = detections.map((d) => {
    const b = d.bbox_pct;
    return b ? { id: d.id, x: rect.x + ((b.x + b.width / 2) / 100) * rect.width, y: rect.y + ((b.y + b.height / 2) / 100) * rect.height } : null;
  }).filter((p): p is { id: string; x: number; y: number } => !!p);
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
      const dist = Math.hypot(dx, dy);
      if (dist >= MIN_GAP) continue;
      const push = (MIN_GAP - dist) / 2;
      const ux = dist ? dx / dist : 1, uy = dist ? dy / dist : 0;
      pts[i].x -= ux * push; pts[i].y -= uy * push;
      pts[j].x += ux * push; pts[j].y += uy * push;
    }
  }
  return pts;
}

/**
 * The photo with a small dot per detection. Tapping a dot outlines that piece
 * and names it; tapping the name opens it. Ignored pieces fade their dot.
 */
export function PhotoHero({ uri, height, width, detections, activeId, dimmedIds, onSelect, onOpen }: {
  uri: string;
  height: number;
  width: number;
  detections: WearDetection[];
  activeId: string | null;
  dimmedIds: Set<string>;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const [natural, setNatural] = useState<Size | null>(null);
  const rect = containRect({ width, height }, natural);
  const active = detections.find((d) => d.id === activeId);
  const box = active?.bbox_pct;
  const dots = dotPositions(detections, rect);
  const activeDot = dots.find((p) => p.id === activeId);

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
      {box ? <View pointerEvents="none" style={[styles.outline, {
        left: rect.x + (box.x / 100) * rect.width,
        top: rect.y + (box.y / 100) * rect.height,
        width: (box.width / 100) * rect.width,
        height: (box.height / 100) * rect.height,
      }]} /> : null}
      {dots.map((p) => {
        const d = detections.find((x) => x.id === p.id)!;
        const on = p.id === activeId;
        return (
          <Pressable
            key={p.id}
            onPress={() => (on ? onOpen(p.id) : onSelect(p.id))}
            accessibilityRole="button"
            accessibilityLabel={d.attributes.name}
            accessibilityHint={on ? 'Opens this piece' : 'Highlights this piece'}
            hitSlop={16}
            style={[styles.dot, { left: p.x - DOT / 2, top: p.y - DOT / 2 }, on && styles.dotActive, dimmedIds.has(p.id) && styles.dimmed]}
          />
        );
      })}
      {active && activeDot ? <Pressable onPress={() => onOpen(active.id)} accessibilityRole="button" accessibilityLabel={`Open ${active.attributes.name}`}
        style={[styles.pill, { top: Math.max(spacing.sm, activeDot.y - 44), left: Math.min(Math.max(spacing.sm, activeDot.x - 90), width - 188) }]}>
        <Text style={styles.pillText} numberOfLines={1}>{active.attributes.name}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.white} />
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.surfaceSubtle, overflow: 'hidden' },
  outline: { position: 'absolute', borderWidth: stroke.fine, borderColor: 'rgba(255,255,255,0.9)' },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  dotActive: { backgroundColor: colors.foreground, borderColor: colors.white },
  dimmed: { opacity: 0.3 },
  pill: {
    position: 'absolute',
    maxWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(20,20,20,0.85)',
  },
  pillText: { ...typography.text.meta, color: colors.white, flexShrink: 1 },
});
