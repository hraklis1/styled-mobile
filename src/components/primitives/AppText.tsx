import {
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { colors, typography } from '../../theme';

export type AppTextVariant = keyof typeof typography.text;
export type AppTextTone = keyof typeof textTones;

const textTones = {
  primary: colors.foreground,
  secondary: colors.inkSubtle,
  muted: colors.mutedForeground,
  brand: colors.primary,
  action: colors.action,
  inverse: colors.primaryForeground,
  danger: colors.error,
  success: colors.success,
} as const;

export type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  tone?: AppTextTone;
  style?: StyleProp<TextStyle>;
};

/**
 * Shared typography primitive. Use a semantic variant and tone rather than
 * rebuilding a size/weight/family/color combination in each screen.
 */
export function AppText({
  variant = 'body',
  tone = 'primary',
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[typography.text[variant], { color: textTones[tone] }, style]}
    />
  );
}
