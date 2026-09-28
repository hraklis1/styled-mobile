import { useEffect, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, spacing, typography } from '../../theme';

export function ClosetSearchFilters({ filters, onRemove }: { filters: string[]; onRemove: (index: number) => void }) {
  const list = useRef<ScrollView>(null);
  useEffect(() => { if (filters.length) list.current?.scrollToEnd({ animated: true }); }, [filters]);
  if (!filters.length) return null;
  return (
    <View style={styles.row}>
      <ScrollView ref={list} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {filters.map((filter, index) => (
          <View key={`${filter.toLocaleLowerCase()}-${index}`} style={styles.pill}>
            <Text numberOfLines={1} style={styles.label}>{filter}</Text>
            <PressableScale onPress={() => onRemove(index)} accessibilityRole="button"
              accessibilityLabel={`Remove search filter ${filter}`} contentStyle={styles.remove} hitSlop={4}>
              <Ionicons name="close" size={15} color={colors.mutedForeground} />
            </PressableScale>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.page, paddingBottom: spacing.xs },
  content: { alignItems: 'center', gap: spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'center', maxWidth: 220, minHeight: 44,
    paddingLeft: spacing.md, paddingRight: spacing.xs, backgroundColor: colors.surfaceSubtle, borderRadius: radii.full },
  label: { flexShrink: 1, ...typography.text.bodySmall, color: colors.foreground },
  remove: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full },
});
