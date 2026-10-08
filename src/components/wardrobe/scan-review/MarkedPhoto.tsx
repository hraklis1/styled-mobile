import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { boxToScreen, displayBounds } from '../../../lib/cropGeometry';
import { colors, radii, spacing, stroke, typography } from '../../../theme';

type Size = { width: number; height: number };
type Box = { x: number; y: number; width: number; height: number };

/** One piece on the photo. `box` is in percent of the photo. */
export type PhotoMark = {
  id: string;
  box: Box | null;
  label: string;
  /** Shown in the marker; without one the marker is a plain dot. */
  number?: number;
  /** Not counted (excluded, or not logging): hollow, still findable. */
  off?: boolean;
};

/**
 * How tall a review photo stands: enough to read the outfit while the first
 * rows still show on an SE. Once the pieces are read, the photo is a map, not
 * the task, and gives the list more room.
 */
export function reviewPhotoHeight(screenHeight: number, compact = false) {
  return compact
    ? Math.max(200, Math.min(300, Math.round(screenHeight * 0.3)))
    : Math.max(260, Math.min(420, Math.round(screenHeight * 0.42)));
}

const MARKER = 22;
const DOT = 14;
const HIT = 44;
/** Marker centres are pushed at least this far apart so neither hides the other. */
const MIN_GAP = 28;
/** How far the side fade reaches into a photo narrower than its frame. */
const FADE = 22;
// The frame's own colour, from solid to clear on an ease-out curve, so the
// photo's edge dissolves into the frame instead of ending on a hard line.
const FADE_COLORS = ['rgba(239,238,233,1)', 'rgba(239,238,233,0.55)', 'rgba(239,238,233,0.18)', 'rgba(239,238,233,0)'] as const;
const FADE_STOPS = [0, 0.3, 0.65, 1] as const;

