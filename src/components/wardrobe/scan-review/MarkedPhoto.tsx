import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { boxToScreen, displayBounds } from '../../../lib/cropGeometry';
import { colors, radii, typography } from '../../../theme';
import type { ScanReviewPiece } from './types';

const MARKER = 22;
const HIT = 44;
/** Markers closer than this are nudged apart so neither hides the other. */
const CROWD = 28;
/** How far the side fade reaches into a photo narrower than its frame. */
const FADE = 22;
// The frame's own colour, from solid to clear on an ease-out curve, so the
// photo's edge dissolves into the frame instead of ending on a hard line.
const FADE_COLORS = ['rgba(239,238,233,1)', 'rgba(239,238,233,0.55)', 'rgba(239,238,233,0.18)', 'rgba(239,238,233,0)'] as const;
const FADE_STOPS = [0, 0.3, 0.65, 1] as const;

/**
 * The uploaded photo with a numbered marker on each detected piece. The
 * numbers match the list below; a tap points at the piece without opening
 * it. Excluded pieces keep a hollow marker so they can still be found.
 */
export function MarkedPhoto({ source, pieces, numbers, hiddenIds, activeId, height, onMarkerPress, onPhotoPress }: {
  source: string;
  pieces: ScanReviewPiece[];
  numbers: ReadonlyMap<string, number>;
  /** Pieces without a marker for now, e.g. a collapsed duplicate. */
  hiddenIds?: ReadonlySet<string>;
  activeId: string | null;
  height: number;
  onMarkerPress: (id: string) => void;
  /** A tap on the photo away from every marker. */
  onPhotoPress?: () => void;
}) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let live = true;
    Image.loadAsync(source)
      .then(image => { if (live) setNatural({ width: image.width, height: image.height }); })
      .catch(() => { if (live) setNatural(null); });
    return () => { live = false; };
  }, [source]);

  // A landscape photo needs less height than the cap; don't pad it with bands.
  const frameHeight = natural && width > 0 ? Math.min(height, (width * natural.height) / natural.width) : height;
  const bounds = natural && width > 0 ? displayBounds(width, frameHeight, natural.width, natural.height) : null;

  const markers = useMemo(() => {
    if (!bounds) return [];
    const placed: { id: string; number: number; x: number; y: number; piece: ScanReviewPiece }[] = [];
    pieces.forEach((piece, index) => {
      if (!piece.cropBbox || hiddenIds?.has(piece.id)) return;
      const rect = boxToScreen(piece.cropBbox, bounds);
      let x = rect.x + rect.width / 2;
      let y = rect.y + rect.height / 2;
      // Nested boxes (a bag over a coat) share a centre; lift the later one
      // toward the top of its own box.
      if (placed.some(other => Math.hypot(other.x - x, other.y - y) < CROWD)) {
        y = rect.y + Math.min(rect.height / 2, MARKER);
        if (placed.some(other => Math.hypot(other.x - x, other.y - y) < CROWD)) x += CROWD;
      }
      x = Math.max(bounds.x + MARKER / 2, Math.min(bounds.x + bounds.width - MARKER / 2, x));
      y = Math.max(bounds.y + MARKER / 2, Math.min(bounds.y + bounds.height - MARKER / 2, y));
      placed.push({ id: piece.id, number: numbers.get(piece.id) ?? index + 1, x, y, piece });
    });
    return placed;
  }, [bounds, hiddenIds, numbers, pieces]);

  return (
    <View style={[styles.frame, { height: frameHeight }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {bounds ? (
        <Image
          source={{ uri: source }}
          style={{ position: 'absolute', left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : null}
      {/* Only when the photo leaves bands at its sides: there, it blends into them. */}
      {bounds && bounds.x >= 1 ? (
        <>
          <LinearGradient pointerEvents="none" colors={FADE_COLORS} locations={FADE_STOPS} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={[styles.fade, { left: bounds.x, width: Math.min(FADE, bounds.width * 0.08) }]} />
          <LinearGradient pointerEvents="none" colors={FADE_COLORS} locations={FADE_STOPS} start={{ x: 1, y: 0.5 }} end={{ x: 0, y: 0.5 }}
            style={[styles.fade, { left: bounds.x + bounds.width - Math.min(FADE, bounds.width * 0.08), width: Math.min(FADE, bounds.width * 0.08) }]} />
        </>
      ) : null}
      {/* Under the markers, so only taps that miss them land here. */}
      {onPhotoPress ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={onPhotoPress} accessible={false} />
      ) : null}
      {markers.map(marker => {
        const included = marker.piece.included !== false;
        const active = marker.id === activeId;
        return (
          <Pressable
            key={marker.id}
            onPress={() => onMarkerPress(marker.id)}
            style={[styles.hit, { left: marker.x - HIT / 2, top: marker.y - HIT / 2 }]}
            accessibilityRole="button"
            accessibilityLabel={`Piece ${marker.number}, ${marker.piece.name || 'unnamed'}`}
            accessibilityHint="Shows this piece in the list"
          >
            <View style={[styles.marker, !included && styles.markerOff, active && styles.markerActive]}>
              <Text style={[styles.markerText, active && styles.markerTextActive, !included && styles.markerTextOff]}>{marker.number}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radii.lg, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  fade: { position: 'absolute', top: 0, bottom: 0 },
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
  // Not selected: hollow and pale — still findable, clearly not counted.
  markerOff: { backgroundColor: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.85)' },
  // Active: the one solid mark on the photo, a size up with a clean white ring.
  markerActive: { backgroundColor: colors.foreground, borderWidth: 2, borderColor: colors.white, transform: [{ scale: 1.25 }], boxShadow: '0 1px 4px rgba(0,0,0,0.3)' },
  markerText: { fontSize: 11, lineHeight: 13, fontWeight: typography.weight.semibold, color: colors.white, fontVariant: ['tabular-nums'] },
  markerTextActive: { color: colors.white },
  markerTextOff: { color: colors.foreground },
});
