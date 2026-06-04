import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../../theme';
import { BottomSheetDropdown } from './BottomSheetDropdown';

export function FitDropdown({ value, options, onChange }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  if (options.length === 0) {
    return (
      <View style={styles.disabledButton}>
        <Text style={styles.disabledText}>N/A for this category</Text>
      </View>
    );
  }
  return (
    <BottomSheetDropdown
      title="Fit"
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select fit…"
    />
  );
}

const styles = StyleSheet.create({
  disabledButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.card,
    minHeight: 44,
    opacity: 0.5,
  },
  disabledText: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
  },
});
