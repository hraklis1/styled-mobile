import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { WishlistEntry } from '../../lib/wishlist';
import { colors, editorial, radii } from '../../theme';

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
  const items = entry.outfit.items.slice(0, 4);
  const hasImages = items.some((item) => item.imageUrl);
  const cellStyle = (index: number) => {
    if (items.length === 1) return styles.cellFull;
    if (items.length === 2) return styles.cellHalfHorizontal;
    if (items.length === 3 && index === 0) return styles.cellWide;
    return styles.cell;
  };
  const renderCell = (item: (typeof items)[number], index: number, styleOverride?: StyleProp<ViewStyle>) => (
    <View key={`${item.brand}-${item.name}-${index}`} style={[styleOverride ?? cellStyle(index)]}>
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit={editorial.imageFit.garment}
          transition={150}
        />
      ) : (
        <View style={styles.fallback}>
          <Ionicons name={categoryIcon(item.category)} size={16} color={colors.mutedForeground} />
        </View>
      )}
    </View>
  );

  // With no product imagery there is nothing to tile: a mosaic of category
  // glyphs reads as scattered clip art, so show one calm emblem instead.
  if (items.length === 0 || !hasImages) {
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
      {items.length >= 4 ? (
        <View style={styles.moodboard}>
          <View style={styles.heroColumn}>
            {renderCell(items[0], 0, styles.moodboardCell)}
          </View>
          <View style={styles.sideColumn}>
            {renderCell(items[1], 1, styles.moodboardCell)}
            <View style={styles.row}>
              {renderCell(items[2], 2, styles.moodboardCell)}
              {renderCell(items[3], 3, styles.moodboardCell)}
            </View>
          </View>
        </View>
      ) : items.map((item, index) => renderCell(item, index))}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  moodboard: { flex: 1, flexDirection: 'row', gap: 1, backgroundColor: colors.hairline },
  heroColumn: { flex: 1.12 },
  sideColumn: { flex: 1, gap: 1 },
  row: { flex: 1, flexDirection: 'row', gap: 1 },
  moodboardCell: {
    flex: 1,
    minWidth: 1,
    minHeight: 1,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
  },
  cell: {
    width: '50%',
    height: '50%',
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  cellFull: { width: '100%', height: '100%', overflow: 'hidden' },
  cellHalfHorizontal: {
    width: '100%',
    height: '50%',
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  cellWide: {
    width: '100%',
    height: '50%',
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
