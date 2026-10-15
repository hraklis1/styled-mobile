import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { SCAN_MESSAGES } from '../../../lib/scan-review';
import { colors, radii, spacing, surfaces, typography } from '../../../theme';
import { selectionFeedback } from './feedback';
import { MarkedPhoto, type PhotoMark } from './MarkedPhoto';
import type { ScanReviewPiece } from './types';

const SWEEP_BAND_HEIGHT = 90;

function useCyclingScanStatus(): string {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % SCAN_MESSAGES.length), 2500);
    return () => clearInterval(id);
  }, []);
  return SCAN_MESSAGES[idx];
}

// The hero's own detection animation — a warm sweep + soft pulse over the
// photo, standing in for "the AI is looking at this." There's no real
// per-item signal yet (pose-scan is a single non-streamed request), so this
// is deliberately a choreographed effect rather than data-driven, same as
// the cycling status copy above.
export function DetectionState({ previewImage, progress, heroHeight, reduceMotion, title = 'Detecting your pieces', stepLabels, photos, detected, foundCount }: {
  previewImage: string | null;
  /** A batch's photos: shown as the same filmstrip the extraction screen uses. */
  photos?: FilmFrame[];
  progress: { current: number; total: number };
  heroHeight: number;
  reduceMotion: boolean;
  /** The outfit logger's copy; defaults are the closet scan's. */
  title?: string;
  stepLabels?: [string, string];
  /** A batch's finished photos, by uri: their pieces pop onto the photo before the strip moves on. */
  detected?: ReadonlyMap<string, PhotoMark[]>;
  /** Pieces found so far across the batch. */
  foundCount?: number;
}) {
  const statusMsg = useCyclingScanStatus();
  const reveal = useFinishedPhotoReveal(photos, detected);
  // The hero takes the photo's own shape: no grey bands beside a portrait.
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  useEffect(() => setNatural(null), [previewImage]);
  const fitted = natural && frameWidth > 0
    ? (() => {
      const aspect = natural.width / natural.height;
      const width = Math.min(frameWidth, heroHeight * aspect);
      return { width, height: Math.min(heroHeight, width / aspect) };
    })()
    : null;
  const pulse = useSharedValue(0.08);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      pulse.set(0.16);
      return;
    }
    pulse.set(withRepeat(withSequence(
      withTiming(0.2, { duration: 900 }),
      withTiming(0.08, { duration: 900 }),
    ), -1, true));
    sweep.set(withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    ));
  }, [reduceMotion, pulse, sweep]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : 1,
    transform: [{ translateY: -SWEEP_BAND_HEIGHT + sweep.get() * (heroHeight + SWEEP_BAND_HEIGHT) }],
  }), [heroHeight, reduceMotion]);

  return (
    <View style={styles.extractionState} accessibilityLiveRegion="polite">
      <View style={styles.heroSlot} onLayout={event => setFrameWidth(event.nativeEvent.layout.width)}>
      {reveal ? (
        <Animated.View key={reveal.uri} entering={reduceMotion ? undefined : FadeIn.duration(220)} style={{ width: '100%' }}>
          <MarkedPhoto source={reveal.uri} marks={reveal.marks} activeId={null} height={heroHeight} onMarkerPress={() => {}} />
        </Animated.View>
      ) : (
      <View style={[styles.extractionHero, fitted ?? { height: heroHeight }]}>
        {previewImage ? (
          <Image source={{ uri: previewImage }} style={styles.heroImage} contentFit={fitted ? 'cover' : 'contain'} cachePolicy="memory-disk"
            onLoad={event => setNatural({ width: event.source.width, height: event.source.height })} />
        ) : null}
        <Animated.View style={[styles.detectScrim, scrimStyle]} pointerEvents="none" />
        <Animated.View style={[styles.detectSweep, { height: SWEEP_BAND_HEIGHT }, sweepStyle]} pointerEvents="none">
          <LinearGradient colors={[`${colors.accent}00`, `${colors.accent}CC`, `${colors.accent}00`]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={styles.detectFrame} pointerEvents="none" />
      </View>
      )}
      </View>
      <Text style={styles.extractionTitle}>{title}</Text>
      {stepLabels ? <>
        <Text style={styles.extractionCopy}>{statusMsg}</Text>
        <ScanStepTrack stage="scanning" progress={progress} reduceMotion={reduceMotion} labels={stepLabels} />
      </> : <>
        {photos && photos.length > 1 ? <Filmstrip frames={photos} reduceMotion={reduceMotion} /> : null}
        <Text style={styles.extractionCopy}>
          {progress.total > 1 && foundCount
            ? `${foundCount === 1 ? '1 piece' : `${foundCount} pieces`} found · photo ${Math.min(progress.current + 1, progress.total)} of ${progress.total}`
            : `${statusMsg.replace(/…$/, '')}${progress.total > 1 ? ` · photo ${Math.min(progress.current + 1, progress.total)} of ${progress.total}` : '…'}`}
        </Text>
      </>}
    </View>
  );
}

