import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { ImpactFeedbackStyle, impactAsync, selectionAsync } from '../../lib/haptics';
import { colors, radii, spacing, typography } from '../../theme';
import { displayBounds } from '../../lib/cropGeometry';

const grabFeedback = () => { void impactAsync(ImpactFeedbackStyle.Light); };
const edgeFeedback = () => { void selectionAsync(); };

/** True when any side of the box sits on the photo's edge. */
function onEdge(left: number, top: number, right: number, bottom: number) {
  'worklet';
  const e = 0.001;
  return left <= e || top <= e || right >= 1 - e || bottom >= 1 - e;
}

export type Bbox = { x: number; y: number; width: number; height: number };

const MIN_FRAC = 0.1;
const CORNER_HIT = 44;
const BRACKET = 18;

function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.max(minimum, Math.min(maximum, value));
}


type Props = {
  sourceImage: string;
  initialBbox: Bbox;
  itemName: string;
  onApply: (bbox: Bbox) => void;
  onCancel: () => void;
  title?: string;
  /** Standing guidance under the title; without it, a how-to that retires at the first touch. */
  instruction?: string;
  applyLabel?: string;
};

export function CropAdjustEditor({ sourceImage, initialBbox, itemName, onApply, onCancel, title = 'Adjust crop', instruction, applyLabel = 'Apply crop' }: Props) {
  const insets = useSafeAreaInsets();
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

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
    }), [bounds, centerX, centerY, cropHeight, cropWidth, startCenterX, startCenterY, atEdge]);

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

  // `null` leaves that axis alone, so the mid-edge handles move one side only.
  const resizeGesture = useCallback((leftEdge: boolean | null, topEdge: boolean | null) => Gesture.Pan()
    .onStart(() => { scheduleOnRN(grabFeedback); })
    .onBegin(() => {
      startLeft.set(centerX.get() - cropWidth.get() / 2);
      startRight.set(centerX.get() + cropWidth.get() / 2);
      startTop.set(centerY.get() - cropHeight.get() / 2);
      startBottom.set(centerY.get() + cropHeight.get() / 2);
    })
    .onUpdate((event) => {
      if (!bounds) return;
      const dx = leftEdge === null ? 0 : event.translationX / bounds.width;
      const dy = topEdge === null ? 0 : event.translationY / bounds.height;
      const left = leftEdge
        ? clamp(startLeft.get() + dx, 0, startRight.get() - MIN_FRAC)
        : startLeft.get();
      const right = leftEdge
        ? startRight.get()
        : clamp(startRight.get() + dx, startLeft.get() + MIN_FRAC, 1);
      const top = topEdge
        ? clamp(startTop.get() + dy, 0, startBottom.get() - MIN_FRAC)
        : startTop.get();
      const bottom = topEdge
        ? startBottom.get()
        : clamp(startBottom.get() + dy, startTop.get() + MIN_FRAC, 1);
      cropWidth.set(right - left);
      cropHeight.set(bottom - top);
      centerX.set((left + right) / 2);
      centerY.set((top + bottom) / 2);
      const edge = onEdge(left, top, right, bottom);
      if (edge && !atEdge.get()) scheduleOnRN(edgeFeedback);
      atEdge.set(edge);
    }), [bounds, centerX, centerY, cropHeight, cropWidth, startBottom, startLeft, startRight, startTop, atEdge]);

  const topLeftGesture = useMemo(() => resizeGesture(true, true), [resizeGesture]);
  const topRightGesture = useMemo(() => resizeGesture(false, true), [resizeGesture]);
  const bottomLeftGesture = useMemo(() => resizeGesture(true, false), [resizeGesture]);
  const bottomRightGesture = useMemo(() => resizeGesture(false, false), [resizeGesture]);
  const topEdgeGesture = useMemo(() => resizeGesture(null, true), [resizeGesture]);
  const bottomEdgeGesture = useMemo(() => resizeGesture(null, false), [resizeGesture]);
  const leftEdgeGesture = useMemo(() => resizeGesture(true, null), [resizeGesture]);
  const rightEdgeGesture = useMemo(() => resizeGesture(false, null), [resizeGesture]);

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
        <TouchableOpacity style={styles.headerButton} onPress={onCancel} accessibilityLabel="Back to piece review">
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {/* The how-to retires at the first touch; after that it is only clutter. */}
          {instruction ? null : <Text style={[styles.subtitle, touched && styles.subtitleGone]}>Drag to move · edges to resize · pinch to zoom</Text>}
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={resetCrop} accessibilityLabel="Reset crop">
          <Ionicons name="refresh" size={21} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View
        style={styles.canvas}
        onTouchStart={() => { if (!touched) setTouched(true); }}
        onLayout={(event) => setCanvasSize(event.nativeEvent.layout)}
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
            <CropEdge style={styles.edgeTop} bar={styles.barHorizontal} gesture={topEdgeGesture} />
            <CropEdge style={styles.edgeBottom} bar={styles.barHorizontal} gesture={bottomEdgeGesture} />
            <CropEdge style={styles.edgeLeft} bar={styles.barVertical} gesture={leftEdgeGesture} />
            <CropEdge style={styles.edgeRight} bar={styles.barVertical} gesture={rightEdgeGesture} />
            <CropCorner style={styles.cornerTopLeft} corner={styles.bracketTopLeft} gesture={topLeftGesture} />
            <CropCorner style={styles.cornerTopRight} corner={styles.bracketTopRight} gesture={topRightGesture} />
            <CropCorner style={styles.cornerBottomLeft} corner={styles.bracketBottomLeft} gesture={bottomLeftGesture} />
            <CropCorner style={styles.cornerBottomRight} corner={styles.bracketBottomRight} gesture={bottomRightGesture} />
          </Animated.View>
        </GestureDetector>
      </View>

      {instruction ? <Text style={styles.instruction}>{instruction}</Text> : null}
      <View style={[styles.footer, instruction && styles.footerAfterInstruction, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply} accessibilityRole="button">
          <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />
          <Text style={styles.applyText}>{applyLabel}</Text>
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

/** A mid-edge grip: a short bar on the frame, inside a full-length hit strip. */
function CropEdge({ style, gesture, bar }: { style: object; gesture: ReturnType<typeof Gesture.Pan>; bar: object }) {
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.edgeHit, style]}>
        <View style={[styles.bar, bar]} />
      </Animated.View>
    </GestureDetector>
  );
}

