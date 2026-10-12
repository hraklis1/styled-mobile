import { useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import type { Item } from '../../../types/item';
import type { StylistRanking as Ranking } from '../../../features/stylist/types';
import { itemImageContentFit, itemThumbUri } from '../../../lib/itemImage';
import { colors, editorial, radii, spacing, surfaces, typography } from '../../../theme';
import { StylistRichText } from '../StylistRichText';
import { OpenItemContext } from '../stylistItemContext';

const THUMB_WIDTH = 56;

/** Ranked comparison: one row per option, the stylist's pick set apart. */
export function StylistRanking({ ranking, allItems }: { ranking: Ranking; allItems: Item[] }) {
  const openItem = useContext(OpenItemContext);
  const byId = new Map(allItems.map(item => [item.id, item]));
  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text accessibilityRole="header" style={s.title}>{ranking.title}</Text>
        {!!ranking.criterion && <Text style={s.criterion}>Ranked by {ranking.criterion}</Text>}
      </View>
      {!!ranking.intro && <StylistRichText text={ranking.intro} />}
      <View>
        {ranking.entries.map((entry, index) => {
          const item = entry.itemId != null ? byId.get(entry.itemId) : undefined;
          const uri = item ? itemThumbUri(item) : undefined;
          const picked = ranking.pick === index;
          const row = (
            <View style={[s.row, picked && s.pickedRow]}>
              <Text style={s.rank}>{index + 1}</Text>
              {item ? (
                <View style={s.thumb}>
                  {uri ? <ExpoImage source={{ uri }} style={StyleSheet.absoluteFill} contentFit={itemImageContentFit(item)} cachePolicy="memory-disk" /> : null}
                </View>
              ) : null}
              <View style={s.copy}>
                {picked && <Text style={s.pick}>Stylist’s pick</Text>}
                <Text style={s.label}>{item?.name ?? entry.label}</Text>
                {!item && entry.itemId == null && <Text style={s.unowned}>Not in your wardrobe</Text>}
                {!!entry.verdict && <Text style={s.verdict}>{entry.verdict}</Text>}
                {entry.pros.map((pro, i) => <Text key={`p${i}`} style={s.point}><Text style={s.pro}>+  </Text>{pro}</Text>)}
                {entry.cons.map((con, i) => <Text key={`c${i}`} style={s.point}><Text style={s.con}>–  </Text>{con}</Text>)}
              </View>
            </View>
          );
          return item && openItem ? (
            <Pressable key={index} onPress={() => openItem(item.id)} accessibilityRole="button" accessibilityLabel={`${index + 1}. ${item.name}${picked ? ', stylist’s pick' : ''}`}>
              {row}
            </Pressable>
          ) : <View key={index}>{row}</View>;
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: spacing.md },
  header: { gap: 2 },
  title: { ...typography.text.editorialTitle, color: colors.foreground },
  // Criteria are often a phrase, not a label: sentence case reads better than tracked caps.
  criterion: { ...typography.text.caption, color: colors.mutedForeground },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pickedRow: { backgroundColor: surfaces.plate, borderRadius: radii.md, borderTopColor: 'transparent' },
  rank: { ...typography.text.priorityNumeral, minWidth: 16, color: colors.mutedForeground, paddingTop: 2 },
  thumb: { width: THUMB_WIDTH, height: Math.round(THUMB_WIDTH / editorial.garmentAspectRatio), borderRadius: radii.photo, backgroundColor: surfaces.outfitMat, overflow: 'hidden' },
  copy: { flex: 1, gap: 3 },
  pick: { ...typography.text.eyebrow, color: colors.primary },
  label: { ...typography.text.label, color: colors.foreground },
  unowned: { ...typography.text.caption, color: colors.mutedForeground },
  verdict: { ...typography.text.bodySmall, color: colors.foreground },
  point: { ...typography.text.bodySmall, color: colors.mutedForeground },
  pro: { color: colors.foreground, fontWeight: typography.weight.semibold },
  con: { color: colors.mutedForeground, fontWeight: typography.weight.semibold },
});
