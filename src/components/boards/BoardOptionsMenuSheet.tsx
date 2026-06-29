import { useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

type Props = {
  visible: boolean;
  boardName: string;
  canRename?: boolean;
  onClose: () => void;
  onRename: () => void;
  onChangeCover: () => void;
  onUploadCover: () => void;
  onOrganize: () => void;
  onDelete: () => void;
};

export function BoardOptionsMenuSheet({
  visible,
  boardName,
  canRename = true,
  onClose,
  onRename,
  onChangeCover,
  onUploadCover,
  onOrganize,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

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
        <View style={styles.header}>
          <Text style={styles.title}>Board options</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{boardName}</Text>
        </View>

        <View style={styles.menuOptions}>
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => { onClose(); setTimeout(onOrganize, 300); }}
          >
            <View style={[styles.iconBox, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.optionText}>Organize Board</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {canRename && (
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                setTimeout(onRename, 300);
              }}
            >
              <View style={[styles.iconBox, { backgroundColor: `${colors.secondary}80` }]}>
                <Ionicons name="pencil-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.optionText}>Rename Board</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}

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
            <Text style={styles.optionText}>Edit Board Cover</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => {
              onClose();
              setTimeout(onUploadCover, 300);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: `${colors.accent}80` }]}>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.foreground} />
            </View>
            <Text style={styles.optionText}>Upload cover photo</Text>
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
  header: {
    gap: 2,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },
  menuOptions: {
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 58,
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
