import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Item } from '../../types/item';
import type {
  ShoppingPriorityOutfitIdea,
  ShoppingPriorityTarget,
} from '../../lib/shoppingPriorityEdit';
import { colors, radii, shoppingSurfaces, spacing, typography } from '../../theme';
import { WardrobeThumbnail } from './WardrobeThumbnail';
import { ShoppingStyleVisual } from './ShoppingStyleVisual';

export function ShoppingOutfitPreview({
  look,
  target,
  wardrobe,
}: {
  look: ShoppingPriorityOutfitIdea;
  target: ShoppingPriorityTarget;
  wardrobe: ReadonlyMap<number, Item>;
}) {
  const pieces = [...new Set(look.itemIds)]
    .map((id) => wardrobe.get(id))
    .filter((item): item is Item => !!item);
  if (!pieces.length) return null;
  const complete = !!look.label && pieces.length === look.itemIds.length && pieces.length >= 2;
  return (
    <View style={styles.look}>
      <Text style={styles.heading} accessibilityRole="header">
        {complete ? look.label : 'Pair it with'}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        <View
          style={styles.tile}
          accessible
          accessibilityLabel={`${target.title}. Recommended piece to add.`}
        >
          <View style={styles.proposed}>
            <ShoppingStyleVisual target={target} />
          </View>
          <Text style={styles.toAdd}>To add</Text>
          <Text style={styles.caption}>{target.title}</Text>
        </View>
        {pieces.map((item) => (
          <View
            key={item.id}
            style={styles.tile}
            accessible
            accessibilityLabel={`${item.name}. In your wardrobe.`}
          >
            <WardrobeThumbnail item={item} style={styles.owned} />
            <Text style={styles.caption}>{item.name}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  look: { gap: spacing.md },
  heading: { ...typography.text.label, color: colors.foreground },
  strip: { gap: spacing.md, paddingRight: spacing.md },
  tile: { width: 88, gap: spacing.xs },
  owned: { aspectRatio: 0.8 },
  proposed: {
    borderWidth: 1,
    borderColor: shoppingSurfaces.olive.accent,
    borderRadius: radii.photo,
  },
  caption: { ...typography.text.bodySmall, color: colors.inkSubtle },
  toAdd: { ...typography.text.bodySmall, color: shoppingSurfaces.olive.accent },
});
