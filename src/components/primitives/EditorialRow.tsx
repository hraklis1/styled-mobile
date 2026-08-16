import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from './PressableScale';
import { colors, radii, spacing, typography } from '../../theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  /** A short trailing line under the description, e.g. "3 pieces" — set in
   *  primary so it reads as a live figure rather than more prose. */
  meta?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /**
   * `ruled` — hairline-bottomed, transparent, for rows stacked inside an
   * editorial section (the default; matches the app's ruled sections).
   * `filled` — a quiet standalone block on `surfaceSubtle`, for a row that
   * has to stand on its own without a section around it (an empty state).
   */
  variant?: 'ruled' | 'filled';
};

/** The app's one row idiom: an icon square, a title/description pair, and a
 *  chevron. Used for navigation doorways, action prompts, and empty-state
 *  invitations alike — only the container changes with `variant`. */
export function EditorialRow({
  icon,
  title,
  description,
  meta,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  variant = 'ruled',
}: Props) {
  const filled = variant === 'filled';

  return (
    <PressableScale
      scaleTo={filled ? 0.99 : undefined}
      contentStyle={filled ? styles.rowFilled : styles.rowRuled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${description}`}
      accessibilityHint={accessibilityHint}
    >
      <View style={filled ? styles.iconFilled : styles.iconRuled}>
        <Ionicons name={icon} size={filled ? 17 : 18} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  rowRuled: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowFilled: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  iconRuled: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: `${colors.primary}12`,
  },
  iconFilled: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}14`,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  description: { color: colors.mutedForeground, fontSize: typography.size.xs, lineHeight: 17 },
  meta: { color: colors.primary, fontSize: 11, fontWeight: typography.weight.semibold, letterSpacing: 0.2, marginTop: 1 },
});
