import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedProgressBar } from './AnimatedProgressBar';
import { colors, radii, spacing, typography } from '../../theme';

/** Tab bar (60 + inset, see RootNavigator) plus room for the raised Stylist button. */
export const TAB_BAR_CLEARANCE = 60 + 30;
/** One tray's height plus a gap, for a tray stacked above another. */
export const TRAY_STACK_OFFSET = 56;

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  title: string;
  detail?: string | null;
  /** 0–1; draws the thin progress line under the copy. */
  progress?: number | null;
  /** A spinner, or an icon; `leading` overrides both (e.g. a thumbnail). */
  busy?: boolean;
  icon?: IconName;
  iconMuted?: boolean;
  leading?: ReactNode;
  /** Inside the main tap target, after the copy (chevron, "Resume"). */
  trailing?: ReactNode;
  /** A separate tap target at the end of the pill (dismiss). */
  accessory?: { icon: IconName; label: string; onPress: () => void };
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Trays above this one in the stack (0 = sits right above the tab bar). */
  stackLevel?: number;
};

/**
 * The shared background-work pill above the tab bar, used by the batch import,
 * polish queue, unfinished-scan and outfit-scan trays.
 */
export function FloatingTray({
  title, detail, progress, busy, icon, iconMuted, leading, trailing, accessory,
  onPress, disabled, accessibilityLabel, accessibilityHint, stackLevel = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const bottom = insets.bottom + TAB_BAR_CLEARANCE + stackLevel * TRAY_STACK_OFFSET;

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom }]}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(220)}
        exiting={reduceMotion ? undefined : FadeOutDown.duration(180)}
        style={[styles.pill, leading ? styles.pillWithThumb : null]}
      >
        <TouchableOpacity
          style={styles.main}
          onPress={onPress}
          disabled={disabled}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? [title, detail].filter(Boolean).join('. ')}
          accessibilityHint={accessibilityHint}
          accessibilityLiveRegion="polite"
        >
          {leading ?? (busy ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : icon ? (
            <Ionicons name={icon} size={18} color={iconMuted ? colors.onPrimarySoftMuted : colors.primaryForeground} />
          ) : null)}
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {detail ? <Text style={styles.detail} numberOfLines={1}>{detail}</Text> : null}
            {progress != null ? (
              <AnimatedProgressBar
                progress={progress * 100}
                height={2}
                trackColor="rgba(255,255,255,0.18)"
                color={colors.primaryForeground}
                style={styles.progress}
              />
            ) : null}
          </View>
          {trailing}
        </TouchableOpacity>
        {accessory ? (
          <TouchableOpacity onPress={accessory.onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={accessory.label}>
            <Ionicons name={accessory.icon} size={16} color={colors.onPrimarySoftMuted} />
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** The chevron that says "tap to open". */
export function TrayChevron() {
  return <Ionicons name="chevron-up" size={16} color={colors.onPrimarySoftMuted} />;
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    maxWidth: 420,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pillWithThumb: { paddingVertical: spacing.xs, paddingLeft: spacing.xs, paddingRight: spacing.md },
  main: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  copy: { flexShrink: 1, gap: 2 },
  title: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  detail: { fontSize: typography.text.caption.fontSize, color: colors.onPrimarySoftMuted },
  progress: { marginTop: 4, minWidth: 160 },
});
