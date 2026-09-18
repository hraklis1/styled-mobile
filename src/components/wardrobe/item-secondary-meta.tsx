import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, typography } from '../../theme';
import { CATEGORY_LABELS, type Item } from '../../types/item';

export function ItemSecondaryMeta({
  item,
  style,
}: {
  item: Pick<Item, 'brand' | 'category'>;
  style?: StyleProp<TextStyle>;
}) {
  const brand = item.brand?.trim() || null;
  const category = item.category ? CATEGORY_LABELS[item.category] : null;

  if (!brand && !category) return null;

  return (
    <Text style={[styles.meta, style]} numberOfLines={1}>
      {brand ? <Text style={styles.brand}>{brand}</Text> : null}
      {brand && category ? <Text style={styles.separator}> · </Text> : null}
      {category ? <Text style={styles.category}>{category}</Text> : null}
    </Text>
  );
}

// A line-sheet caption: tracked small caps, brand a shade darker than the
// category so the eye lands on the maker first.
const styles = StyleSheet.create({
  meta: {
    ...typography.text.metaSheet,
    color: colors.mutedForeground,
  },
  brand: {
    color: colors.inkSubtle,
  },
  separator: {
    color: colors.mutedForeground,
  },
  category: {
    color: colors.mutedForeground,
  },
});
