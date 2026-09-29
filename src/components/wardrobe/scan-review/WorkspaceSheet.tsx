import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '../../../theme';

export type SheetDetent = 'medium' | 'large';

const MEDIUM = 0.56;
const LARGE = 0.9;
const SPRING = { damping: 26, stiffness: 260, mass: 0.9 } as const;

function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => setHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}

/**
 * A bottom sheet that lives inside the workspace's own tree. The workspace is
 * an RN Modal, and gorhom sheets render behind one (BoardPickerModal.tsx), so
 * pickers here use this instead of pushing a full-screen page: the garment
 * stays in view above a medium sheet, and a drag up gives the list more room.
 */
export function WorkspaceSheet({ title, subtitle, detent = 'medium', reduceMotion, dismissed = false, onClose, children, footer }: {
  title: string;
  subtitle?: ReactNode;
  detent?: SheetDetent;
  reduceMotion: boolean;
  /** Flip to true to play the exit animation; `onClose` fires when it ends. */
  dismissed?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const medium = Math.round(screenHeight * MEDIUM);
  const large = Math.round(Math.min(screenHeight * LARGE, screenHeight - insets.top - spacing.md));

  const sheetHeight = useSharedValue(detent === 'large' ? large : medium);
  const offset = useSharedValue(screenHeight);
  const backdrop = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const ease = { duration: reduceMotion ? 0 : 260, easing: Easing.out(Easing.cubic) };
    offset.value = withTiming(0, ease);
    backdrop.value = withTiming(1, ease);
  }, [backdrop, offset, reduceMotion]);

  // With the keyboard up there is no room for a medium sheet and a garment
  // above it, so the sheet takes what is left and the list stays usable.
  useEffect(() => {
    if (keyboard > 0) {
      const available = screenHeight - keyboard - insets.top - spacing.md;
      sheetHeight.value = withTiming(Math.min(large, available), { duration: reduceMotion ? 0 : 220 });
    } else {
      sheetHeight.value = withTiming(detent === 'large' ? large : medium, { duration: reduceMotion ? 0 : 220 });
    }
  }, [detent, insets.top, keyboard, large, medium, reduceMotion, screenHeight, sheetHeight]);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    Keyboard.dismiss();
    const ease = { duration: reduceMotion ? 0 : 200, easing: Easing.in(Easing.cubic) };
    backdrop.value = withTiming(0, ease);
    offset.value = withTiming(screenHeight, ease, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [backdrop, closing, offset, onClose, reduceMotion, screenHeight]);

  useEffect(() => {
    if (dismissed) close();
  }, [close, dismissed]);

  // Drag the grabber: up grows toward the large detent, down shrinks, and a
  // decisive pull below medium dismisses.
  const drag = Gesture.Pan()
    .onBegin(() => { dragStart.value = sheetHeight.value; })
    .onUpdate((event) => {
      const next = dragStart.value - event.translationY;
      if (next >= medium) {
        sheetHeight.value = Math.min(large + 24, next);
        offset.value = 0;
      } else {
        sheetHeight.value = medium;
        offset.value = medium - next;
      }
    })
    .onEnd((event) => {
      if (offset.value > 90 || (offset.value > 0 && event.velocityY > 900)) {
        runOnJS(close)();
        return;
      }
      offset.value = withSpring(0, SPRING);
      const target = event.velocityY < -600 || sheetHeight.value > (medium + large) / 2 ? large : medium;
      sheetHeight.value = withSpring(target, SPRING);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
    transform: [{ translateY: offset.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { bottom: keyboard }, sheetStyle]}>
        <GestureDetector gesture={drag}>
          <View style={styles.grabArea}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              {subtitle ? <View style={styles.subtitle}>{subtitle}</View> : null}
            </View>
          </View>
        </GestureDetector>
        <View style={styles.body}>{children}</View>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: keyboard > 0 ? spacing.sm : Math.max(insets.bottom, spacing.md) }]}>
            {footer}
          </View>
        ) : keyboard > 0 ? null : <View style={{ height: insets.bottom }} />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(31,26,22,0.28)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderCurve: 'continuous',
    backgroundColor: colors.background,
    boxShadow: '0 -10px 30px rgba(31,26,22,0.10)',
  },
  grabArea: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  grabber: { width: 36, height: 4, alignSelf: 'center', borderRadius: radii.full, backgroundColor: colors.border },
  header: { alignItems: 'center', gap: 2, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...typography.text.editorialSection, color: colors.foreground },
  subtitle: { alignItems: 'center', maxWidth: '100%' },
  body: { flex: 1 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
