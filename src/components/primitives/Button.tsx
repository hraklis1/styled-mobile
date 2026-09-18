import {
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { colors, spacing, typography, radii, shadows } from '../../theme';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';

// Need to match PressableScale's style interface for proper typings
type Size = 'md' | 'sm';

type Props = {
  label: string;
  variant?: Variant;
  /** `md` is the full-width CTA; `sm` is the header / inline pill. */
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Button({ label, variant = 'primary', size = 'md', loading = false, disabled, style, ...rest }: Props) {
  const isDisabled = disabled || loading;
  return (
    <PressableScale
      contentStyle={[styles.base, styles[size], styles[variant], isDisabled && styles.disabled]}
      pressedContentStyle={variant === 'primary' ? styles.primaryPressed : styles.pressed}
      motion="crisp" scaleTo={0.985}
      style={style}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={rest.accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.primaryForeground : colors.primary} />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Capsule actions grow with system text.
  base: {
    borderRadius: radii.action,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: {
    minHeight: 52, paddingHorizontal: spacing.page, paddingVertical: 14,
  },
  sm: {
    minHeight: 44, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  disabled: {
    opacity: 0.5,
  },
  // Variants
  primaryPressed: { backgroundColor: colors.primaryPressed },
  pressed: { backgroundColor: colors.surfaceSelected },
  primary: {
    ...shadows.control,
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  outline: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  // Labels
  label: {
    ...typography.text.label,
  },
  primaryLabel: {
    color: colors.primaryForeground,
  },
  secondaryLabel: {
    color: colors.secondaryForeground,
  },
  outlineLabel: {
    color: colors.foreground,
  },
  ghostLabel: {
    color: colors.primary,
  },
});
