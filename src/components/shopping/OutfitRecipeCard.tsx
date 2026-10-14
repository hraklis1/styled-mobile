import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Item } from '../../types/item';
import type { ShoppingPriorityOutfitIdea, ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import { colors, radii, shoppingSurfaces, spacing, typography } from '../../theme';
import { WardrobeThumbnail } from './WardrobeThumbnail';
import { ShoppingStyleVisual } from './ShoppingStyleVisual';
import { ItemDetailSheet } from '../stylist/ChatItemDetailSheet';
import { OpenItemContext } from '../stylist/stylistItemContext';

/**
 * Every look uses the same tile size, so 2 and 6 pieces read alike. At this
 * width a phone shows about three and a half, so the next piece peeks past
 * the card's edge and signals the strip scrolls.
 */
const TILE_WIDTH = 92;

/** The owned pieces of a look that still exist in the wardrobe, deduped. */
export function recipePieces(look: ShoppingPriorityOutfitIdea, wardrobe: ReadonlyMap<number, Item>): Item[] {
  return [...new Set(look.itemIds)].map(id => wardrobe.get(id)).filter((item): item is Item => !!item);
}

export function recipeSynergy(ownedCount: number): string {
  return `✓ ${ownedCount} in your closet · 1 new`;
}

/**
 * One way to wear a suggested piece, as a whole outfit: the new piece sits
 * inline with the owned pieces it is worn with, rather than pinned apart.
 */
export function OutfitRecipeCard({
  look,
  target,
  wardrobe,
  onOpenItem,
}: {
  look: ShoppingPriorityOutfitIdea;
  target: ShoppingPriorityTarget;
  wardrobe: ReadonlyMap<number, Item>;
  /** Opens an owned piece's full page; offered from the quick-look sheet. */
  onOpenItem?: (itemId: number) => void;
}) {
  const [detail, setDetail] = useState<Item | null>(null);
  const pieces = recipePieces(look, wardrobe);
  if (!pieces.length) return null;
  // A look that lost pieces to deletion is no longer the outfit it was named for.
  const complete = !!look.label && pieces.length === look.itemIds.length;
  const title = complete ? look.label : 'Pair it with';

  return (
    <View style={styles.card}>
      <View style={styles.header} accessible accessibilityRole="header"
        accessibilityLabel={`${title}. ${pieces.length} in your closet, 1 new: ${target.title}.`}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.pill}>{recipeSynergy(pieces.length)}</Text>
      </View>
      {/* Bleeds to the card's edges so pieces scroll under its rounded clip. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.row}>
        <PieceTile anchor label={target.title} accessibilityLabel={`${target.title}. Recommended piece to add.`}>
          <ShoppingStyleVisual plain fill target={target} />
        </PieceTile>
        {pieces.map(item => (
          <PieceTile key={item.id} label={item.name} accessibilityLabel={`${item.name}. In your wardrobe.`} onPress={() => setDetail(item)}>
            <WardrobeThumbnail item={item} style={styles.fill} />
          </PieceTile>
        ))}
      </ScrollView>
      <OpenItemContext.Provider value={onOpenItem}>
        <ItemDetailSheet item={detail} onClose={() => setDetail(null)} />
      </OpenItemContext.Provider>
    </View>
  );
}

/**
 * One piece in a look. The anchor (the piece to buy) and owned pieces share
 * the same frame and label box, so photos and captions stay on one baseline
 * whether a caption runs to one line or two.
 */
function PieceTile({
  anchor = false,
  label,
  accessibilityLabel,
  onPress,
  children,
}: {
  anchor?: boolean;
  label: string;
  accessibilityLabel: string;
  onPress?: () => void;
  children: ReactNode;
}) {
  const body = (
    <>
      <View style={[styles.frame, anchor && styles.anchorFrame]}>
        {children}
        {anchor ? <Text style={styles.newTag}>NEW</Text> : null}
      </View>
      <Text style={[styles.label, anchor && styles.anchorLabel]} numberOfLines={2} ellipsizeMode="tail">{label}</Text>
    </>
  );
  if (!onPress) {
    return <View style={styles.tile} accessible accessibilityLabel={accessibilityLabel}>{body}</View>;
  }
  return (
    <Pressable style={({ pressed }) => [styles.tile, pressed && styles.pressed]} onPress={onPress}
      accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint="Shows the piece">
      {body}
    </Pressable>
  );
}

/** Two caption lines, so one-line labels reserve the same height as two-line ones. */
const LABEL_MIN_HEIGHT = typography.text.caption.lineHeight * 2;

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.text.label, color: colors.foreground, flexShrink: 1 },
  pill: {
    flexShrink: 0,
    ...typography.text.caption,
    color: shoppingSurfaces.olive.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
  },
  strip: { marginHorizontal: -spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.lg },
  tile: { width: TILE_WIDTH, gap: spacing.xs },
  pressed: { opacity: 0.7 },
  frame: { width: TILE_WIDTH, aspectRatio: 0.8, borderRadius: radii.photo, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  anchorFrame: {
    borderWidth: 1.5,
    borderColor: shoppingSurfaces.olive.accent,
    backgroundColor: shoppingSurfaces.olive.wash,
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
  label: { ...typography.text.caption, color: colors.inkSubtle, minHeight: LABEL_MIN_HEIGHT },
  anchorLabel: { ...typography.text.caption, color: shoppingSurfaces.olive.accent },
});
