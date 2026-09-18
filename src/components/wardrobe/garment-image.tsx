import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, cutoutScaleFor, radii, surfaces } from '../../theme';
import { itemCoverPresentation } from '../../lib/itemImage';
import type { Item } from '../../types/item';

type Props = {
  item: Item;
  width: number;
  height: number;
  borderRadius?: number;
  placeholderIconSize?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GarmentImage({
  item,
  width,
  height,
  borderRadius = radii.photo,
  placeholderIconSize = 40,
  children,
  style,
}: Props) {
  const cover = itemCoverPresentation(item, { preferThumb: true });
  const cutoutMargin = cover.variant === 'cutout'
    ? (Math.min(width, height) * (1 - cutoutScaleFor(item.category))) / 2
    : 0;

  return (
    <View
      style={[styles.frame, { width, height, borderRadius }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {cover.uri ? (
        <Image
          source={{ uri: cover.uri }}
          style={[StyleSheet.absoluteFill, cover.variant === 'cutout' && { margin: cutoutMargin }]}
          contentFit={cover.contentFit}
          contentPosition="center"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={`${item.id}:${cover.variant}`}
          accessible={false}
        />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="shirt-outline" size={placeholderIconSize} color={colors.mutedForeground} />
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // A flat plate: the garment's own edge is the only edge. No border, and only
  // enough rounding to take the hard pixel off the corner.
  frame: {
    overflow: 'hidden',
    backgroundColor: surfaces.plate,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaces.plate,
  },
});
