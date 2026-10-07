import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { ImpactFeedbackStyle, impactAsync, selectionAsync } from '../../lib/haptics';

const grabFeedback = () => { void impactAsync(ImpactFeedbackStyle.Light); };
const edgeFeedback = () => { void selectionAsync(); };

/** True when any side of the box sits on the photo's edge. */
function onEdge(left: number, top: number, right: number, bottom: number) {
  'worklet';
  const e = 0.001;
  return left <= e || top <= e || right >= 1 - e || bottom >= 1 - e;
}

import { colors, radii, spacing, typography } from '../../theme';

export type Bbox = { x: number; y: number; width: number; height: number };

const MIN_FRAC = 0.1;
const CORNER_HIT = 44;
const BRACKET = 18;

function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.max(minimum, Math.min(maximum, value));
}

function displayBounds(containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number) {
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: (containerWidth - width) / 2, y: (containerHeight - height) / 2, width, height };
}

type Props = {
  sourceImage: string;
  initialBbox: Bbox;
  itemName: string;
  onApply: (bbox: Bbox) => void;
  onCancel: () => void;
  /** The grid plate the editor opens from, in window coordinates: the crop zooms out of it into place. */
  origin?: CropOrigin | null;
};

export type CropOrigin = { x: number; y: number; width: number; height: number; uri: string };

