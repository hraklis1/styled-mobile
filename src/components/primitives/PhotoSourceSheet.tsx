import { useEffect, useRef, useState } from 'react';
import { Modal, View, StyleSheet, Animated, Easing, Pressable, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, radii, shadows } from '../../theme';
import { SheetHeading, SheetRows, type SheetOption } from './SheetOptions';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  cameraLabel?: string;
  cameraHint?: string;
  libraryLabel?: string;
  libraryHint?: string;
  manualLabel?: string;
  manualHint?: string;
  onCamera: () => void;
  onLibrary: () => void;
  onManual?: () => void;
  onCancel: () => void;
  onDismiss?: () => void;
};

/** How far the sheet must be dragged down before letting go dismisses it. */
const DISMISS_DRAG = 80;

/**
 * Photo source chooser presented as its own RN Modal rather than a
 * BottomSheetModal — it has to render above a `presentationStyle="pageSheet"`
 * modal, and @gorhom sheets live in the root provider, i.e. underneath one.
 */
export function PhotoSourceSheet({
  visible,
  title,
  subtitle,
  cameraLabel = 'Take a photo',
  cameraHint = 'Use the camera right now',
  libraryLabel = 'From your photos',
  libraryHint = 'Pick from your camera roll',
  manualLabel = 'From your closet',
  manualHint = 'Select the pieces you wore',
  onCamera,
  onLibrary,
  onManual,
  onCancel,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  // The native Modal has to stay mounted through the slide-out, otherwise the
  // sheet vanishes instantly and only the entrance is ever animated.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
    }
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 160,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, anim, drag]);

  // Pull-down to dismiss, from the grabber and heading — the rows stay plain
  // taps. Kept in a ref so the latest onCancel is used without rebuilding.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DRAG || g.vy > 0.8) {
          onCancelRef.current();
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const translateY = Animated.add(
    anim.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }),
    drag,
  );

  const rows: SheetOption[] = [{ label: cameraLabel, hint: cameraHint, icon: 'camera-outline', onPress: onCamera }];
  rows.push({ label: libraryLabel, hint: libraryHint, icon: 'images-outline', onPress: onLibrary });
  if (onManual) rows.push({ label: manualLabel, hint: manualHint, icon: 'shirt-outline', onPress: onManual });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
      onDismiss={onDismiss}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Dismiss" />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            shadows.lg,
            { paddingBottom: Math.max(insets.bottom, spacing.lg), transform: [{ translateY }] },
          ]}
        >
          <View {...pan.panHandlers}>
            <View style={styles.grabber} />
            <SheetHeading title={title} subtitle={subtitle} />
          </View>

          <SheetRows options={rows} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(29, 27, 24, 0.45)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
});
