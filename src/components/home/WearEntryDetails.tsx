import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, typography } from '../../theme';
import type { OutfitLog } from '../../hooks/useOutfitLogs';
import type { Item } from '../../types/item';
import { itemCoverPresentation } from '../../lib/itemImage';
import { resolveImageUri } from '../../lib/resolveImageUri';

type Props = {
  log: OutfitLog;
  items: Item[];
  onOpenItem: (itemId: number) => void;
};

/** What was worn on a Week in Wear day: the scan photo, the pieces, and any notes. */
export function WearEntryDetails({ log, items, onOpenItem }: Props) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const worn = log.itemIds.map((id) => byId.get(id)).filter((item): item is Item => !!item);
  const missing = log.itemIds.length - worn.length;
  const photoUri = log.imageUrl ? resolveImageUri(log.imageUrl) : undefined;

  return (
    <View style={styles.root}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" accessibilityLabel="Outfit photo" />
      ) : null}

      <Text style={styles.heading}>
        {worn.length === 0 ? 'No pieces recorded' : `${worn.length} ${worn.length === 1 ? 'piece' : 'pieces'} worn`}
      </Text>

      {worn.map((item) => {
        const cover = itemCoverPresentation(item, { preferThumb: true });
        const meta = [item.brand, item.category].filter(Boolean).join(' · ');
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.row}
            onPress={() => onOpenItem(item.id)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name}`}
          >
            <View style={styles.thumbBox}>
              {cover.uri ? (
                <Image source={{ uri: cover.uri }} style={styles.thumb} contentFit={cover.contentFit} />
              ) : (
                <Ionicons name="shirt-outline" size={20} color={colors.mutedForeground} />
              )}
            </View>
            <View style={styles.copy}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.border} />
          </TouchableOpacity>
        );
      })}

      {missing > 0 ? (
        <Text style={styles.note}>
          {missing} {missing === 1 ? 'piece is' : 'pieces are'} no longer in your closet.
        </Text>
      ) : null}

      {log.location ? (
        <View style={styles.detailLine}>
          <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
          <Text style={styles.detailText}>{log.location}</Text>
        </View>
      ) : null}
      {log.notes ? <Text style={styles.notes}>{log.notes}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, marginBottom: spacing.md },
  photo: {
    width: '100%',
    aspectRatio: 4 / 5,
    maxHeight: 280,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    marginBottom: spacing.xs,
  },
  heading: {
    color: colors.mutedForeground,
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderCurve: 'continuous',
  },
  thumbBox: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  thumb: { width: '100%', height: '100%' },
  copy: { flex: 1, minWidth: 0 },
  name: {
    color: colors.foreground,
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.medium,
  },
  meta: {
    marginTop: 2,
    color: colors.mutedForeground,
    fontSize: typography.text.caption.fontSize,
    textTransform: 'capitalize',
  },
  note: { color: colors.mutedForeground, fontSize: typography.text.caption.fontSize },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { color: colors.mutedForeground, fontSize: typography.text.bodySmall.fontSize },
  notes: { color: colors.foreground, fontSize: typography.text.bodySmall.fontSize },
});