export function CropAdjustEditor({ sourceImage, initialBbox, itemName, onApply, onCancel, origin }: Props) {
  const insets = useSafeAreaInsets();
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [canvasTop, setCanvasTop] = useState(0);
  const reduceMotion = useReducedMotion();
  // 0 → 1 as the crop flies from its grid plate to its place on the photo.
  const reveal = useSharedValue(origin && !reduceMotion ? 0 : 1);

  const centerX = useSharedValue(0.5);
  const centerY = useSharedValue(0.5);
  const cropWidth = useSharedValue(0.8);
  const cropHeight = useSharedValue(0.8);
  const startCenterX = useSharedValue(0.5);
  const startCenterY = useSharedValue(0.5);
  const startWidth = useSharedValue(0.8);
  const startHeight = useSharedValue(0.8);
  const startLeft = useSharedValue(0.1);
  const startRight = useSharedValue(0.9);
  const startTop = useSharedValue(0.1);
  const startBottom = useSharedValue(0.9);
  const atEdge = useSharedValue(false);

  const resetCrop = useCallback(() => {
    const width = clamp(initialBbox.width / 100, MIN_FRAC, 1);
    const height = clamp(initialBbox.height / 100, MIN_FRAC, 1);
    cropWidth.set(width);
    cropHeight.set(height);
    centerX.set(clamp((initialBbox.x + initialBbox.width / 2) / 100, width / 2, 1 - width / 2));
    centerY.set(clamp((initialBbox.y + initialBbox.height / 2) / 100, height / 2, 1 - height / 2));
  }, [centerX, centerY, cropHeight, cropWidth, initialBbox]);

  useEffect(() => { resetCrop(); }, [resetCrop]);

  useEffect(() => {
    if (!sourceImage) return;
    Image.loadAsync(sourceImage)
      .then((image) => setNaturalSize({ width: image.width, height: image.height }))
      .catch(() => setNaturalSize(null));
  }, [sourceImage]);

  const bounds = useMemo(() => {
    if (!naturalSize || canvasSize.width <= 0 || canvasSize.height <= 0) return null;
    return displayBounds(canvasSize.width, canvasSize.height, naturalSize.width, naturalSize.height);
  }, [canvasSize, naturalSize]);

  const panGesture = useMemo(() => Gesture.Pan()
    .onStart(() => { scheduleOnRN(grabFeedback); })
    .onBegin(() => {
      startCenterX.set(centerX.get());
      startCenterY.set(centerY.get());
    })
    .onUpdate((event) => {
      if (!bounds) return;
      const halfWidth = cropWidth.get() / 2;
      const halfHeight = cropHeight.get() / 2;
      centerX.set(clamp(startCenterX.get() + event.translationX / bounds.width, halfWidth, 1 - halfWidth));
      centerY.set(clamp(startCenterY.get() + event.translationY / bounds.height, halfHeight, 1 - halfHeight));
      const edge = onEdge(centerX.get() - halfWidth, centerY.get() - halfHeight, centerX.get() + halfWidth, centerY.get() + halfHeight);
      if (edge && !atEdge.get()) scheduleOnRN(edgeFeedback);
      atEdge.set(edge);
    }), [bounds, centerX, centerY, cropHeight, cropWidth, startCenterX, startCenterY]);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .onBegin(() => {
      startWidth.set(cropWidth.get());
      startHeight.set(cropHeight.get());
    })
    .onUpdate((event) => {
      const width = clamp(startWidth.get() * event.scale, MIN_FRAC, 1);
      const height = clamp(startHeight.get() * event.scale, MIN_FRAC, 1);
      cropWidth.set(width);
      cropHeight.set(height);
      centerX.set(clamp(centerX.get(), width / 2, 1 - width / 2));
      centerY.set(clamp(centerY.get(), height / 2, 1 - height / 2));
    }), [centerX, centerY, cropHeight, cropWidth, startHeight, startWidth]);

  const frameGesture = useMemo(() => Gesture.Simultaneous(panGesture, pinchGesture), [panGesture, pinchGesture]);

  const resizeGesture = useCallback((leftEdge: boolean, topEdge: boolean) => Gesture.Pan()
    .onStart(() => { scheduleOnRN(grabFeedback); })
    .onBegin(() => {
      startLeft.set(centerX.get() - cropWidth.get() / 2);
      startRight.set(centerX.get() + cropWidth.get() / 2);
      startTop.set(centerY.get() - cropHeight.get() / 2);
      startBottom.set(centerY.get() + cropHeight.get() / 2);
    })
    .onUpdate((event) => {
      if (!bounds) return;
      const left = leftEdge
        ? clamp(startLeft.get() + event.translationX / bounds.width, 0, startRight.get() - MIN_FRAC)
        : startLeft.get();
      const right = leftEdge
        ? startRight.get()
        : clamp(startRight.get() + event.translationX / bounds.width, startLeft.get() + MIN_FRAC, 1);
      const top = topEdge
        ? clamp(startTop.get() + event.translationY / bounds.height, 0, startBottom.get() - MIN_FRAC)
        : startTop.get();
      const bottom = topEdge
        ? startBottom.get()
        : clamp(startBottom.get() + event.translationY / bounds.height, startTop.get() + MIN_FRAC, 1);
      cropWidth.set(right - left);
      cropHeight.set(bottom - top);
      centerX.set((left + right) / 2);
      centerY.set((top + bottom) / 2);
      const edge = onEdge(left, top, right, bottom);
      if (edge && !atEdge.get()) scheduleOnRN(edgeFeedback);
      atEdge.set(edge);
    }), [bounds, centerX, centerY, cropHeight, cropWidth, startBottom, startLeft, startRight, startTop]);

  const topLeftGesture = useMemo(() => resizeGesture(true, true), [resizeGesture]);
  const topRightGesture = useMemo(() => resizeGesture(false, true), [resizeGesture]);
  const bottomLeftGesture = useMemo(() => resizeGesture(true, false), [resizeGesture]);
  const bottomRightGesture = useMemo(() => resizeGesture(false, false), [resizeGesture]);

  // Where the starting crop lands on screen; the ghost flies there, then hands over.
  const ghost = useMemo(() => {
    if (!origin) return null;
    // Until the photo's size is known the ghost simply holds on its plate.
    if (!bounds) return { uri: origin.uri, from: origin, to: origin, ready: false };
    return {
      uri: origin.uri,
      from: origin,
      ready: true,
      to: {
        x: bounds.x + (initialBbox.x / 100) * bounds.width,
        y: canvasTop + bounds.y + (initialBbox.y / 100) * bounds.height,
        width: (initialBbox.width / 100) * bounds.width,
        height: (initialBbox.height / 100) * bounds.height,
      },
    };
  }, [bounds, canvasTop, initialBbox, origin]);
  useEffect(() => {
    if (!ghost?.ready || reveal.get() === 1) return;
    reveal.set(withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
  }, [ghost, reveal]);
  // Cancel flies the crop back to its plate (nothing changed, so it still matches it).
  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    if (!ghost?.ready || reduceMotion) { onCancel(); return; }
    closing.current = true;
    reveal.set(withTiming(0, { duration: 280, easing: Easing.in(Easing.cubic) }, (finished) => { if (finished) scheduleOnRN(onCancel); }));
  }, [ghost, onCancel, reduceMotion, reveal]);
  const canvasStyle = useAnimatedStyle(() => ({ opacity: reveal.get() }));
  const ghostStyle = useAnimatedStyle(() => {
    if (!ghost) return { opacity: 0 };
    const t = reveal.get();
    const lerp = (a: number, b: number) => a + (b - a) * t;
    return {
      opacity: t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25,
      left: lerp(ghost.from.x, ghost.to.x),
      top: lerp(ghost.from.y, ghost.to.y),
      width: lerp(ghost.from.width, ghost.to.width),
      height: lerp(ghost.from.height, ghost.to.height),
    };
  });

  const frameStyle = useAnimatedStyle(() => {
    if (!bounds) return { opacity: 0 };
    const width = cropWidth.get() * bounds.width;
    const height = cropHeight.get() * bounds.height;
    return {
      opacity: 1,
      left: bounds.x + centerX.get() * bounds.width - width / 2,
      top: bounds.y + centerY.get() * bounds.height - height / 2,
      width,
      height,
    };
  }, [bounds]);

  const topDimStyle = useAnimatedStyle(() => ({
    height: bounds ? bounds.y + (centerY.get() - cropHeight.get() / 2) * bounds.height : 0,
  }), [bounds]);
  const bottomDimStyle = useAnimatedStyle(() => ({
    top: bounds ? bounds.y + (centerY.get() + cropHeight.get() / 2) * bounds.height : 0,
  }), [bounds]);
  const leftDimStyle = useAnimatedStyle(() => ({
    top: bounds ? bounds.y + (centerY.get() - cropHeight.get() / 2) * bounds.height : 0,
    height: bounds ? cropHeight.get() * bounds.height : 0,
    width: bounds ? bounds.x + (centerX.get() - cropWidth.get() / 2) * bounds.width : 0,
  }), [bounds]);
  const rightDimStyle = useAnimatedStyle(() => ({
    top: bounds ? bounds.y + (centerY.get() - cropHeight.get() / 2) * bounds.height : 0,
    height: bounds ? cropHeight.get() * bounds.height : 0,
    left: bounds ? bounds.x + (centerX.get() + cropWidth.get() / 2) * bounds.width : 0,
  }), [bounds]);

  const [touched, setTouched] = useState(false);

  const handleApply = useCallback(() => {
    const width = cropWidth.get();
    const height = cropHeight.get();
    onApply({
      x: (centerX.get() - width / 2) * 100,
      y: (centerY.get() - height / 2) * 100,
      width: width * 100,
      height: height * 100,
    });
  }, [centerX, centerY, cropHeight, cropWidth, onApply]);

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.headerButton} onPress={close} accessibilityLabel="Back to piece review">
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Adjust crop</Text>
          {/* The how-to retires at the first touch; after that it is only clutter. */}
          <Text style={[styles.subtitle, touched && styles.subtitleGone]}>Drag to move · corners to resize · pinch to zoom</Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={resetCrop} accessibilityLabel="Reset crop">
          <Ionicons name="refresh" size={21} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.canvas, canvasStyle]}
        onTouchStart={() => { if (!touched) setTouched(true); }}
        onLayout={(event) => { setCanvasSize(event.nativeEvent.layout); setCanvasTop(event.nativeEvent.layout.y); }}
        accessibilityLabel={`Crop ${itemName}`}
      >
        {bounds ? (
          <Image
            source={{ uri: sourceImage }}
            style={[styles.image, { left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }]}
            contentFit="contain"
            cachePolicy="memory-disk"
            accessibilityLabel={`Original photo for ${itemName}`}
          />
        ) : null}

        <Animated.View pointerEvents="none" style={[styles.dim, styles.topDim, topDimStyle]} />
        <Animated.View pointerEvents="none" style={[styles.dim, styles.bottomDim, bottomDimStyle]} />
        <Animated.View pointerEvents="none" style={[styles.dim, styles.leftDim, leftDimStyle]} />
        <Animated.View pointerEvents="none" style={[styles.dim, styles.rightDim, rightDimStyle]} />

        <GestureDetector gesture={frameGesture}>
          <Animated.View style={[styles.cropFrame, frameStyle]}>
            <View pointerEvents="none" style={styles.gridV1} />
            <View pointerEvents="none" style={styles.gridV2} />
            <View pointerEvents="none" style={styles.gridH1} />
            <View pointerEvents="none" style={styles.gridH2} />
            <CropCorner style={styles.cornerTopLeft} corner={styles.bracketTopLeft} gesture={topLeftGesture} />
            <CropCorner style={styles.cornerTopRight} corner={styles.bracketTopRight} gesture={topRightGesture} />
            <CropCorner style={styles.cornerBottomLeft} corner={styles.bracketBottomLeft} gesture={bottomLeftGesture} />
            <CropCorner style={styles.cornerBottomRight} corner={styles.bracketBottomRight} gesture={bottomRightGesture} />
          </Animated.View>
        </GestureDetector>
      </Animated.View>

      {ghost ? (
        <Animated.View pointerEvents="none" style={[styles.ghost, ghostStyle]}>
          <Image source={{ uri: ghost.uri }} style={styles.ghostImage} contentFit="contain" cachePolicy="memory-disk" />
        </Animated.View>
      ) : null}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TouchableOpacity style={styles.cancelButton} onPress={close} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply} accessibilityRole="button">
          <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />
          <Text style={styles.applyText}>Apply crop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CropCorner({ style, gesture, corner }: { style: object; gesture: ReturnType<typeof Gesture.Pan>; corner: object }) {
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.cornerHit, style]}>
        <View style={[styles.bracket, corner]} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 84, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center', gap: 1 },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  subtitle: { ...typography.text.caption, color: colors.mutedForeground, textAlign: 'center' },
  // A dark, warm darkroom: the photo is the only light on the page.
  canvas: { flex: 1, overflow: 'hidden', backgroundColor: colors.foreground },
  subtitleGone: { opacity: 0 },
  image: { position: 'absolute' },
  ghost: { position: 'absolute' },
  ghostImage: { width: '100%', height: '100%' },
  dim: { position: 'absolute', backgroundColor: 'rgba(24,20,17,0.58)' },
  topDim: { top: 0, left: 0, right: 0 },
  bottomDim: { bottom: 0, left: 0, right: 0 },
  leftDim: { left: 0 },
  rightDim: { right: 0 },
  cropFrame: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  gridV1: { position: 'absolute', top: 0, bottom: 0, left: '33.33%', width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)' },
  gridV2: { position: 'absolute', top: 0, bottom: 0, left: '66.67%', width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)' },
  gridH1: { position: 'absolute', left: 0, right: 0, top: '33.33%', height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)' },
  gridH2: { position: 'absolute', left: 0, right: 0, top: '66.67%', height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)' },
  cornerHit: { position: 'absolute', width: CORNER_HIT, height: CORNER_HIT, alignItems: 'center', justifyContent: 'center' },
  cornerTopLeft: { left: -CORNER_HIT / 2, top: -CORNER_HIT / 2 },
  cornerTopRight: { right: -CORNER_HIT / 2, top: -CORNER_HIT / 2 },
  cornerBottomLeft: { left: -CORNER_HIT / 2, bottom: -CORNER_HIT / 2 },
  cornerBottomRight: { right: -CORNER_HIT / 2, bottom: -CORNER_HIT / 2 },
  // Thin L-brackets sit on the frame's corner; the 44pt hit area stays generous.
  bracket: { position: 'absolute', width: BRACKET, height: BRACKET, borderColor: colors.white, filter: [{ dropShadow: { offsetX: 0, offsetY: 0, standardDeviation: 1, color: 'rgba(0,0,0,0.55)' } }] },
  bracketTopLeft: { left: CORNER_HIT / 2 - 1.5, top: CORNER_HIT / 2 - 1.5, borderLeftWidth: 3, borderTopWidth: 3 },
  bracketTopRight: { right: CORNER_HIT / 2 - 1.5, top: CORNER_HIT / 2 - 1.5, borderRightWidth: 3, borderTopWidth: 3 },
  bracketBottomLeft: { left: CORNER_HIT / 2 - 1.5, bottom: CORNER_HIT / 2 - 1.5, borderLeftWidth: 3, borderBottomWidth: 3 },
  bracketBottomRight: { right: CORNER_HIT / 2 - 1.5, bottom: CORNER_HIT / 2 - 1.5, borderRightWidth: 3, borderBottomWidth: 3 },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
    backgroundColor: colors.background,
  },
  cancelButton: { minHeight: 52, minWidth: 96, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...typography.text.label, color: colors.foreground },
  applyButton: {
    minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.primary,
  },
  applyText: { ...typography.text.sectionTitle, color: colors.primaryForeground },
});
