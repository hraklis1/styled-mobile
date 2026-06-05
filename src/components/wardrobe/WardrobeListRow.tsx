import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';
import { resolveImageUri } from '../../lib/resolveImageUri';
import type { Item } from '../../types/item';

const THUMB_SIZE = 60;

type Props = {
  item: Item;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onToggleSelect: () => void;
  onFavorite: () => void;
};

function formatLastWorn(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function WardrobeListRow({
  item,
  selectionMode,
  isSelected,
  onPress,
  onLongPress,
  onToggleSelect,
  onFavorite,
}: Props) {
  const imageUri = resolveImageUri(item.imageUrl);
  const handlePress = selectionMode ? onToggleSelect : onPress;
  const visibleTags = item.tags.slice(0, 2);
  const overflowCount = item.tags.length - visibleTags.length;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={450}
      activeOpacity={0.7}
    >
      {/* Selection indicator */}
      {selectionMode && (
        <View style={[styles.selectionCircle, isSelected && styles.selectionCircleActive]}>
          {isSelected && <Ionicons name="checkmark" size={13} color={colors.primaryForeground} />}
        </View>
      )}

      {/* Thumbnail */}
      <View style={styles.thumb}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name="shirt-outline" size={22} color={colors.border} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name || 'Unnamed Item'}
        </Text>
        {item.brand ? (
          <Text style={styles.brand} numberOfLines={1}>
            {item.brand}
          </Text>
        ) : null}

        {/* Meta badges */}
        {(item.wearCount > 0 || item.lastWornAt) && (
          <View style={styles.meta}>
            {item.wearCount > 0 && (
              <Text style={styles.metaText}>Worn {item.wearCount}×</Text>
            )}
            {item.lastWornAt && (
              <Text style={styles.metaText}>{formatLastWorn(item.lastWornAt)}</Text>
            )}
          </View>
        )}

        {/* Tags */}
        {visibleTags.length > 0 && (
          <View style={styles.tags}>
            {visibleTags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {overflowCount > 0 && (
              <Text style={styles.tagOverflow}>+{overflowCount}</Text>
            )}
          </View>
        )}
      </View>

      {/* Right side — actions (hidden in selection mode) */}
      {!selectionMode && (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onFavorite}
            hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
          >
            <Ionicons
              name={item.isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={item.isFavorite ? '#E53E3E' : colors.mutedForeground}
            />
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={15} color={colors.border} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  selectionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  brand: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 1,
  },
  metaText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 3,
  },
  tag: {
    backgroundColor: colors.muted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  tagOverflow: {
    fontSize: 11,
    color: colors.mutedForeground,
    alignSelf: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