const REVEAL_MS = 1200;

/**
 * The photo that just finished, held for a beat with its pieces marked on
 * it, so the user sees what was found before the next photo takes over.
 * Real data, not choreography: only photos with detected pieces reveal.
 */
function useFinishedPhotoReveal(photos: FilmFrame[] | undefined, detected: ReadonlyMap<string, PhotoMark[]> | undefined) {
  const [reveal, setReveal] = useState<{ uri: string; marks: PhotoMark[] } | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const done = (photos ?? []).filter(frame => frame.state === 'done').map(frame => frame.uri);
  const key = done.join('|');
  useEffect(() => {
    if (seen.current === null) { seen.current = new Set(done); return; }
    const fresh = done.find(uri => !seen.current!.has(uri));
    done.forEach(uri => seen.current!.add(uri));
    const marks = fresh ? detected?.get(fresh) : undefined;
    if (!fresh || !marks?.length) return;
    selectionFeedback();
    setReveal({ uri: fresh, marks });
    const timer = setTimeout(() => setReveal(null), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return reveal;
}

export function ExtractionState({ piece, pieces, progress, heroHeight, reduceMotion }: { piece: ScanReviewPiece | null; pieces?: ScanReviewPiece[]; progress: { current: number; total: number }; heroHeight: number; reduceMotion: boolean }) {
  const reel = (pieces ?? []).filter(p => p.photo);
  // Pieces are read in parallel, so the count is the honest signal: the first
  // `current` frames read as done and the hero shows the next one in line.
  const doneCount = Math.min(progress.current, reel.length);
  const current = reel.length ? reel[Math.min(doneCount, reel.length - 1)] : piece;
  const uri = current?.photo;
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    sweep.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, false));
  }, [reduceMotion, sweep]);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -300 + sweep.get() * 900 }, { rotate: '18deg' }] }));
  const status = current?.name ? `Reading ${current.name.toLowerCase()}` : 'Reading details';
  return (
    <View style={styles.extractionState} accessibilityLiveRegion="polite">
      <View style={[styles.extractionHero, styles.extractionPlate, { height: heroHeight }]}>
        {uri ? <Image source={{ uri }} style={styles.extractionImage} contentFit="contain" cachePolicy="memory-disk" transition={reduceMotion ? 0 : 400} recyclingKey="extraction-hero" /> : null}
        {reduceMotion ? null : (
          <Animated.View pointerEvents="none" style={[styles.shimmer, sweepStyle]}>
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
      </View>
      <Text style={styles.extractionTitle}>Refining your pieces</Text>
      {reel.length > 1 ? <Filmstrip reduceMotion={reduceMotion} frames={reel.map((p, index) => ({
        id: p.id,
        uri: p.photo!,
        state: index < doneCount ? 'done' : index === doneCount ? 'active' : 'pending',
      }))} /> : null}
      <Text style={styles.extractionCopy} accessibilityLabel={`${status}, ${progress.current} of ${progress.total} done`}>
        {status}{progress.total > 0 ? ` · ${Math.min(progress.current + 1, progress.total)} of ${progress.total}` : ''}
      </Text>
    </View>
  );
}

export type FilmFrame = { id: string; uri: string; state: 'done' | 'active' | 'pending' };

/** One small frame per photo or piece: done ones in full colour with a tick, the active one breathing, the rest waiting. */
export function Filmstrip({ frames, reduceMotion }: { frames: FilmFrame[]; reduceMotion: boolean }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) { pulse.set(1); return; }
    pulse.set(withRepeat(withSequence(withTiming(0.55, { duration: 700 }), withTiming(1, { duration: 700 })), -1, false));
  }, [pulse, reduceMotion]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  return (
    <View style={styles.filmstrip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {frames.map(frame => (
        <View key={frame.id} style={[styles.frame, frame.state === 'pending' && styles.framePending]}>
          <Image source={{ uri: frame.uri }} style={styles.frameImage} contentFit="contain" cachePolicy="memory-disk" transition={reduceMotion ? 0 : 300} />
          {frame.state === 'active' ? <Animated.View pointerEvents="none" style={[styles.frameRing, pulseStyle]} /> : null}
          {frame.state === 'done' ? <View style={styles.frameTick}><Ionicons name="checkmark" size={9} color={colors.primaryForeground} /></View> : null}
        </View>
      ))}
    </View>
  );
}

