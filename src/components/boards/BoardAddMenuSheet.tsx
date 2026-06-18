import { useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPickItems: () => void;
  onPickOutfits: () => void;
  onPickWishlist: () => void;
  onSnapStoreFind: () => void;
};

export function BoardAddMenuSheet({ visible, onClose, onPickItems, onPickOutfits, onPickWishlist, onSnapStoreFind }: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);

  useEffect(() => {
    ref.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onDismiss={onClose}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Text style={styles.title}>Add to board</Text>
        
        <View style={styles.menuOptions}>
          <TouchableOpacity 
            style={styles.optionRow} 
            activeOpacity={0.7} 
            onPress={() => {
              onClose();
              setTimeout(onPickItems, 300);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="shirt-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.optionText}>Add from Closet</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionRow} 
            activeOpacity={0.7} 
            onPress={() => {
              onClose();
              setTimeout(onPickOutfits, 300);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: `${colors.secondary}80` }]}>
              <Ionicons name="images-outline" size={20} color={colors.foreground} />
            </View>
            <Text style={styles.optionText}>Add from Outfits</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionRow} 
            activeOpacity={0.7} 
            onPress={() => {
              onClose();
              setTimeout(onPickWishlist, 300);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(149, 109, 81, 0.15)' }]}>
              <Ionicons name="bag-handle-outline" size={20} color="#956D51" />
            </View>
            <Text style={styles.optionText}>Add from Shop (Wishlist)</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionRow} 
            activeOpacity={0.7} 
            onPress={() => {
              onClose();
              setTimeout(onSnapStoreFind, 300);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: `${colors.success}15` }]}>
              <Ionicons name="camera-outline" size={20} color={colors.success} />
            </View>
            <Text style={styles.optionText}>Snap Store Find</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border, width: 36 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  menuOptions: {
    gap: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
});
