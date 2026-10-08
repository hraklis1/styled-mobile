import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import * as Haptics from '../../lib/haptics';

import { AppText } from './AppText';
import { colors, radii, shadows, spacing, typography } from '../../theme';

export type ConfirmSheetRequest = {
  title: string;
  message?: string;
  /** Thumbnails of what the action affects, so the decision is visual. */
  images?: string[];
  confirmLabel: string;
  /** null hides the cancel button, for a notice with a single acknowledgement. */
  cancelLabel?: string | null;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Runs when the cancel button is pressed (not on a plain dismiss). */
  onCancel?: () => void;
  /** False when the choice must be made: no backdrop or back-gesture dismiss. */
  dismissible?: boolean;
};

const MAX_THUMBS = 4;

const useConfirmSheetStore = create<{ request: ConfirmSheetRequest | null; nestedHosts: number }>(() => ({ request: null, nestedHosts: 0 }));

/**
 * Imperative entry point, shaped like Alert.alert so call sites swap in
 * one-for-one. Rendered by the single ConfirmSheetHost at the app root.
 */
export function confirmSheet(request: ConfirmSheetRequest) {
  useConfirmSheetStore.setState({ request });
}

/**
 * iOS presents a Modal from the root view controller, which refuses while a
 * native modal screen (e.g. Profile) is already up — the sheet silently never
 * shows. Screens presented that way mount their own `nested` host, and the
 * root host stands aside while one exists.
 */
export function ConfirmSheetHost({ nested = false }: { nested?: boolean }) {
  const request = useConfirmSheetStore((state) => state.request);
  const nestedHosts = useConfirmSheetStore((state) => state.nestedHosts);
  useEffect(() => {
    if (!nested) return undefined;
    useConfirmSheetStore.setState((state) => ({ nestedHosts: state.nestedHosts + 1 }));
    return () => useConfirmSheetStore.setState((state) => ({ nestedHosts: state.nestedHosts - 1 }));
  }, [nested]);
  const active = nested || nestedHosts === 0;
  return <ConfirmSheet request={active ? request : null} onClose={() => useConfirmSheetStore.setState({ request: null })} />;
}

/**
 * The app's own confirmation, in place of the system alert: same sheet,
 * scrim and motion as ActionMenuSheet, with an editorial title and the
 * affected photos shown rather than counted.
 */
export function ConfirmSheet({ request, onClose }: { request: ConfirmSheetRequest | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const animation = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<ConfirmSheetRequest | null>(request);
  const [busy, setBusy] = useState(false);
  const visible = request !== null;

  useEffect(() => {
    if (request) { setShown(request); setBusy(false); }
    Animated.timing(animation, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 160,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setShown(null);
    });
  }, [animation, request, visible]);

  if (!shown) return null;

  const confirm = async () => {
    if (busy) return;
    Haptics.impactAsync(shown.destructive ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    try {
      await shown.onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  const cancel = () => {
    shown.onCancel?.();
    onClose();
  };
  const dismiss = busy || shown.dismissible === false ? undefined : onClose;

  const thumbs = (shown.images ?? []).slice(0, MAX_THUMBS);
  const overflow = (shown.images?.length ?? 0) - thumbs.length;
  const translateY = animation.interpolate({ inputRange: [0, 1], outputRange: [320, 0] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss ?? (() => {})}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: animation }]}>
          <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Dismiss" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, shadows.lg, { paddingBottom: Math.max(insets.bottom, spacing.lg), transform: [{ translateY }] }]}
        >
          <View style={styles.grabber} />
          {thumbs.length > 0 ? (
            <View style={styles.thumbs} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {thumbs.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.thumb}>
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                  {index === thumbs.length - 1 && overflow > 0 ? (
                    <View style={styles.overflow}><AppText variant="label" style={styles.overflowText}>+{overflow}</AppText></View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          <AppText variant="editorialCompact" accessibilityRole="header">{shown.title}</AppText>
          {shown.message ? <AppText variant="bodySmall" tone="muted" style={styles.message}>{shown.message}</AppText> : null}
          <Pressable
            onPress={() => void confirm()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ busy }}
            style={({ pressed }) => [styles.confirm, shown.destructive && styles.confirmDestructive, pressed && styles.pressed]}
          >
            {busy
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <AppText variant="label" style={styles.confirmText}>{shown.confirmLabel}</AppText>}
          </Pressable>
          {shown.cancelLabel === null ? null : <Pressable onPress={cancel} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
            <AppText variant="label" tone="muted">{shown.cancelLabel ?? 'Cancel'}</AppText>
          </Pressable>}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(29, 27, 24, 0.45)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, marginBottom: spacing.lg, borderRadius: radii.full, backgroundColor: colors.border },
  thumbs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  thumb: { width: 56, height: 72, overflow: 'hidden', borderRadius: radii.sm, borderCurve: 'continuous', backgroundColor: colors.surfaceSubtle },
  overflow: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(29, 27, 24, 0.45)' },
  overflowText: { color: colors.primaryForeground },
  message: { marginTop: spacing.xs },
  confirm: {
    minHeight: 52,
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  confirmDestructive: { backgroundColor: colors.destructive },
  confirmText: { color: colors.primaryForeground, fontWeight: typography.weight.semibold },
  cancel: { minHeight: 48, marginTop: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full },
  pressed: { opacity: 0.7 },
});
