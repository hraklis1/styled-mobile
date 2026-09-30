import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, radii, spacing, typography } from '../../../theme';

export function BatchActionBar({ count, total, bottomInset, onSelectAll, onClear, onBrand, onDone }: {
  count: number; total: number; bottomInset: number;
  onSelectAll: () => void; onClear: () => void; onBrand: () => void; onDone: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const all = total > 0 && count === total;
  return <View style={[styles.container, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
    <View style={[styles.pill, fontScale > 1.3 && styles.wrap]}>
      <Pressable accessibilityRole="button" onPress={all ? onClear : onSelectAll} style={styles.action}>
        <Text style={styles.label}>{all ? 'Deselect all' : `Select all (${total})`}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: count === 0 }} disabled={count === 0}
        onPress={onBrand} style={[styles.action, styles.primary, count === 0 && { opacity: 0.45 }]}>
        <Text style={[styles.label, { color: colors.primaryForeground }]}>Tag brand</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onDone} style={styles.action}>
        <Text style={styles.label}>Done</Text>
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  pill: { padding: 6, gap: 4, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.border,
    boxShadow: '0px 4px 20px rgba(36,36,34,0.12)' },
  wrap: { flexWrap: 'wrap', borderRadius: radii.sheet },
  action: { minHeight: 44, minWidth: 44, flexGrow: 1, flexShrink: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.primary, borderRadius: radii.full },
  label: { ...typography.text.label, color: colors.foreground, textAlign: 'center' },
});
