import { View, Text, StyleSheet } from 'react-native';
import type { StylistSuggestions } from '../../../features/stylist/types';
import { isColorLight, resolveHex } from '../../../lib/colorUtils';
import { colors, radii, spacing, surfaces, typography } from '../../../theme';

const UNKNOWN_HEX = '#9CA3AF';

const CATEGORY_LABEL: Record<StylistSuggestions['items'][number]['category'], string> = {
  top: 'Top', bottom: 'Bottom', full_body: 'One-piece', shoes: 'Shoes', outerwear: 'Outerwear', accessory: 'Accessory',
};

/** Unowned ideas: a color swatch and a reason, never styled like an owned piece. */
export function StylistSuggestionTiles({ suggestions }: { suggestions: StylistSuggestions }) {
  return (
    <View style={s.root}>
      <Text accessibilityRole="header" style={s.title}>{suggestions.title}</Text>
      {suggestions.items.map((item, index) => {
        // An unrecognised color ("neutral") resolves to the generic fallback grey; an open swatch is more honest.
        const resolved = item.color ? resolveHex(item.color.toLowerCase()) : null;
        const hex = resolved && resolved !== UNKNOWN_HEX ? resolved : null;
        return (
          <View key={index} style={s.tile} accessible accessibilityLabel={`Suggestion: ${item.label}. ${item.why}`}>
            <View style={[s.swatch, hex ? { backgroundColor: hex } : s.swatchEmpty, hex && isColorLight(hex) ? s.swatchLight : null]} />
            <View style={s.copy}>
              <Text style={s.meta}>{CATEGORY_LABEL[item.category] ?? 'Idea'}{item.color ? ` · ${item.color}` : ''}</Text>
              <Text style={s.label}>{item.label}</Text>
              {!!item.why && <Text style={s.why}>{item.why}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: spacing.sm },
  title: { ...typography.text.editorialTitle, color: colors.foreground, marginBottom: spacing.xs },
  tile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: surfaces.plate },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  swatchLight: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  swatchEmpty: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.mutedForeground },
  copy: { flex: 1, gap: 2 },
  meta: { ...typography.text.eyebrow, color: colors.mutedForeground },
  label: { ...typography.text.label, color: colors.foreground },
  why: { ...typography.text.bodySmall, color: colors.mutedForeground },
});
