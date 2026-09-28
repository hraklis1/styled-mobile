import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, spacing, typography } from '../../theme';

export function ClosetRecentSearches({ recent, onSelect, onClear }: {
  recent: string[]; onSelect: (query: string) => void; onClear: () => void;
}) {
  if (!recent.length) return null;
  const chip = (label: string) => (
    <PressableScale key={label} onPress={() => onSelect(label)} accessibilityRole="button"
      accessibilityLabel={`Search ${label}`}
      contentStyle={styles.touchTarget} motion="crisp">
      <View style={styles.pill}>
        <Text style={styles.label}>{label}</Text>
      </View>
    </PressableScale>
  );
  return <View style={styles.panel}>
    {recent.length > 0 && <View style={styles.recentRow}>
      <Text style={styles.caption}>Recent</Text>
      <ScrollView style={styles.recentScroll} horizontal keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
        {recent.slice(0, 3).map(label => chip(label))}
      </ScrollView>
      <PressableScale onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear recent searches" contentStyle={styles.clear}>
        <Text style={styles.caption}>Clear</Text>
      </PressableScale>
    </View>}

  </View>;
}
const styles = StyleSheet.create({
  panel: { paddingHorizontal: spacing.page, paddingBottom: spacing.sm, gap: spacing.xs },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recentScroll: { flex: 1, minWidth: 0 },
  chips: { alignItems: 'center', gap: spacing.sm },
  touchTarget: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  clear: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  caption: { ...typography.text.caption, color: colors.mutedForeground },
  label: { ...typography.text.bodySmall, color: colors.foreground },
});
