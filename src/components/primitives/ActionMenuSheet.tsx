import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, radii, shadows, spacing, typography } from '../../theme';

export type ActionMenuOption = {
  label: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: ActionMenuOption[];
  onClose: () => void;
};

export function ActionMenuSheet({ visible, title, subtitle, options, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const animation = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(animation, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 160,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [animation, visible]);

  const select = useCallback((option: ActionMenuOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    setTimeout(option.onPress, 220);
  }, [onClose]);

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [280, 0],
  });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: animation }]}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
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

          <View style={styles.options}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.label}
                style={styles.option}
                onPress={() => select(option)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                {option.icon ? (
                  <View style={[styles.iconBox, option.destructive && styles.iconBoxDestructive]}>
                    <Ionicons
                      name={option.icon}
                      size={21}
                      color={option.destructive ? colors.destructive : colors.primary}
                    />
                  </View>
                ) : null}
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionTitle, option.destructive && styles.optionTitleDestructive]}>
                    {option.label}
                  </Text>
                  {option.subtitle ? <Text style={styles.optionSubtitle}>{option.subtitle}</Text> : null}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={option.destructive ? `${colors.destructive}99` : colors.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
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
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(29, 27, 24, 0.45)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderCurve: 'continuous',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    marginBottom: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  title: {
    color: colors.foreground,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  subtitle: {
    marginTop: 2,
    color: colors.mutedForeground,
    fontSize: typography.size.sm,
  },
  options: { gap: spacing.sm, marginTop: spacing.lg },
  option: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderCurve: 'continuous',
  },
  iconBox: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: `${colors.primary}15`,
  },
  iconBoxDestructive: { backgroundColor: `${colors.destructive}15` },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: {
    color: colors.foreground,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  optionTitleDestructive: { color: colors.destructive },
  optionSubtitle: {
    marginTop: 2,
    color: colors.mutedForeground,
    fontSize: typography.size.xs,
  },
  cancelButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderCurve: 'continuous',
  },
  cancelText: {
    color: colors.mutedForeground,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
});
