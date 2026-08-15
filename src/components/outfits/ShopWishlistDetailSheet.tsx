import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WishlistEntry } from '../../lib/wishlist';
import { getWishlistRecommendationType } from '../../lib/wishlistType';
import { colors, spacing, typography } from '../../theme';
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
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['94%'], []);
  const recommendationType = getWishlistRecommendationType(entry);
  const title = recommendationType === 'look' ? 'Saved look' : recommendationType === 'piece' ? 'Saved piece' : 'Saved list';
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
            {entry.eventContext?.title ?? entry.outfit.city ?? fallbackContext}
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
        <ShopOutfitCard outfit={entry.outfit} />
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
  headerSide: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, alignItems: 'center', gap: 2 },
  title: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  subtitle: { maxWidth: '90%', fontSize: typography.size.xs, color: colors.mutedForeground },
  content: { padding: spacing.lg },
});
