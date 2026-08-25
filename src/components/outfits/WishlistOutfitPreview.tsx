import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { WishlistEntry } from '../../lib/wishlist';
import { colors, editorial, radii, spacing, typography } from '../../theme';

type Props = {
  entry: WishlistEntry;
  style?: StyleProp<ViewStyle>;
};

const CATEGORY_ICON: [pattern: RegExp, icon: keyof typeof Ionicons.glyphMap][] = [
  [/outerwear|coat|jacket|blazer/, 'layers-outline'],
  [/shoe|boot|sneaker|heel|footwear/, 'footsteps-outline'],
  [/bag|purse|tote/, 'bag-handle-outline'],
  [/accessor|jewel|watch|belt|scarf|hat/, 'diamond-outline'],
  [/top|shirt|tee|blouse|sweater|knit|dress/, 'shirt-outline'],
  // Ionicons has no trouser glyph, so bottoms fall through to the neutral mark.
];

const categoryIcon = (category?: string): keyof typeof Ionicons.glyphMap => {
  const value = category?.toLocaleLowerCase() ?? '';
  return CATEGORY_ICON.find(([pattern]) => pattern.test(value))?.[1] ?? 'bag-outline';
};

export function WishlistOutfitPreview({ entry, style }: Props) {
  const savedEdit = entry.outfit.shoppingBrief;
  const outfitItems = entry.outfit.items.map((item, index) => ({
    key: `${item.brand}-${item.name}-${index}`,
    category: item.category,
    imageUrl: item.imageUrl,
  }));
  const editItems = (savedEdit?.targets ?? []).map((target) => ({
    key: target.key,
    category: target.category,
    imageUrl: target.offers?.find((offer) => Boolean(offer.imageUrl))?.imageUrl ?? target.imageUrl,
  }));
  const items = (outfitItems.length > 0 ? outfitItems : editItems).slice(0, 4);
  const imageItems = items.filter((item) => Boolean(item.imageUrl));
  const renderCell = (item: (typeof items)[number], index: number, cellStyle: StyleProp<ViewStyle>) => (
    <View key={`${item.key}-${index}`} style={cellStyle}>
      <Image
        source={{ uri: item.imageUrl! }}
        style={StyleSheet.absoluteFill}
        contentFit={editorial.imageFit.garment}
        transition={150}
      />
    </View>
  );

  // A saved Shopping Edit has a real editorial identity even before commerce
  // imagery arrives. Present it as an issued cover rather than a generic empty
  // product tile, so the saved preview still feels intentional.
  if (imageItems.length === 0 && savedEdit) {
    return (
      <View style={[styles.preview, style]} accessibilityElementsHidden>
        <View style={styles.editCover}>
          <Text style={styles.editEyebrow}>Shopping edit</Text>
          <Text style={styles.editTitle} numberOfLines={4}>{savedEdit.headline}</Text>
          <Text style={styles.editMeta}>
            {savedEdit.targets.length} {savedEdit.targets.length === 1 ? 'direction' : 'directions'}
          </Text>
        </View>
      </View>
    );
  }

  // With no product imagery there is nothing to tile: a mosaic of category
  // glyphs reads as scattered clip art, so show one calm emblem instead.
  if (items.length === 0 || imageItems.length === 0) {
    return (
      <View style={[styles.preview, style]} accessibilityElementsHidden>
        <View style={styles.empty}>
          <Ionicons
            name={items.length === 0 ? 'bag-handle-outline' : categoryIcon(items[0].category)}
            size={26}
            color={colors.primary}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.preview, style]} accessibilityElementsHidden>
      {imageItems.length === 1 ? (
        renderCell(imageItems[0], 0, styles.cellFull)
      ) : imageItems.length === 2 ? (
        <View style={styles.moodboard}>
          {renderCell(imageItems[0], 0, styles.heroColumn)}
          {renderCell(imageItems[1], 1, styles.secondaryColumn)}
        </View>
      ) : (
        <View style={styles.moodboard}>
          <View style={styles.heroColumn}>
            {renderCell(imageItems[0], 0, styles.moodboardCell)}
          </View>
          <View style={styles.sideColumn}>
            {renderCell(imageItems[1], 1, styles.moodboardCell)}
            {imageItems.length === 3 ? (
              renderCell(imageItems[2], 2, styles.moodboardCell)
            ) : (
              <View style={styles.row}>
                {renderCell(imageItems[2], 2, styles.moodboardCell)}
                {renderCell(imageItems[3], 3, styles.moodboardCell)}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  moodboard: { flex: 1, flexDirection: 'row', gap: 2, backgroundColor: colors.surfaceSubtle },
  heroColumn: { flex: 1.18, overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  secondaryColumn: { flex: 0.82, overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  sideColumn: { flex: 0.9, gap: 2 },
  row: { flex: 1, flexDirection: 'row', gap: 2 },
  moodboardCell: {
    flex: 1,
    minWidth: 1,
    minHeight: 1,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
  },
  cellFull: { flex: 1, overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  editCover: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceSubtle,
  },
  editEyebrow: { ...typography.text.eyebrow, color: colors.primary },
  editTitle: { ...typography.text.editorialSection, color: colors.foreground },
  editMeta: { ...typography.text.caption, color: colors.mutedForeground },
});
