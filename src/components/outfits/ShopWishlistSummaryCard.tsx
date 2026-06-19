import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WishlistEntry } from '../../lib/wishlist';
import { colors, radii, spacing, typography } from '../../theme';

type Props = {
  entry: WishlistEntry;
  onPress: () => void;
  onMore: () => void;
};

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  top: 'shirt-outline',
  bottom: 'pricetag-outline',
  shoes: 'footsteps-outline',
  outerwear: 'partly-sunny-outline',
  accessory: 'diamond-outline',
};

function ProductPreview({ entry }: { entry: WishlistEntry }) {
  const items = entry.outfit.items.slice(0, 4);
  const cellStyle = (index: number) => {
    if (items.length === 1) return styles.previewCellFull;
    if (items.length === 2) return styles.previewCellHalfHorizontal;
    if (items.length === 3 && index === 0) return styles.previewCellWide;
    return styles.previewCell;
  };
  return (
    <View style={styles.preview} accessibilityElementsHidden>
      {items.length === 0 ? (
        <View style={styles.previewEmpty}>
          <Ionicons name="bag-handle-outline" size={28} color={colors.primary} />
        </View>
      ) : items.map((item, index) => {
        const category = item.category?.toLocaleLowerCase() ?? '';
        return (
          <View key={`${item.brand}-${item.name}-${index}`} style={cellStyle(index)}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <View style={styles.previewFallback}>
                <Ionicons name={CATEGORY_ICON[category] ?? 'bag-outline'} size={20} color={colors.primary} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function ShopWishlistSummaryCard({ entry, onPress, onMore }: Props) {
  const { outfit, eventContext } = entry;
  const brands = [...new Set(outfit.items.map((item) => item.brand?.trim()).filter(Boolean))];
  const context = eventContext?.title ?? outfit.city?.trim();
  const savedDate = new Date(entry.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const accessibilityLabel = [
    outfit.intro,
    `${outfit.items.length} ${outfit.items.length === 1 ? 'item' : 'items'}`,
    outfit.totalBudget,
    context,
  ].filter(Boolean).join(', ');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens outfit details"
    >
      <ProductPreview entry={entry} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          {context ? (
            <View style={styles.contextRow}>
              <Ionicons
                name={eventContext ? 'calendar-outline' : 'location-outline'}
                size={12}
                color={colors.primary}
              />
              <Text style={styles.contextText} numberOfLines={1}>{context}</Text>
            </View>
          ) : <View />}
          <TouchableOpacity
            onPress={onMore}
            style={styles.moreButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Outfit options"
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <Text style={styles.intro} numberOfLines={2}>{outfit.intro}</Text>
        {brands.length > 0 && (
          <Text style={styles.brands} numberOfLines={1}>{brands.slice(0, 3).join(' · ')}</Text>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.budget} numberOfLines={1}>{outfit.totalBudget}</Text>
          <Text style={styles.meta}>
            {outfit.items.length} {outfit.items.length === 1 ? 'item' : 'items'} · {savedDate}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 142,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  cardPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  preview: {
    width: 104,
    minHeight: 116,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  previewCell: {
    width: '50%',
    height: '50%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceElevated,
  },
  previewCellFull: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  previewCellHalfHorizontal: {
    width: '100%',
    height: '50%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceElevated,
  },
  previewCellWide: {
    width: '100%',
    height: '50%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceElevated,
  },
  previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minWidth: 0, justifyContent: 'space-between' },
  topRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  contextRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  contextText: { flex: 1, fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primary },
  moreButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  intro: { fontSize: typography.size.md, lineHeight: 20, fontWeight: typography.weight.semibold, color: colors.foreground },
  brands: { fontSize: typography.size.xs, color: colors.mutedForeground },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  budget: { flexShrink: 1, fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.foreground },
  meta: { fontSize: typography.size.xs, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
});
