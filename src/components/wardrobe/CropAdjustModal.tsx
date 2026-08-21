import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '../../theme';

export type Bbox = { x: number; y: number; width: number; height: number };

const MIN_FRAC = 0.1;
const CORNER_HIT = 44;

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
};

export function CropAdjustEditor({ sourceImage, initialBbox, itemName, onApply, onCancel }: Props) {
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
    }), [bounds, centerX, centerY, cropHeight, cropWidth, startBottom, startLeft, startRight, startTop]);

  const topLeftGesture = useMemo(() => resizeGesture(true, true), [resizeGesture]);
  const topRightGesture = useMemo(() => resizeGesture(false, true), [resizeGesture]);
  const bottomLeftGesture = useMemo(() => resizeGesture(true, false), [resizeGesture]);
  const bottomRightGesture = useMemo(() => resizeGesture(false, false), [resizeGesture]);

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
          <Text style={styles.title}>Adjust crop</Text>
          <Text style={styles.subtitle}>Drag to move · corners to resize · pinch to zoom</Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={resetCrop} accessibilityLabel="Reset crop">
          <Ionicons name="refresh" size={21} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View
        style={styles.canvas}
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
            <CropCorner style={styles.cornerTopLeft} gesture={topLeftGesture} />
            <CropCorner style={styles.cornerTopRight} gesture={topRightGesture} />
            <CropCorner style={styles.cornerBottomLeft} gesture={bottomLeftGesture} />
            <CropCorner style={styles.cornerBottomRight} gesture={bottomRightGesture} />
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} accessibilityRole="button">
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

function CropCorner({ style, gesture }: { style: object; gesture: ReturnType<typeof Gesture.Pan> }) {
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.cornerHit, style]}>
        <View style={styles.cornerDot} />
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
  canvas: { flex: 1, overflow: 'hidden', backgroundColor: colors.secondary },
  image: { position: 'absolute' },
  dim: { position: 'absolute', backgroundColor: 'rgba(24,20,17,0.58)' },
  topDim: { top: 0, left: 0, right: 0 },
  bottomDim: { bottom: 0, left: 0, right: 0 },
  leftDim: { left: 0 },
  rightDim: { right: 0 },
  cropFrame: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.95)' },
  gridV1: { position: 'absolute', top: 0, bottom: 0, left: '33.33%', width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)' },
  gridV2: { position: 'absolute', top: 0, bottom: 0, left: '66.67%', width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)' },
  gridH1: { position: 'absolute', left: 0, right: 0, top: '33.33%', height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)' },
  gridH2: { position: 'absolute', left: 0, right: 0, top: '66.67%', height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)' },
  cornerHit: { position: 'absolute', width: CORNER_HIT, height: CORNER_HIT, alignItems: 'center', justifyContent: 'center' },
  cornerTopLeft: { left: -CORNER_HIT / 2, top: -CORNER_HIT / 2 },
  cornerTopRight: { right: -CORNER_HIT / 2, top: -CORNER_HIT / 2 },
  cornerBottomLeft: { left: -CORNER_HIT / 2, bottom: -CORNER_HIT / 2 },
  cornerBottomRight: { right: -CORNER_HIT / 2, bottom: -CORNER_HIT / 2 },
  cornerDot: { width: 18, height: 18, borderRadius: 3, backgroundColor: colors.white, boxShadow: '0 1px 4px rgba(0,0,0,0.35)' },
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
