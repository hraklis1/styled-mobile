import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { itemImageContentFit, itemImageUri } from '../../../lib/itemImage';
import { colors, radii } from '../../../theme';
import type { Item } from '../../../types/item';

/** Shared fitting for wardrobe photos and detected cutouts. */
export function PieceImage({ item, cutoutUrl, width = 64, height = 80 }: {
  item?: Item; cutoutUrl?: string | null; width?: number | `${number}%`; height?: number;
}) {
  const uri = item ? itemImageUri(item) : cutoutUrl;
  return (
    <View style={[styles.plate, { width, height }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit={item ? itemImageContentFit(item) : 'contain'} cachePolicy="memory-disk" recyclingKey={item ? String(item.id) : uri} />
        : <Ionicons name="shirt-outline" size={24} color={colors.tertiary} />}
    </View>
  );
}
const styles = StyleSheet.create({
  plate: { borderRadius: radii.photo, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
});
