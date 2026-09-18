import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from './PressableScale';
import { colors, spacing, typography, radii, shadows } from '../../theme';

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
   * `filled` — a standalone, spatially separated row that
   * has to stand on its own without a section around it (an empty state).
   */
  variant?: 'ruled' | 'filled';
};

/** The app's one row idiom: an unboxed icon, a title/description pair, and a
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
      motion="crisp" scaleTo={0.985}
      pressedContentStyle={styles.pressed}
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
  pressed: { backgroundColor: colors.surfaceSelected },
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
    minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg,
    backgroundColor: colors.surfaceElevated, borderRadius: radii.card, ...shadows.actionCard,
  },
  iconRuled: {
    width: 28, height: 40, alignItems: 'flex-start', justifyContent: 'center',
  },
  iconFilled: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle, borderRadius: radii.panel,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.foreground, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold },
  description: { color: colors.mutedForeground, fontSize: typography.text.caption.fontSize, lineHeight: 17 },
  meta: { ...typography.text.caption, color: colors.primary, fontWeight: typography.weight.semibold, marginTop: 1 },
});
