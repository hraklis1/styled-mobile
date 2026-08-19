import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '../../theme';
import { PressableScale } from '../primitives/PressableScale';

type Props = {
  visible: boolean;
  onClose: (reason: 'got_it' | 'dismissed') => void;
  onTry: () => void;
};

export function ShortcutCoachSheet({ visible, onClose, onTry }: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const isPresented = useRef(false);
  const actionTaken = useRef(false);

  useEffect(() => {
    if (visible) {
      actionTaken.current = false;
      isPresented.current = true;
      ref.current?.present();
    } else if (isPresented.current) {
      isPresented.current = false;
      ref.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleDismiss = useCallback(() => {
    isPresented.current = false;
    if (!actionTaken.current) {
      actionTaken.current = true;
      onClose('dismissed');
    }
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (actionTaken.current) return;
    actionTaken.current = true;
    onClose('got_it');
  }, [onClose]);

  const handleTry = useCallback(() => {
    if (actionTaken.current) return;
    actionTaken.current = true;
    onTry();
  }, [onTry]);

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      onDismiss={handleDismiss}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.eyebrowRow}>
            <Ionicons name="hand-left-outline" size={15} color={colors.primary} />
            <Text style={styles.eyebrow}>A QUICK SHORTCUT</Text>
          </View>
          <Text style={styles.title}>A faster way around</Text>
          <Text style={styles.subtitle}>
            Press and hold Closet or Shop to jump straight to a section.
          </Text>
        </View>

        <View style={styles.tabsPreview}>
          <PreviewTab icon="file-tray-full" label="Closet" />
          <View style={styles.holdMark}>
            <Ionicons name="hand-left" size={17} color={colors.primary} />
            <Text style={styles.holdLabel}>hold</Text>
          </View>
          <PreviewTab icon="bag" label="Shop" />
        </View>

        <PressableScale
          contentStyle={styles.primaryButton}
          onPress={handleTry}
          accessibilityRole="button"
          accessibilityLabel="Try a shortcut"
        >
          <Text style={styles.primaryButtonText}>Try a shortcut</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primaryForeground} />
        </PressableScale>
        <PressableScale
          haptic={false}
          contentStyle={styles.secondaryButton}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Got it"
        >
          <Text style={styles.secondaryButtonText}>Got it</Text>
        </PressableScale>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

function PreviewTab({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.previewTab}>
      <View style={styles.previewIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.previewLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.background },
  handle: { width: 36, backgroundColor: colors.border },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  header: { gap: spacing.xs },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  eyebrow: { ...typography.text.eyebrow, color: colors.primary },
  title: { ...typography.text.sheetTitle, color: colors.foreground },
  subtitle: { ...typography.text.bodySmall, color: colors.inkSubtle },
  tabsPreview: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    padding: spacing.md,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  previewTab: { alignItems: 'center', gap: spacing.xs },
  previewIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceElevated,
    boxShadow: '0 1px 3px rgba(29, 27, 24, 0.08)',
  },
  previewLabel: { color: colors.foreground, fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold },
  holdMark: { alignItems: 'center', gap: 2 },
  holdLabel: { ...typography.text.eyebrow, color: colors.primary },
  primaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.action, fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold },
});
