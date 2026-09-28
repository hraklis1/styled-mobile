import { useEffect, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, spacing } from '../../theme';

function sentenceCase(value: string) {
  const lower = value.toLocaleLowerCase();
  const firstLetter = lower.match(/\p{L}/u)?.[0];
  return firstLetter ? lower.replace(firstLetter, firstLetter.toLocaleUpperCase()) : lower;
}

export function ClosetSearchFilters({ filters, onRemove }: { filters: string[]; onRemove: (index: number) => void }) {
  const list = useRef<ScrollView>(null);
  useEffect(() => { if (filters.length) list.current?.scrollToEnd({ animated: true }); }, [filters]);
  if (!filters.length) return null;
  return (
    <View style={styles.row}>
      <ScrollView ref={list} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {filters.map((filter, index) => (
          <View key={`${filter.toLocaleLowerCase()}-${index}`} style={styles.token}>
            <View pointerEvents="none" style={styles.pillBackground} />
            <Text numberOfLines={1} style={styles.label}>{sentenceCase(filter)}</Text>
            <PressableScale onPress={() => onRemove(index)} accessibilityRole="button"
              accessibilityLabel={`Remove search filter ${sentenceCase(filter)}`} contentStyle={styles.remove} hitSlop={4}>
              <Ionicons name="close" size={14} color={colors.mutedForeground} />
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
  token: { flexDirection: 'row', alignItems: 'center', maxWidth: 220, minHeight: 44, paddingLeft: spacing.md, paddingRight: spacing.xs },
  pillBackground: { position: 'absolute', top: 6, bottom: 6, left: 0, right: 0, backgroundColor: colors.surfaceSubtle, borderRadius: radii.full },
  label: { flexShrink: 1, fontSize: 13, color: colors.foreground },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full },
});
