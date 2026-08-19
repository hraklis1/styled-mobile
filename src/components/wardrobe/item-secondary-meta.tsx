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

const styles = StyleSheet.create({
  meta: {
    fontSize: typography.text.caption.fontSize,
    lineHeight: 16,
    color: colors.mutedForeground,
  },
  brand: {
    color: colors.inkSubtle,
    fontWeight: typography.weight.medium,
  },
  separator: {
    color: colors.mutedForeground,
  },
  category: {
    color: colors.mutedForeground,
    fontWeight: typography.weight.regular,
  },
});
