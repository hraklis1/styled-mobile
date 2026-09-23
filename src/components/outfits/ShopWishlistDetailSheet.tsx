import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WishlistEntry } from '../../lib/wishlist';
import { getWishlistRecommendationType } from '../../lib/wishlistType';
import { colors, spacing, typography } from '../../theme';
import { useItems } from '../../hooks/useItems';
import { ShoppingPriorityTargetCard } from '../shopping/ShoppingPriorityTargetCard';
import { shoppingGuideIntro, withoutOutfitCount } from '../../lib/shopClarity';
import { ShopOutfitCard } from './ShopOutfitCard';

type Props = {
  entry: WishlistEntry;
  onClose: () => void;
  onRemove: () => void;
  /**
   * Omitted where boarding makes no sense (this sheet also opens from inside a
   * board). The parent owns the picker — presenting a second BottomSheetModal
   * from here while this one dismisses wedges both.
   */
  onSaveToBoard?: () => void;
  removalCopy?: {
    title: string;
    message: string;
    confirmLabel: string;
    accessibilityLabel: string;
  };
};

const DEFAULT_REMOVAL_COPY = {
  title: 'Remove saved item?',
  message: 'This saved shopping item will be removed.',
  confirmLabel: 'Remove',
  accessibilityLabel: 'Remove saved shopping item',
};

export function ShopWishlistDetailSheet({ entry, onClose, onRemove, onSaveToBoard, removalCopy = DEFAULT_REMOVAL_COPY }: Props) {
  const { data: items = [] } = useItems();
  const wardrobe = useMemo(() => new Map(items.filter((item) => !item.isArchived && item.condition !== 'needs_repair' && item.condition !== 'donate').map((item) => [item.id, item])), [items]);
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['94%'], []);
  const recommendationType = getWishlistRecommendationType(entry);
  const title = entry.outfit.shoppingBrief ? 'Shopping guide' : recommendationType === 'look' ? 'Saved look' : recommendationType === 'piece' ? 'Saved piece' : 'Saved list';
  const fallbackContext = recommendationType === 'list' ? 'Options to consider' : recommendationType === 'piece' ? 'Individual piece' : 'Complete look';

  useEffect(() => { ref.current?.present(); }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />,
    [],
  );

  const confirmRemove = useCallback(() => {
    Alert.alert(removalCopy.title, removalCopy.message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: removalCopy.confirmLabel,
        style: 'destructive',
        onPress: () => {
          ref.current?.dismiss();
          onRemove();
        },
      },
    ]);
  }, [onRemove, removalCopy]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <View style={styles.header}>
        {onSaveToBoard ? (
          <TouchableOpacity
            style={styles.headerSide}
            onPress={onSaveToBoard}
            accessibilityRole="button"
            accessibilityLabel="Save to board"
          >
            <Ionicons name="bookmark-outline" size={20} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSide} />
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {entry.outfit.shoppingBrief ? entry.outfit.shoppingBrief.priority.label : entry.eventContext?.title ?? entry.outfit.city ?? fallbackContext}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={confirmRemove}
          accessibilityRole="button"
          accessibilityLabel={removalCopy.accessibilityLabel}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
        showsVerticalScrollIndicator={false}
      >
        {entry.outfit.shoppingBrief ? (
          <View style={styles.editContent}>
            <Text style={styles.editHeadline}>{entry.outfit.shoppingBrief.headline}</Text>
            <Text style={styles.editSummary}>{withoutOutfitCount(entry.outfit.shoppingBrief.summary, entry.outfit.shoppingBrief.priority.impactScore)}</Text>
            <Text style={styles.editSummary}>{shoppingGuideIntro(entry.outfit.shoppingBrief.targets.length)}</Text>
            {entry.outfit.shoppingBrief.targets.map((target, index) => (
              <ShoppingPriorityTargetCard key={target.key} target={target} index={index + 1} wardrobe={wardrobe} isLast={index === entry.outfit.shoppingBrief!.targets.length - 1} />
            ))}
          </View>
        ) : <ShopOutfitCard outfit={entry.outfit} />}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerSide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, alignItems: 'center', gap: 2 },
  title: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  subtitle: { maxWidth: '90%', fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  content: { padding: spacing.lg },
  editContent: { gap: spacing.md },
  editHeadline: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  editSummary: { fontSize: typography.text.bodySmall.fontSize, lineHeight: 20, color: colors.mutedForeground },
  editTarget: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, gap: 4 },
  editTargetIndex: { ...typography.text.eyebrow, color: colors.primary },
  editTargetTitle: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  editTargetMeta: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  editTargetRationale: { marginTop: spacing.xs, fontSize: typography.text.bodySmall.fontSize, lineHeight: 19, color: colors.mutedForeground },
});
