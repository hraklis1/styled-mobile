import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../../theme';

interface ChipProps {
  label: string;
  color?: string;
}

export function Chip({ label, color: bg }: ChipProps) {
  return (
    <View style={[styles.chip, bg ? { backgroundColor: bg + '22', borderColor: bg + '55' } : null]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
});
