import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, radii, editorial } from '../../theme';
import type { Item } from '../../types/item';
import { GarmentImage } from '../wardrobe/garment-image';

// Portrait, not circular — a garment cropped into a circle loses its
// silhouette, which is the one thing a thumbnail needs to convey.
const THUMB_WIDTH = 26;
const THUMB_HEIGHT = Math.round(THUMB_WIDTH / editorial.garmentAspectRatio);

export function ItemThumbStack({
  itemIds,
  itemsById,
  onPress,
}: {
  itemIds: number[];
  itemsById: Map<number, Item>;
  onPress?: () => void;
}) {
  const visible = itemIds.slice(0, 3);
  const overflow = itemIds.length - 3;
  if (visible.length === 0) return null;

  const content = (
    <>
      <View style={s.stack}>
        {visible.map((id, idx) => {
          const item = itemsById.get(id);
          const overlap = { marginLeft: idx === 0 ? 0 : -10, zIndex: visible.length - idx };
          return item ? (
            <GarmentImage
              key={id}
              item={item}
              width={THUMB_WIDTH}
              height={THUMB_HEIGHT}
              borderRadius={radii.sm}
              placeholderIconSize={13}
              style={[s.thumbBorder, overlap]}
            />
          ) : (
            <View key={id} style={[s.thumbFallback, s.thumbBorder, overlap, { width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: radii.sm }]}>
              <Ionicons name="help-outline" size={13} color={colors.mutedForeground} />
            </View>
          );
        })}
      </View>
      {overflow > 0 && <Text style={s.overflow}>+{overflow}</Text>}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={s.row}>{content}</View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stack: { flexDirection: 'row' },
  thumbBorder: { borderWidth: 2, borderColor: colors.card },
  thumbFallback: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  overflow: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontWeight: typography.weight.medium },
});
