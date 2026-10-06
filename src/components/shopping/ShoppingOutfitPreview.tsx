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
  editorial = false,
}: {
  look: ShoppingPriorityOutfitIdea;
  target: ShoppingPriorityTarget;
  wardrobe: ReadonlyMap<number, Item>;
  editorial?: boolean;
}) {
  const pieces = [...new Set(look.itemIds)]
    .map((id) => wardrobe.get(id))
    .filter((item): item is Item => !!item);
  if (!pieces.length) return null;
  const complete = !!look.label && pieces.length === look.itemIds.length && pieces.length >= 2;
  return (
    <View style={[styles.look, editorial && styles.editorialLook]}>
      <View
        style={styles.headingRow}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${complete ? look.label : 'Pair it with'}. With ${target.title}, the recommended piece to add.`}
      >
        <Text style={styles.heading}>{complete ? look.label : 'Pair it with'}</Text>
        <View style={styles.dot} />
        <Text style={styles.withNew} numberOfLines={1}>
          {editorial ? `1 new · ${pieces.length} you own` : 'with this piece'}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {editorial || pieces.length < 2 ? (
          <View
            style={[styles.tile, editorial && styles.editorialTile]}
            accessible
            accessibilityLabel={`${target.title}. Recommended piece to add.`}
          >
            <View style={styles.proposed}>
              <ShoppingStyleVisual plain={editorial} target={target} />
            </View>
            <Text style={styles.toAdd} numberOfLines={1}>
              {editorial ? target.title : 'To add'}
            </Text>
          </View>
        ) : null}
        {pieces.map((item) => (
          <View
            key={item.id}
            style={[styles.tile, editorial && styles.editorialTile]}
            accessible
            accessibilityLabel={`${item.name}. In your wardrobe.`}
          >
            <WardrobeThumbnail item={item} style={styles.owned} />
            <Text style={styles.caption} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  look: { gap: spacing.md },
  editorialLook: { gap: spacing.sm },
  editorialTile: { width: 96 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heading: { ...typography.text.label, color: colors.foreground },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: shoppingSurfaces.olive.accent,
  },
  withNew: { ...typography.text.caption, color: shoppingSurfaces.olive.accent, flexShrink: 1 },
  strip: { gap: spacing.md, paddingRight: spacing.md },
  tile: { width: 96, gap: spacing.xs },
  owned: { aspectRatio: 0.8 },
  proposed: {
    borderWidth: 1,
    borderColor: shoppingSurfaces.olive.accent,
    borderRadius: radii.photo,
  },
  caption: { ...typography.text.caption, color: colors.inkSubtle },
  toAdd: { ...typography.text.caption, color: shoppingSurfaces.olive.accent },
});
