import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, spacing, typography } from '../../theme';

/**
 * The building blocks of a choose-how sheet (Add to your closet, Log today's
 * look, photo source). Equal hairline rows, ordered by likely use, and an
 * optional quiet link for the rare path — so every such sheet reads the
 * same, editorial way.
 */

type IconName = keyof typeof Ionicons.glyphMap;

export type SheetOption = {
  label: string;
  hint?: string;
  icon: IconName;
  onPress: () => void;
};

function tap(fn: () => void) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  fn();
}

export function SheetHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SheetRows({ options }: { options: SheetOption[] }) {
  return (
    <View style={styles.rows}>
      {options.map((option, i) => (
        <TouchableOpacity
          key={option.label}
          style={[styles.row, i > 0 && styles.rowDivider]}
          onPress={() => tap(option.onPress)}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityHint={option.hint}
        >
          <Ionicons name={option.icon} size={22} color={colors.foreground} />
          <View style={styles.text}>
            <Text style={styles.rowLabel}>{option.label}</Text>
            {option.hint ? <Text style={styles.rowHint}>{option.hint}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function SheetLink({ label, onPress }: Pick<SheetOption, 'label' | 'onPress'>) {
  return (
    <TouchableOpacity
      style={styles.link}
      onPress={() => tap(onPress)}
      activeOpacity={0.6}
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
    >
      <Text style={styles.linkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.text.editorialChapter,
    color: colors.foreground,
  },
  subtitle: {
    ...typography.text.editorialItalic,
    fontSize: 15,
    lineHeight: 21,
    color: colors.mutedForeground,
  },
  rows: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: {
    ...typography.text.actionTitle,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  rowHint: {
    ...typography.text.bodySmall,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  text: { flex: 1 },
  link: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  linkText: {
    ...typography.text.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    textDecorationLine: 'underline',
  },
});
