import { View, StyleSheet } from 'react-native';
import { MenuView } from '@expo/ui/community/menu';
import { Ionicons } from '@expo/vector-icons';
import type { PiecesViewMode } from '../../lib/closet-preferences';
import { colors } from '../../theme';

const VIEW_TITLES: Record<PiecesViewMode, string> = {
  grid: 'Grid · 2 per row',
  grid3: 'Grid · 3 per row',
  grid4: 'Grid · 4 per row',
  rails: 'By category',
  list: 'List',
};

export function ClosetViewMenu({ value, onChange, onSelect, selectionDisabled, label, modes = ['grid', 'grid3', 'list'] }: {
  value: PiecesViewMode; onChange: (value: PiecesViewMode) => void;
  onSelect: () => void; selectionDisabled: boolean; label: 'pieces' | 'outfits';
  modes?: PiecesViewMode[];
}) {
  return (
    <MenuView
      actions={[
        ...modes.map(id => ({ id, title: VIEW_TITLES[id], state: value === id ? 'on' as const : 'off' as const })),
        { id: 'select', title: `Select ${label}`, attributes: { disabled: selectionDisabled } },
      ]}
      onPressAction={({ nativeEvent: { event } }) => {
        if ((modes as string[]).includes(event)) onChange(event as PiecesViewMode);
        else if (event === 'select' && !selectionDisabled) onSelect();
      }}
    >
      <View style={styles.trigger} accessible accessibilityRole="button" accessibilityLabel={`View options for ${label}`}>
        <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
      </View>
    </MenuView>
  );
}
const styles = StyleSheet.create({
  trigger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
