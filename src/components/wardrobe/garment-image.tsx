import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, cutoutScaleFor, radii } from '../../theme';
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
  borderRadius = radii.lg,
  placeholderIconSize = 40,
  children,
  style,
}: Props) {
  const cover = itemCoverPresentation(item);
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
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F0ECE5',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
});
