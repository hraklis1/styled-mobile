import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, spacing, typography } from '../../theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  meta?: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

/** A quiet, editorial doorway into a full Shop destination. */
export function ShopDestinationRow({
  icon,
  title,
  description,
  meta,
  onPress,
  accessibilityLabel,
}: Props) {
  return (
    <PressableScale
      contentStyle={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${description}`}
      accessibilityHint="Opens this Shop page"
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: `${colors.primary}12`,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.foreground, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  description: { color: colors.mutedForeground, fontSize: typography.size.xs, lineHeight: 17 },
  meta: { color: colors.primary, fontSize: 11, fontWeight: typography.weight.semibold, letterSpacing: 0.2 },
});
