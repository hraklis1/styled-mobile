import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { WishlistEntry } from '../../lib/wishlist';
import { colors, editorial, radii } from '../../theme';

type Props = {
  entry: WishlistEntry;
  style?: StyleProp<ViewStyle>;
};

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  top: 'shirt-outline',
  bottom: 'pricetag-outline',
  shoes: 'footsteps-outline',
  outerwear: 'partly-sunny-outline',
  accessory: 'diamond-outline',
};

export function WishlistOutfitPreview({ entry, style }: Props) {
  const items = entry.outfit.items.slice(0, 4);
  const cellStyle = (index: number) => {
    if (items.length === 1) return styles.cellFull;
    if (items.length === 2) return styles.cellHalfHorizontal;
    if (items.length === 3 && index === 0) return styles.cellWide;
    return styles.cell;
  };
  const renderCell = (item: (typeof items)[number], index: number, styleOverride?: StyleProp<ViewStyle>) => {
    const category = item.category?.toLocaleLowerCase() ?? '';
    return (
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
            <Ionicons name={CATEGORY_ICON[category] ?? 'bag-outline'} size={18} color={colors.primary} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.preview, style]} accessibilityElementsHidden>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bag-handle-outline" size={24} color={colors.primary} />
        </View>
      ) : items.length >= 4 ? (
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
  moodboard: { flex: 1, flexDirection: 'row', gap: 1 },
  heroColumn: { flex: 1.12 },
  sideColumn: { flex: 1, gap: 1 },
  row: { flex: 1, flexDirection: 'row', gap: 1 },
  moodboardCell: {
    flex: 1,
    minWidth: 1,
    minHeight: 1,
    overflow: 'hidden',
  },
  cell: {
    width: '50%',
    height: '50%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceElevated,
  },
  cellFull: { width: '100%', height: '100%', overflow: 'hidden' },
  cellHalfHorizontal: {
    width: '100%',
    height: '50%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceElevated,
  },
  cellWide: {
    width: '100%',
    height: '50%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceElevated,
  },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
