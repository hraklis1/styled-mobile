import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { FilterControl } from '../primitives/Editorial';
import { colors, spacing, typography } from '../../theme';

type Section = 'pieces' | 'outfits' | 'boards';
const sections: { value: Section; label: string }[] = [
  { value: 'pieces', label: 'Pieces' }, { value: 'outfits', label: 'Outfits' }, { value: 'boards', label: 'Boards' },
];

export function ClosetNavigation({ value, onChange, searchAvailable, searchOpen, query, onSearch, filterCount, onFilter }: {
  value: Section; onChange: (value: Section) => void;
  searchAvailable: boolean; searchOpen: boolean; query: string; onSearch: () => void;
  filterCount: number; onFilter?: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  // Tabs retain their full labels and touch targets at narrow/large-text sizes.
  const stacked = fontScale > 1.3 || width - spacing.page * 2 < 300 * fontScale;
  // iOS can retain intrinsic text widths after a live Dynamic Type change.
  // Remount only these controls so full labels are measured at the new scale.
  return (
    <View key={fontScale} style={[styles.navigation, stacked && styles.stacked]}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {sections.map(section => <PressableScale key={section.value} onPress={() => onChange(section.value)}
          accessibilityRole="tab" accessibilityLabel={section.label} accessibilityState={{ selected: value === section.value }}
          contentStyle={styles.tab}>
          <Text style={[styles.label, value === section.value && styles.selected]}>{section.label}</Text>
          {value === section.value && <View style={styles.underline} />}
        </PressableScale>)}
      </View>
      {(searchAvailable || onFilter) && <View style={[styles.controls, stacked && styles.controlsStacked]}>
        {searchAvailable && !searchOpen && <PressableScale onPress={onSearch} contentStyle={styles.search}
          accessibilityRole="button" accessibilityLabel={`${searchOpen ? 'Hide search for' : 'Search'} ${value}${query.trim() ? `, search active: ${query}` : ''}`}
          accessibilityState={{ expanded: searchOpen }}>
          <Ionicons name="search-outline" size={20} color={colors.foreground} />
        </PressableScale>}
        {onFilter && <FilterControl count={filterCount} onPress={onFilter} />}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.page, gap: spacing.sm, paddingBottom: spacing.xs },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  tabs: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  tab: { minWidth: 44, minHeight: 44, justifyContent: 'center', paddingVertical: spacing.sm },
  label: { ...typography.text.bodySmall, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  selected: { color: colors.foreground },
  underline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: colors.foreground, borderRadius: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  controlsStacked: { alignSelf: 'flex-end' },
  search: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
});
