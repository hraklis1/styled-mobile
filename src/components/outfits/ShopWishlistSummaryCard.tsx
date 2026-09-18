import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { WishlistEntry } from '../../lib/wishlist';
import {
  getWishlistBrands,
  getWishlistCardTitle,
  getWishlistMeta,
  getWishlistTypeLabel,
} from '../../lib/wishlistPresentation';
import { WishlistOutfitPreview } from './WishlistOutfitPreview';
import { colors, radii, spacing } from '../../theme';
import { AppText } from '../primitives/AppText';
import { PressableScale } from '../primitives/PressableScale';

type Props = {
  entry: WishlistEntry;
  onPress: () => void;
  onMore: () => void;
};

/**
 * A saved Stylist entry as a line-sheet row: a small photo plate, the
 * recommendation, and the figures a decision turns on. Rows are ruled rather
 * than boxed so the list reads as one page instead of a stack of cards.
 */
export function ShopWishlistSummaryCard({ entry, onPress, onMore }: Props) {
  const { outfit, eventContext } = entry;
  const brands = getWishlistBrands(entry);
  const savedEdit = outfit.shoppingBrief;
  const context = eventContext?.title ?? outfit.city?.trim();
  const savedDate = new Date(entry.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const title = getWishlistCardTitle(entry);
  const meta = getWishlistMeta(entry);
  const figure = savedEdit ? `${savedEdit.targets.length} options` : outfit.totalBudget?.trim();
  const count = savedEdit ? undefined : meta.split(' · ')[0];

  return (
    <PressableScale
      scaleTo={0.99}
      haptic={false}
      contentStyle={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, meta, context].filter(Boolean).join(', ')}
      accessibilityHint={`Opens ${getWishlistTypeLabel(entry).toLocaleLowerCase()} details`}
    >
      <WishlistOutfitPreview entry={entry} scale="thumb" style={styles.preview} />
      <View style={styles.copy}>
        {context ? (
          <AppText variant="eyebrow" tone="brand" numberOfLines={1}>{context}</AppText>
        ) : null}
        <AppText variant="cardTitle" tone="primary" numberOfLines={2}>{title}</AppText>
        {savedEdit ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>Shopping Brief</AppText>
        ) : brands.length > 0 ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>{brands.slice(0, 3).join(' · ')}</AppText>
        ) : null}
        <View style={styles.metaRow}>
          {figure ? (
            <AppText variant="data" tone="primary" numberOfLines={1} style={styles.figure}>{figure}</AppText>
          ) : null}
          <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.meta}>
            {[count, savedDate].filter(Boolean).join(' · ')}
          </AppText>
        </View>
      </View>
      <TouchableOpacity
        onPress={onMore}
        style={styles.moreButton}
        accessibilityRole="button"
        accessibilityLabel="Saved item options"
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  preview: { width: 88, aspectRatio: 4 / 5, borderRadius: radii.photo },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, paddingTop: spacing.xs },
  figure: { flexShrink: 1 },
  meta: { flexShrink: 0, fontVariant: ['tabular-nums'] },
  // Pulled up and out by the row's own padding so the 44pt target sits on the
  // row's corner without a spacer of its own.
  moreButton: {
    width: 44,
    height: 44,
    marginTop: -spacing.md,
    marginRight: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
