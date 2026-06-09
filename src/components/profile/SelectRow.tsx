import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';

export function SelectRow({ label, value, placeholder, onPress }: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.inner}>
        {!!label && <Text style={styles.label}>{label}</Text>}
        <Text style={value ? styles.value : styles.placeholder}>{value || placeholder}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.border} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  inner: { flex: 1, gap: 2 },
  label: { fontSize: typography.size.xs, color: colors.mutedForeground },
  value: { fontSize: typography.size.sm, color: colors.foreground, fontWeight: typography.weight.medium },
  placeholder: { fontSize: typography.size.sm, color: colors.mutedForeground },
});
