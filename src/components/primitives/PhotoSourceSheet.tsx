import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, spacing, typography, radii, shadows } from '../../theme';

type Props = {
  visible: boolean;
  variant?: 'source' | 'quick-log';
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

/**
 * Photo source chooser presented as its own RN Modal rather than a
 * BottomSheetModal — it has to render above a `presentationStyle="pageSheet"`
 * modal, and @gorhom sheets live in the root provider, i.e. underneath one.
 */
export function PhotoSourceSheet({
  visible,
  variant = 'source',
  title,
  subtitle,
  cameraLabel = 'Take Photo',
  cameraHint = 'Use the camera right now',
  libraryLabel = 'From Library',
  libraryHint = 'Pick from your camera roll',
  manualLabel = 'Choose from your closet',
  manualHint = 'Select the pieces you wore yourself',
  onCamera,
  onLibrary,
  onManual,
  onCancel,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  // The native Modal has to stay mounted through the slide-out, otherwise the
  // sheet vanishes instantly and only the entrance is ever animated.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 160,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, anim]);

  const select = useCallback((fn: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fn();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [280, 0],
  });

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
          <View style={styles.grabber} />

          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <View style={[styles.options, variant === 'quick-log' && styles.quickOptions]}>
            <TouchableOpacity
              style={[styles.option, variant === 'quick-log' && styles.quickPrimaryOption]}
              onPress={() => select(onCamera)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={cameraLabel}
            >
              <View style={[styles.iconBox, variant === 'quick-log' && styles.quickPrimaryIconBox]}>
                <Ionicons
                  name="camera-outline"
                  size={22}
                  color={variant === 'quick-log' ? colors.primaryForeground : colors.primary}
                />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, variant === 'quick-log' && styles.quickPrimaryTitle]}>{cameraLabel}</Text>
                <Text style={[styles.optionSub, variant === 'quick-log' && styles.quickPrimarySub]}>{cameraHint}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={variant === 'quick-log' ? colors.primary : colors.border}
              />
            </TouchableOpacity>

            {onManual ? (
              <TouchableOpacity
                style={styles.option}
                onPress={() => select(onManual)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={manualLabel}
              >
                <View style={styles.iconBox}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{manualLabel}</Text>
                  <Text style={styles.optionSub}>{manualHint}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.border} />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.option, variant === 'quick-log' && styles.quickLibraryOption]}
              onPress={() => select(onLibrary)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={libraryLabel}
            >
              <View style={styles.iconBox}>
                <Ionicons name="image-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, variant === 'quick-log' && styles.quickLibraryTitle]}>{libraryLabel}</Text>
                <Text style={styles.optionSub}>{libraryHint}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.border} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
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
  title: {
    fontSize: typography.text.sectionTitle.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  subtitle: {
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  options: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  quickOptions: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  quickPrimaryOption: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  quickPrimaryIconBox: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
  },
  quickPrimaryTitle: {
    color: colors.primary,
  },
  quickPrimarySub: {
    color: colors.mutedForeground,
  },
  quickLibraryOption: {
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceSubtle,
  },
  quickLibraryTitle: {
    color: colors.mutedForeground,
    fontWeight: typography.weight.medium,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}18`,
  },
  optionText: { flex: 1 },
  optionTitle: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  optionSub: {
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  cancelText: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
});
