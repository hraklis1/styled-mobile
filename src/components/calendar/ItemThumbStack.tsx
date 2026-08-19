import { View, TouchableOpacity, Image, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';
import type { Item } from '../../types/item';
import { itemCoverPresentation } from '../../lib/itemImage';

export function ItemThumbStack({
  itemIds,
  allItems,
  onPress,
}: {
  itemIds: number[];
  allItems: Item[];
  onPress?: () => void;
}) {
  const visible = itemIds
    .map((id) => allItems.find((i) => i.id === id))
    .filter(Boolean)
    .slice(0, 3) as Item[];
  const overflow = itemIds.length - 3;
  if (visible.length === 0) return null;
  const content = (
    <>
      <View style={s.stack}>
        {visible.map((item, idx) => {
          const cover = itemCoverPresentation(item);
          return (
            <View key={item.id} style={[s.thumb, { marginLeft: idx === 0 ? 0 : -8, zIndex: visible.length - idx }]}>
              {cover.uri
                ? <Image source={{ uri: cover.uri }} style={s.thumbImg} resizeMode={cover.contentFit} />
                : <View style={s.thumbFallback}><Text style={s.thumbInitials}>{item.name.slice(0, 2).toUpperCase()}</Text></View>
              }
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
  thumb: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: colors.card,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbFallback: {
    width: '100%', height: '100%',
    backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  thumbInitials: { ...typography.text.caption, fontWeight: typography.weight.bold, color: colors.mutedForeground },
  overflow: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontWeight: typography.weight.medium },
});
