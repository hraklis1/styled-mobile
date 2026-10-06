import { StyleSheet, View } from 'react-native';
import { MenuView } from '@expo/ui/community/menu';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '../primitives/AppText';
import { colors, spacing } from '../../theme';

export type ShortlistViewMode = 'pieces' | 'visits';

/**
 * The shortlist's "what am I looking at" settings — layout and Favorites —
 * folded into one labelled menu, so they cost one control instead of a
 * segmented row plus a chip. The label names the current view; a heart joins
 * it while Favorites narrows the list.
 */
export function ShortlistViewMenu({ value, favorites, summary, onChange, onToggleFavorites }: {
  value: ShortlistViewMode;
  favorites: boolean;
  /** Totals that used to sit above the list; shown as the menu's title. */
  summary: string;
  onChange: (value: ShortlistViewMode) => void;
  onToggleFavorites: () => void;
}) {
  const label = value === 'pieces' ? 'Pieces' : 'Visits';
  return (
    <MenuView
      title={summary}
      actions={[
        { id: 'visits', title: 'Visits', image: 'storefront', state: value === 'visits' ? 'on' : 'off' },
        { id: 'pieces', title: 'Pieces', image: 'square.grid.2x2', state: value === 'pieces' ? 'on' : 'off' },
        {
          id: 'show',
          title: '',
          displayInline: true,
          subactions: [{ id: 'favorites', title: 'Favorites only', image: favorites ? 'heart.fill' : 'heart', state: favorites ? 'on' : 'off' }],
        },
      ]}
      onPressAction={({ nativeEvent: { event } }) => {
        if (event === 'pieces' || event === 'visits') onChange(event);
        else if (event === 'favorites') onToggleFavorites();
      }}
    >
      <View
        style={styles.trigger}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`View: ${label}${favorites ? ', favorites only' : ''}. ${summary}`}
      >
        {favorites ? <Ionicons name="heart" size={14} color={colors.foreground} /> : null}
        <AppText variant="label">{label}</AppText>
        <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
      </View>
    </MenuView>
  );
}

const styles = StyleSheet.create({
  trigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