/** Marker centres in frame points, relaxed apart so overlapping pieces stay tappable, then kept on the photo. */
export function markerPositions(marks: PhotoMark[], bounds: Box) {
  const pts = marks.flatMap((mark) => {
    if (!mark.box) return [];
    const rect = boxToScreen(mark.box, bounds);
    return [{ mark, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }];
  });
  // Identical centres (nested or duplicate boxes) start fanned out on a small
  // ring, so the relaxation below can separate them in every direction.
  const groups = new Map<string, typeof pts>();
  for (const p of pts) {
    const key = `${p.x},${p.y}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const twins of groups.values()) {
    if (twins.length < 2) continue;
    twins.forEach((p, k) => {
      // Starting straight up keeps the first of a pair above the second, like a bag over a coat.
      const angle = -Math.PI / 2 + (2 * Math.PI * k) / twins.length;
      p.x += Math.cos(angle) * 0.01; p.y += Math.sin(angle) * 0.01;
    });
  }
  for (let pass = 0; pass < 24; pass++) {
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
      const dist = Math.hypot(dx, dy);
      if (dist >= MIN_GAP) continue;
      const push = (MIN_GAP - dist) / 2;
      const ux = dist ? dx / dist : 0, uy = dist ? dy / dist : 1;
      pts[i].x -= ux * push; pts[i].y -= uy * push;
      pts[j].x += ux * push; pts[j].y += uy * push;
    }
  }
  const half = MARKER / 2;
  for (const p of pts) {
    p.x = Math.max(bounds.x + half, Math.min(bounds.x + bounds.width - half, p.x));
    p.y = Math.max(bounds.y + half, Math.min(bounds.y + bounds.height - half, p.y));
  }
  return pts;
}

/**
 * The source photo with a marker on each detected piece — the closet scan's
 * review photo and the outfit log's photo view. A tap on a marker points at
 * the piece. Optionally the active piece is outlined, and named in a tag
 * that opens it.
 */
export function MarkedPhoto({ source, marks, activeId, height, width: fixedWidth, fitHeight = true, outlineActive = false, tag, onMarkerPress, onPhotoPress }: {
  source: string;
  marks: PhotoMark[];
  activeId: string | null;
  /** The cap; a landscape photo shrinks below it unless `fitHeight` is off. */
  height: number;
  /** Measured from layout when omitted. */
  width?: number;
  fitHeight?: boolean;
  outlineActive?: boolean;
  /** Names the active piece over the photo; tapping the tag opens it. */
  tag?: { action: string; accessibilityLabel: (label: string) => string; accessibilityHint: string; onPress: (id: string) => void };
  onMarkerPress: (id: string) => void;
  /** A tap on the photo away from every marker. */
  onPhotoPress?: () => void;
}) {
  const [natural, setNatural] = useState<Size | null>(null);
  const [measured, setMeasured] = useState(0);
  const width = fixedWidth ?? measured;

  // A landscape photo needs less height than the cap; don't pad it with bands.
  const frameHeight = fitHeight && natural && width > 0 ? Math.min(height, (width * natural.height) / natural.width) : height;
  const bounds = natural && width > 0 ? displayBounds(width, frameHeight, natural.width, natural.height) : null;
  const markers = useMemo(() => (bounds ? markerPositions(marks, bounds) : []), [bounds?.x, bounds?.y, bounds?.width, bounds?.height, marks]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = marks.find((mark) => mark.id === activeId);
  const activeMarker = markers.find((p) => p.mark.id === activeId);
  const outline = outlineActive && bounds && active?.box ? boxToScreen(active.box, bounds) : null;

  // The tag is placed from its measured size, so it can be as wide (or two
  // lines tall) as the name needs; it stays invisible until measured.
  const [tagSize, setTagSize] = useState<Size | null>(null);
  useEffect(() => setTagSize(null), [activeId]);
  const tagMax = Math.min(width - spacing.sm * 2, 260);
  const tagPos = activeMarker && tagSize ? {
    left: Math.min(Math.max(spacing.sm, activeMarker.x - tagSize.width / 2), width - tagSize.width - spacing.sm),
    top: activeMarker.y - tagSize.height - 16 >= spacing.sm ? activeMarker.y - tagSize.height - 16 : activeMarker.y + MARKER / 2 + 12,
  } : null;

  const fadeWidth = bounds ? Math.min(FADE, bounds.width * 0.08) : 0;
  return (
    <View style={[styles.frame, { height: frameHeight }, fixedWidth != null && { width: fixedWidth }]}
      onLayout={fixedWidth == null ? (event) => setMeasured(event.nativeEvent.layout.width) : undefined}>
      <Image
        source={{ uri: source }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="memory-disk"
        onLoad={(event) => setNatural({ width: event.source.width, height: event.source.height })}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
      {/* Only when the photo leaves bands at its sides: there, it blends into them. */}
      {bounds && bounds.x >= 1 ? (
        <>
          <LinearGradient pointerEvents="none" colors={FADE_COLORS} locations={FADE_STOPS} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={[styles.fade, { left: bounds.x, width: fadeWidth }]} />
          <LinearGradient pointerEvents="none" colors={FADE_COLORS} locations={FADE_STOPS} start={{ x: 1, y: 0.5 }} end={{ x: 0, y: 0.5 }}
            style={[styles.fade, { left: bounds.x + bounds.width - fadeWidth, width: fadeWidth }]} />
        </>
      ) : null}
      {/* Under the markers, so only taps that miss them land here. */}
      {onPhotoPress ? <Pressable style={StyleSheet.absoluteFill} onPress={onPhotoPress} accessible={false} /> : null}
      {outline ? <View pointerEvents="none" style={[styles.outline, { left: outline.x, top: outline.y, width: outline.width, height: outline.height }]} /> : null}
      {markers.map(({ mark, x, y }) => {
        const on = mark.id === activeId;
        const numbered = mark.number != null;
        return (
          <Pressable
            key={mark.id}
            onPress={() => (on && tag ? tag.onPress(mark.id) : onMarkerPress(mark.id))}
            style={[styles.hit, { left: x - HIT / 2, top: y - HIT / 2 }]}
            accessibilityRole="button"
            accessibilityLabel={numbered ? `Piece ${mark.number}, ${mark.label || 'unnamed'}` : mark.label}
            accessibilityHint={on && tag ? tag.accessibilityHint : 'Highlights this piece'}
          >
            <View style={[numbered ? styles.marker : styles.dot, mark.off && styles.markerOff, on && styles.markerActive]}>
              {numbered ? <Text style={[styles.markerText, mark.off && !on && styles.markerTextOff]}>{mark.number}</Text> : null}
            </View>
          </Pressable>
        );
      })}
      {tag && active && activeMarker ? (
        <Pressable
          onPress={() => tag.onPress(active.id)}
          accessibilityRole="button"
          accessibilityLabel={tag.accessibilityLabel(active.label)}
          accessibilityHint={tag.accessibilityHint}
          onLayout={(e) => { const { width: w, height: h } = e.nativeEvent.layout; if (!tagSize || tagSize.width !== w || tagSize.height !== h) setTagSize({ width: w, height: h }); }}
          style={({ pressed }) => [styles.tag, { maxWidth: tagMax }, tagPos ?? styles.tagHidden, pressed && styles.tagPressed]}
        >
          <Text style={styles.tagText} numberOfLines={2}>{active.label}</Text>
          <View style={styles.tagDivider} />
          <Text style={styles.tagAction}>{tag.action}</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radii.lg, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  fade: { position: 'absolute', top: 0, bottom: 0 },
  outline: { position: 'absolute', borderWidth: stroke.fine, borderColor: 'rgba(255,255,255,0.9)' },
  hit: { position: 'absolute', width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  // Quiet by default: a translucent ink disc with a hairline of light.
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(36,36,34,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: 'rgba(36,36,34,0.55)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)' },
  // Not counted: hollow and pale — still findable, clearly not included.
  markerOff: { backgroundColor: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.85)' },
  // Active: the one solid mark on the photo, a size up with a clean white ring.
  markerActive: { backgroundColor: colors.foreground, borderWidth: 2, borderColor: colors.white, transform: [{ scale: 1.25 }], boxShadow: '0 1px 4px rgba(0,0,0,0.3)' },
  markerText: { fontSize: 11, lineHeight: 13, fontWeight: typography.weight.semibold, color: colors.white, fontVariant: ['tabular-nums'] },
  markerTextOff: { color: colors.foreground },
  tag: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(20,20,20,0.88)',
  },
  tagHidden: { left: 0, top: 0, opacity: 0 },
  tagPressed: { opacity: 0.8 },
  tagText: { ...typography.text.meta, lineHeight: 16, color: colors.white, flexShrink: 1 },
  tagDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.4)', marginVertical: 2 },
  tagAction: { ...typography.text.meta, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: typography.weight.semibold, color: colors.white },
});
