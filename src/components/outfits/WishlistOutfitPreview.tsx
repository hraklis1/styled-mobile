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

  return (
    <View style={[styles.preview, style]} accessibilityElementsHidden>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bag-handle-outline" size={24} color={colors.primary} />
        </View>
      ) : items.map((item, index) => {
        const category = item.category?.toLocaleLowerCase() ?? '';
        return (
          <View key={`${item.brand}-${item.name}-${index}`} style={cellStyle(index)}>
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
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
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
