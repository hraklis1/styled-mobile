import { useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onRename: () => void;
  onChangeCover: () => void;
  onDelete: () => void;
};

export function BoardOptionsMenuSheet({ visible, onClose, onRename, onChangeCover, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);

  useEffect(() => {
    ref.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} onPress={onClose} />,
    [onClose],
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
        <Text style={styles.title}>Board Options</Text>
        
        <View style={styles.menuOptions}>
          <TouchableOpacity 
            style={styles.optionRow} 
            activeOpacity={0.7} 
            onPress={() => {
              onClose();
              setTimeout(onRename, 300);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="pencil-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.optionText}>Rename Board</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionRow} 
            activeOpacity={0.7} 
            onPress={() => {
              onClose();
              setTimeout(onChangeCover, 300);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: `${colors.secondary}80` }]}>
              <Ionicons name="image-outline" size={20} color={colors.foreground} />
            </View>
            <Text style={styles.optionText}>Change Cover Photo</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionRow} 
            activeOpacity={0.7} 
            onPress={() => {
              onClose();
              setTimeout(onDelete, 300);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: `${colors.destructive}15` }]}>
              <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            </View>
            <Text style={[styles.optionText, { color: colors.destructive }]}>Delete Board</Text>
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
