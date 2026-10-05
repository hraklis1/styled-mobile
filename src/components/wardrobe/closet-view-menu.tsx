import { View, StyleSheet } from 'react-native';
import { MenuView } from '@expo/ui/community/menu';
import { Ionicons } from '@expo/vector-icons';
import type { PiecesViewMode } from '../../lib/closet-preferences';
import { colors } from '../../theme';

export function ClosetViewMenu({ value, onChange, onSelect, selectionDisabled, label }: {
  value: PiecesViewMode; onChange: (value: PiecesViewMode) => void;
  onSelect: () => void; selectionDisabled: boolean; label: 'pieces' | 'outfits';
}) {
  return (
    <MenuView
      actions={[
        { id: 'grid', title: 'Grid · 2 per row', state: value === 'grid' ? 'on' : 'off' },
        { id: 'grid3', title: 'Grid · 3 per row', state: value === 'grid3' ? 'on' : 'off' },
        { id: 'list', title: 'List', state: value === 'list' ? 'on' : 'off' },
        { id: 'select', title: `Select ${label}`, attributes: { disabled: selectionDisabled } },
      ]}
      onPressAction={({ nativeEvent: { event } }) => {
        if (event === 'grid' || event === 'grid3' || event === 'list') onChange(event);
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
