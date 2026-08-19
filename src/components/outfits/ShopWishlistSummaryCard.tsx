import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WishlistEntry } from '../../lib/wishlist';
import { getWishlistRecommendationType } from '../../lib/wishlistType';
import { WishlistOutfitPreview } from './WishlistOutfitPreview';
import { colors, radii, spacing, typography } from '../../theme';
import { EditorialCardMeta } from '../primitives/Editorial';

type Props = {
  entry: WishlistEntry;
  onPress: () => void;
  onMore: () => void;
};

export function ShopWishlistSummaryCard({ entry, onPress, onMore }: Props) {
  const { outfit, eventContext } = entry;
  const recommendationType = getWishlistRecommendationType(entry);
  const brands = [...new Set(outfit.items.map((item) => item.brand?.trim()).filter(Boolean))];
  const savedEdit = outfit.shoppingBrief;
  const context = eventContext?.title ?? outfit.city?.trim();
  const savedDate = new Date(entry.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const itemLabel = savedEdit ? `${savedEdit.targets.length} options` : recommendationType === 'look' ? `${outfit.items.length} ${outfit.items.length === 1 ? 'item' : 'items'}`
    : recommendationType === 'piece' ? '1 piece' : `${outfit.items.length} options`;
  const accessibilityLabel = [
    outfit.intro,
    itemLabel,
    outfit.totalBudget,
    context,
  ].filter(Boolean).join(', ');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={`Opens ${savedEdit ? 'saved edit' : recommendationType === 'look' ? 'look' : recommendationType === 'piece' ? 'piece' : 'list'} details`}
    >
      <WishlistOutfitPreview entry={entry} style={styles.preview} />
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
        <EditorialCardMeta
          title={savedEdit ? savedEdit.headline : outfit.intro}
          subtitle={savedEdit ? 'Shopping Brief' : brands.length > 0 ? brands.slice(0, 3).join(' · ') : undefined}
          titleStyle={styles.intro}
        />
        <View style={styles.metaRow}>
          <Text style={styles.budget} numberOfLines={1}>{savedEdit ? 'Saved edit' : outfit.totalBudget}</Text>
          <Text style={styles.meta}>
            {itemLabel} · {savedDate}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 156,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceElevated,
    boxShadow: '0 1px 4px rgba(40, 35, 31, 0.045)',
  },
  cardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  preview: { width: 112, minHeight: 128 },
  content: { flex: 1, minWidth: 0, justifyContent: 'space-between' },
  topRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  contextRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  contextText: { flex: 1, fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  moreButton: {
    width: 44,
    height: 44,
    marginTop: -8,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: 'transparent',
  },
  intro: { fontSize: typography.text.body.fontSize, lineHeight: 20, fontWeight: typography.weight.semibold, color: colors.foreground },
  brands: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  budget: { flexShrink: 1, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  meta: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
});
