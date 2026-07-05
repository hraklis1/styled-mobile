import { useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

export type TabQuickMenuOption = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: TabQuickMenuOption[];
  onClose: () => void;
};

export function TabQuickMenuSheet({ visible, title, subtitle, options, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);

  // Only ever dismiss() a modal that is currently presented: calling dismiss()
  // on a fresh or already-self-dismissed (e.g. swiped-down) BottomSheetModal
  // wedges its status at DISMISSING and every later present() silently skips
  // rendering its portal.
  const isPresented = useRef(false);

  useEffect(() => {
    if (visible) {
      isPresented.current = true;
      ref.current?.present();
    } else if (isPresented.current) {
      isPresented.current = false;
      ref.current?.dismiss();
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    isPresented.current = false;
    onClose();
  }, [onClose]);

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
      onDismiss={handleDismiss}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        <View style={styles.menuOptions}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={styles.optionRow}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              onPress={() => {
                onClose();
                setTimeout(option.onPress, 300);
              }}
            >
              <View style={[styles.iconBox, { backgroundColor: option.iconBg ?? `${colors.primary}15` }]}>
                <Ionicons name={option.icon} size={20} color={option.iconColor ?? colors.primary} />
              </View>
              <Text style={styles.optionText}>{option.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
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
