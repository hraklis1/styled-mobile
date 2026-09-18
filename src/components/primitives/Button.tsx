import {
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { colors, spacing, typography, radii } from '../../theme';
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
      style={style}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={rest.accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled }}
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
  // Actions share a quiet, squared treatment and grow with larger text.
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
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
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
