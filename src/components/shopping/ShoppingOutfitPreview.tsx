import { useState } from 'react';
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
  hideAnchor = false,
  onTilesOffset,
}: {
  look: ShoppingPriorityOutfitIdea;
  target: ShoppingPriorityTarget;
  wardrobe: ReadonlyMap<number, Item>;
  editorial?: boolean;
  /** Inside a ShoppingOutfitGroup: the new piece is shown once beside all the looks. */
  hideAnchor?: boolean;
  /** Reports where this look's tiles begin, so a group can line its piece up with them. */
  onTilesOffset?: (y: number) => void;
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
          {hideAnchor ? `${pieces.length} you own` : editorial ? `1 new · ${pieces.length} you own` : 'with this piece'}
        </Text>
      </View>
      <ScrollView
        onLayout={onTilesOffset ? (event) => onTilesOffset(event.nativeEvent.layout.y) : undefined}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {!hideAnchor && (editorial || pieces.length < 2) ? (
          <View
            style={[styles.tile, editorial && styles.editorialTile]}
            accessible
            accessibilityLabel={`${target.title}. Recommended piece to add.`}
          >
            <View style={styles.proposed}>
              <ShoppingStyleVisual plain={editorial} target={target} />
              {editorial ? <Text style={styles.newTag}>NEW</Text> : null}
            </View>
            <Text style={styles.toAdd} numberOfLines={editorial ? 2 : 1}>
              {editorial ? target.title : 'To add'}
            </Text>
          </View>
        ) : null}
        {editorial && !hideAnchor ? <View style={styles.divider} /> : null}
        {pieces.map((item) => (
          <View
            key={item.id}
            style={[styles.tile, editorial && styles.editorialTile, hideAnchor && styles.groupedTile]}
            accessible
            accessibilityLabel={`${item.name}. In your wardrobe.`}
          >
            <WardrobeThumbnail item={item} style={styles.owned} />
            <Text style={styles.caption} numberOfLines={editorial ? 2 : 1}>
              {item.name}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
/**
 * Several looks for one new piece: the piece once, on the left, with each
 * look's owned pieces stacked beside it, so it reads as one piece worn
 * several ways rather than the same tile repeated per row.
 */
export function ShoppingOutfitGroup({
  looks,
  target,
  wardrobe,
}: {
  looks: ShoppingPriorityOutfitIdea[];
  target: ShoppingPriorityTarget;
  wardrobe: ReadonlyMap<number, Item>;
}) {
  // The piece starts level with the first look's photos, not its heading.
  const [tilesOffset, setTilesOffset] = useState(0);
  return (
    <View style={styles.group}>
      <View style={[styles.anchor, { paddingTop: tilesOffset }]} accessible accessibilityLabel={`${target.title}. Recommended piece to add, worn ${looks.length} ways.`}>
        <View style={styles.proposed}>
          <ShoppingStyleVisual plain fill target={target} />
          <Text style={styles.newTag}>NEW</Text>
        </View>
        <Text style={styles.toAdd} numberOfLines={2}>{target.title}</Text>
      </View>
      <View style={styles.groupRule} />
      <View style={styles.groupLooks}>
        {looks.map((look, index) => (
          <ShoppingOutfitPreview editorial hideAnchor onTilesOffset={index === 0 ? setTilesOffset : undefined} key={`${target.key}-${index}`} look={look} target={target} wardrobe={wardrobe} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  look: { gap: spacing.md },
  editorialLook: { gap: spacing.sm },
  editorialTile: { width: 96 },
  groupedTile: { width: 72 },
  group: { flexDirection: 'row', gap: spacing.md },
  anchor: { width: 88, gap: spacing.xs },
  groupRule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  groupLooks: { flex: 1, gap: spacing.xl },
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
  newTag: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    ...typography.text.meta,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
    paddingHorizontal: 4,
    borderRadius: radii.sm,
    overflow: 'hidden',
    color: colors.primaryForeground,
    backgroundColor: shoppingSurfaces.olive.accent,
  },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: spacing.sm, backgroundColor: colors.border },
  caption: { ...typography.text.caption, color: colors.inkSubtle },
  toAdd: { ...typography.text.caption, color: shoppingSurfaces.olive.accent },
});