const SCAN_TRACK_STEPS: { key: 'detect' | 'extract'; label: string }[] = [
  { key: 'detect', label: 'Detect' },
  { key: 'extract', label: 'Extract' },
];

// Replaces the old dot-circle-and-line tracker: a single ruled line whose
// fill spans the whole Detect→Extract journey (0–50% during Detect, 50–100%
// during Extract, the latter driven by real extraction progress) instead of
// two disconnected per-step widgets.
function ScanStepTrack({ stage, progress, reduceMotion, labels }: {
  stage: 'scanning' | 'extracting';
  progress: { current: number; total: number };
  reduceMotion: boolean;
  labels?: [string, string];
}) {
  // Detect owns the first half of the rule. A single-photo scan has no real
  // signal inside it, so it sits at a token 0.1; a batch has one tick per
  // photo and fills the half for real.
  const targetFraction = stage === 'scanning'
    ? (progress.total > 0 ? 0.1 + (progress.current / progress.total) * 0.4 : 0.1)
    : 0.5 + (progress.total > 0 ? (progress.current / progress.total) * 0.5 : 0);

  const fill = useSharedValue(targetFraction);
  // A single-photo detect has no progress signal, so the rule creeps toward
  // the end of its half on an easing curve that never quite arrives: alive,
  // but never claiming to be done before it is.
  const creeping = stage === 'scanning' && progress.total <= 0;
  useEffect(() => {
    if (reduceMotion) { fill.set(targetFraction); return; }
    fill.set(creeping
      ? withSequence(withTiming(targetFraction, { duration: 350 }), withTiming(0.45, { duration: 9000, easing: Easing.out(Easing.cubic) }))
      : withTiming(targetFraction, { duration: 350 }));
  }, [targetFraction, reduceMotion, fill, creeping]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  return (
    <View style={styles.trackWrap}>
      <View style={styles.trackLabelRow}>
        {SCAN_TRACK_STEPS.map((step) => {
          const isDone = stage === 'extracting' && step.key === 'detect';
          const isActive = (stage === 'scanning' && step.key === 'detect') || (stage === 'extracting' && step.key === 'extract');
          return (
            <View key={step.key} style={styles.trackLabelItem}>
              {isDone ? <Ionicons name="checkmark" size={11} color={colors.primary} /> : null}
              <Text style={[styles.trackLabel, isActive && styles.trackLabelActive]}>
                {labels ? labels[step.key === 'detect' ? 0 : 1] : step.label}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.trackRule}>
        <Animated.View style={[styles.trackRuleFill, fillStyle]} />
      </View>
      {stage === 'extracting' || progress.total > 1 ? (
        <Text style={styles.trackCount}>{progress.current}/{progress.total}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroImage: { width: '100%', height: '100%' },
  heroSlot: { width: '100%', alignItems: 'center' },
  extractionPlate: { backgroundColor: surfaces.plate },
  extractionImage: { width: '88%', height: '88%' },
  extractionState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  extractionHero: { width: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.card },
  extractionTitle: { ...typography.text.editorialSection, color: colors.foreground },
  shimmer: { position: 'absolute', top: -200, bottom: -200, left: 0, width: 140 },
  filmstrip: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  frame: { width: 36, height: 48, borderRadius: radii.sm, borderCurve: 'continuous', backgroundColor: surfaces.plate, alignItems: 'center', justifyContent: 'center' },
  framePending: { opacity: 0.4 },
  frameImage: { width: '86%', height: '86%' },
  frameRing: { ...StyleSheet.absoluteFill, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.foreground },
  frameTick: { position: 'absolute', right: -3, top: -3, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.foreground },
  extractionCopy: { ...typography.text.bodySmall, color: colors.mutedForeground, textAlign: 'center' },
  detectScrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.primary },
  detectSweep: { position: 'absolute', left: 0, right: 0, top: 0 },
  detectFrame: { position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, borderRadius: radii.lg, borderCurve: 'continuous', borderWidth: 1.5, borderColor: colors.primary, opacity: 0.3 },
  trackWrap: { width: '100%', maxWidth: 300, gap: spacing.xs },
  trackLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  trackLabelItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  trackLabelActive: { color: colors.primary },
  trackRule: { height: 2, borderRadius: 1, backgroundColor: colors.border, overflow: 'hidden' },
  trackRuleFill: { height: '100%', borderRadius: 1, backgroundColor: colors.primary },
  trackCount: { ...typography.text.caption, color: colors.mutedForeground, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
