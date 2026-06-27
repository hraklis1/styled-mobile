import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import { PressableScale } from './PressableScale';

type IconName = keyof typeof Ionicons.glyphMap;

type HeaderAction = {
  label: string;
  icon: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  accessibilityLabel?: string;
};

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  subtitleNode?: ReactNode;
  eyebrow?: string;
  primaryAction?: HeaderAction;
  secondaryActions?: HeaderAction[];
  safeTop?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({
  title,
  subtitle,
  subtitleNode,
  eyebrow,
  primaryAction,
  secondaryActions = [],
  safeTop = true,
  style,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, safeTop && { paddingTop: insets.top + spacing.md }, style]}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitleNode ?? (subtitle ? <Text style={styles.headerSubtitle} numberOfLines={2}>{subtitle}</Text> : null)}
      </View>
      {(primaryAction || secondaryActions.length > 0) && (
        <View style={styles.headerActions}>
          {secondaryActions.map((action) => (
            <IconButton key={action.label} {...action} variant={action.variant ?? 'secondary'} />
          ))}
          {primaryAction ? <ActionButton {...primaryAction} /> : null}
        </View>
      )}
    </View>
  );
}

export function EditorialSection({
  title,
  actionLabel,
  onAction,
  children,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {actionLabel && onAction ? (
          <PressableScale
            haptic={false}
            onPress={onAction}
            contentStyle={styles.sectionAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.sectionActionText}>{actionLabel}</Text>
          </PressableScale>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function IconButton({
  label,
  icon,
  onPress,
  variant = 'secondary',
  accessibilityLabel,
  style,
}: HeaderAction & { style?: StyleProp<ViewStyle> }) {
  return (
    <PressableScale
      contentStyle={[styles.iconButton, styles[`${variant}IconButton`], style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Ionicons
        name={icon}
        size={19}
        color={variant === 'primary' ? colors.primaryForeground : colors.foreground}
      />
    </PressableScale>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  accessibilityLabel,
  style,
}: HeaderAction & { style?: StyleProp<ViewStyle> }) {
  return (
    <PressableScale
      contentStyle={[styles.actionButton, styles[`${variant}ActionButton`], style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Ionicons
        name={icon}
        size={16}
        color={variant === 'primary' ? colors.primaryForeground : colors.foreground}
      />
      <Text style={[styles.actionButtonText, variant === 'primary' && styles.primaryActionButtonText]}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segment, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <PressableScale
            key={option.value}
            haptic={false}
            scaleTo={0.98}
            contentStyle={[styles.segmentButton, active && styles.segmentButtonActive]}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function FilterControl({
  count = 0,
  onPress,
  label = 'Sort and filter',
}: {
  count?: number;
  onPress: () => void;
  label?: string;
}) {
  const active = count > 0;
  return (
    <PressableScale
      contentStyle={[styles.filterControl, active && styles.filterControlActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}${active ? `, ${count} active` : ''}`}
    >
      <Ionicons name="options-outline" size={18} color={active ? colors.primaryForeground : colors.foreground} />
      {active ? <Text style={styles.filterCount}>{count}</Text> : null}
    </PressableScale>
  );
}

export function EditorialCardMeta({
  title,
  subtitle,
  eyebrow,
  trailing,
  style,
  titleStyle,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[styles.cardMeta, style]}>
      <View style={styles.cardMetaCopy}>
        {eyebrow ? <Text style={styles.cardEyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
        <Text style={[styles.cardTitle, titleStyle]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 3 },
  eyebrow: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: typography.size.sm,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryIconButton: { backgroundColor: colors.primary },
  secondaryIconButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ghostIconButton: { backgroundColor: 'transparent' },
  actionButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
  },
  primaryActionButton: { backgroundColor: colors.primary },
  secondaryActionButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ghostActionButton: { backgroundColor: 'transparent' },
  actionButtonText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  primaryActionButtonText: { color: colors.primaryForeground },
  section: { marginBottom: spacing.xl },
  sectionHeader: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  sectionAction: { paddingVertical: spacing.xs, paddingLeft: spacing.md },
  sectionActionText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.full,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segmentButton: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
  },
  segmentButtonActive: {
    backgroundColor: colors.surfaceElevated,
    ...shadows.xs,
  },
  segmentText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  segmentTextActive: {
    color: colors.foreground,
    fontWeight: typography.weight.semibold,
  },
  filterControl: {
    minWidth: 42,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
  },
  filterControlActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterCount: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primaryForeground,
    fontVariant: ['tabular-nums'],
  },
  cardMeta: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardMetaCopy: { flex: 1, minWidth: 0, gap: 2 },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  cardSubtitle: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
});
