import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { snapRoleLabel } from '../../lib/shoppingPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingCaptureRole, ShoppingSnap } from '../../types/shoppingSnap';

const MAX_ZOOM = 5;

/**
 * The photo at full size. A tag shot is the whole reason this exists — a
 * price, a size and a composition list read fine at arm's length in the shop
 * and not at all in a 92pt thumbnail — so it opens on a plain tap and zooms
 * to five times, which is enough to read care-label print.
 */
export function ShoppingPhotoViewer({
  snaps,
  initialSnapId,
  itemLabel,
  roleFor,
  onCycleRole,
  onSelect,
  onClose,
}: {
  snaps: ShoppingSnap[];
  initialSnapId: string;
  itemLabel: string;
  roleFor: (snapId: string) => ShoppingCaptureRole;
  onCycleRole: (snapId: string) => void;
  onSelect: (snapId: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const initialIndex = Math.max(0, snaps.findIndex((snap) => snap.id === initialSnapId));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  // Landing on the tapped photo has to happen after the scroll view has been
  // given its width, or the offset is applied to a zero-width page.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: initialIndex * width, animated: false });
  }, [initialIndex, width]);

  const activeSnap = snaps[activeIndex] ?? snaps[0];
  const role = activeSnap ? roleFor(activeSnap.id) : 'unknown';

  const handleMomentumEnd = useCallback((offsetX: number) => {
    const next = Math.round(offsetX / width);
    setActiveIndex((current) => (current === next ? current : next));
  }, [width]);

  if (!activeSnap) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => handleMomentumEnd(event.nativeEvent.contentOffset.x)}
        >
          {snaps.map((snap) => (
            <ZoomablePhoto
              key={snap.id}
              uri={snap.imageUri}
              width={width}
              height={height}
              onZoomChange={setZoomed}
            />
          ))}
        </ScrollView>

        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity style={styles.iconButton} onPress={onClose} accessibilityLabel="Close photo">
            <Ionicons name="close" size={22} color={colors.primaryForeground} />
          </TouchableOpacity>
          <Text style={styles.counter}>
            {itemLabel}
            {snaps.length > 1 ? ` · ${activeIndex + 1} of ${snaps.length}` : ''}
          </Text>
          <View style={styles.iconButton} />
        </View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            style={styles.roleButton}
            onPress={() => {
              void Haptics.selectionAsync();
              onCycleRole(activeSnap.id);
            }}
            accessibilityLabel={`Change photo role from ${snapRoleLabel(role)}`}
          >
            <Ionicons name="pricetag-outline" size={16} color={colors.primaryForeground} />
            <Text style={styles.roleText}>{snapRoleLabel(role)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => onSelect(activeSnap.id)}
            accessibilityLabel="Select this photo and go back to the grouping"
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.foreground} />
            <Text style={styles.selectText}>Select this photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/**
 * One page of the viewer. Zoom is anchored on the pinch focus rather than the
 * middle of the screen, because the thing worth enlarging on a tag is almost
 * never in the middle. Releasing below 1x snaps back, so the page cannot be
 * left in a state where paging is off and nothing looks wrong.
 */
function ZoomablePhoto({
  uri,
  width,
  height,
  onZoomChange,
}: {
  uri: string;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(0.8, savedScale.value * event.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        reset();
        runOnJS(onZoomChange)(false);
        return;
      }
      savedScale.value = scale.value;
      runOnJS(onZoomChange)(true);
    });

  // Only claims the finger once zoomed in; below that the paging scroll view
  // keeps it, so swiping between photos still works.
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((event) => {
      if (savedScale.value <= 1) return;
      const bound = (width * (savedScale.value - 1)) / 2;
      const boundY = (height * (savedScale.value - 1)) / 2;
      translateX.value = Math.min(bound, Math.max(-bound, savedX.value + event.translationX));
      translateY.value = Math.min(boundY, Math.max(-boundY, savedY.value + event.translationY));
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        reset();
        runOnJS(onZoomChange)(false);
        return;
      }
      scale.value = withTiming(2.5);
      savedScale.value = 2.5;
      runOnJS(onZoomChange)(true);
    });

  const composed = Gesture.Simultaneous(pinch, Gesture.Race(doubleTap, pan));

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={{ width, height }}>
        <Animated.View style={[{ flex: 1 }, style]}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
  counter: { flex: 1, textAlign: 'center', fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground, fontVariant: ['tabular-nums'] },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  roleButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: 'rgba(0,0,0,0.45)' },
  roleText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  selectButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: colors.primaryForeground },
  selectText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
});
