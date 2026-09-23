import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { ShoppingSurfaceLight } from './ShoppingSurfaceLight';
import { itemCoverPresentation } from '../../lib/itemImage';
import { shoppingSurfaces, colors, cutoutScaleFor, editorial, radii, spacing } from '../../theme';
import type { Item } from '../../types/item';

/**
 * An owned piece as a contact-sheet frame: flat plate, hairline edge, no
 * rounding beyond `photo`. Fills the width it is given at the garment aspect
 * ratio, so callers size it by wrapping it. Shared by the looks on a
 * shopping guide and the "works with" strip on a brief priority.
 */
export function WardrobeThumbnail({ item, style, iconSize = 18 }: { item?: Item; style?: StyleProp<ViewStyle>; iconSize?: number }) {
  const cover = itemCoverPresentation(item, { preferThumb: true });
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [cover.uri]);

  return (
    <View
      style={[styles.thumbnail, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {(!cover.uri || imageFailed || cover.isCatalogStyle) ? <ShoppingSurfaceLight tile /> : null}
      {cover.uri && !imageFailed ? (
        <Image
          source={{ uri: cover.uri }}
          style={[
            StyleSheet.absoluteFill,
            // Catalog-style covers are subjects on an empty ground, so they get
            // inset on the tile the way wardrobe rows do it; a plain photo is a
            // crop and still fills its frame. Without the split, a cutout on
            // white sits next to an edge-to-edge snapshot and the row stops
            // reading as one set.
            cover.isCatalogStyle && styles.catalogThumbnail,
            cover.variant === 'cutout' && { transform: [{ scale: cutoutScaleFor(item?.category) }] },
          ]}
          contentFit={cover.contentFit}
          contentPosition="center"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={item ? `${item.id}:${cover.variant}` : undefined}
          accessible={false}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Ionicons name="shirt-outline" size={iconSize} color={colors.mutedForeground} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: '100%',
    aspectRatio: editorial.garmentAspectRatio,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.photo,
    backgroundColor: shoppingSurfaces.bone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shoppingSurfaces.edge,
  },
  catalogThumbnail: { padding: spacing.xs },
});