const EDGE_HIT = 32;

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
  // The strip spans the side between the corner targets, which stay on top.
  edgeHit: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  edgeTop: { top: -EDGE_HIT / 2, left: CORNER_HIT / 2, right: CORNER_HIT / 2, height: EDGE_HIT },
  edgeBottom: { bottom: -EDGE_HIT / 2, left: CORNER_HIT / 2, right: CORNER_HIT / 2, height: EDGE_HIT },
  edgeLeft: { left: -EDGE_HIT / 2, top: CORNER_HIT / 2, bottom: CORNER_HIT / 2, width: EDGE_HIT },
  edgeRight: { right: -EDGE_HIT / 2, top: CORNER_HIT / 2, bottom: CORNER_HIT / 2, width: EDGE_HIT },
  bar: { backgroundColor: colors.white, borderRadius: 2, filter: [{ dropShadow: { offsetX: 0, offsetY: 0, standardDeviation: 1, color: 'rgba(0,0,0,0.55)' } }] },
  barHorizontal: { width: 22, height: 4 },
  barVertical: { width: 4, height: 22 },
  instruction: { ...typography.text.caption, color: colors.mutedForeground, textAlign: 'center', paddingTop: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.background },
  footerAfterInstruction: { borderTopWidth: 0, paddingTop: spacing.sm },
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
