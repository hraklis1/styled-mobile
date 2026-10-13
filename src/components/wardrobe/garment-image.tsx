import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, cutoutScaleFor, radii } from '../../theme';
import { itemCoverPresentation } from '../../lib/itemImage';
import type { Item } from '../../types/item';

type Props = {
  normalized?: boolean;
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
  normalized = false,
  width,
  height,
  borderRadius = radii.photo,
  placeholderIconSize = 40,
  children,
  style,
}: Props) {
  const [failedUri, setFailedUri] = useState<string>();
  const reduceMotion = useReducedMotion();
  const cover = itemCoverPresentation(item, { preferThumb: true });
  const cutoutMargin = cover.variant === 'cutout'
    ? (Math.min(width, height) * (1 - cutoutScaleFor(item.category))) / 2
    : 0;

  return (
    <View
      style={[styles.frame, { width, height, borderRadius }, normalized && { backgroundColor: '#F6F3EE' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {cover.uri && failedUri !== cover.uri ? (
        <Image
          source={{ uri: cover.uri }}
          style={[StyleSheet.absoluteFill, normalized ? { margin: 8 } : cover.variant === 'cutout' && { margin: cutoutMargin }]}
          contentFit={normalized ? 'contain' : cover.contentFit}
          onError={() => setFailedUri(cover.uri)}
          contentPosition="center"
          transition={reduceMotion ? 0 : 200}
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.imageEdge,
    backgroundColor: colors.imageMat,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.imageMat,
  },
});
