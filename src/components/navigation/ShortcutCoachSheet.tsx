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
  const tryAfterDismiss = useRef(false);

  useEffect(() => {
    if (visible) {
      actionTaken.current = false;
      tryAfterDismiss.current = false;
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
    if (tryAfterDismiss.current) {
      tryAfterDismiss.current = false;
      onTry();
    } else if (!actionTaken.current) {
      actionTaken.current = true;
      onClose('dismissed');
    }
  }, [onClose, onTry]);

  const handleClose = useCallback(() => {
    if (actionTaken.current) return;
    actionTaken.current = true;
    onClose('got_it');
  }, [onClose]);

  const handleTry = useCallback(() => {
    if (actionTaken.current) return;
    actionTaken.current = true;
    tryAfterDismiss.current = true;
    ref.current?.dismiss();
  }, []);

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
          <Text style={styles.title}>Your closet, one shortcut away</Text>
          <Text style={styles.subtitle}>
            Press and hold Closet or Shop in the bottom bar to open a menu, then choose a section.
          </Text>
        </View>

        <View
          style={styles.tabsPreview}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Example: holding Shop in the bottom bar opens shortcuts for For you, Shortlist, and Save a find."
        >
          <View style={styles.menuPreview}>
            <Text style={styles.menuTitle}>Shop</Text>
            <Text style={styles.menuSubtitle}>Jump straight to a section</Text>
            <PreviewMenuRow icon="bag-outline" label="For you" />
            <PreviewMenuRow icon="images-outline" label="Shortlist" />
            <PreviewMenuRow icon="camera-outline" label="Save a find" />
          </View>
          <View style={styles.previewBar}>
            <PreviewTab icon="home-outline" label="Home" />
            <PreviewTab icon="file-tray-full-outline" label="Closet" />
            <PreviewTab icon="chatbubble-ellipses-outline" label="Stylist" />
            <PreviewTab icon="bag-outline" label="Shop" highlighted />
            <PreviewTab icon="calendar-outline" label="Calendar" />
          </View>
          <View style={styles.holdMark}>
            <Ionicons name="hand-left-outline" size={16} color={colors.primary} />
            <Text style={styles.holdLabel}>Press and hold a tab</Text>
          </View>
        </View>

        <PressableScale
          contentStyle={styles.primaryButton}
          onPress={handleTry}
          accessibilityRole="button"
          accessibilityLabel="Try it"
        >
          <Text style={styles.primaryButtonText}>Try it</Text>
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

function PreviewMenuRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.menuRow}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={12} color={colors.mutedForeground} />
    </View>
  );
}

function PreviewTab({ icon, label, highlighted = false }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  highlighted?: boolean;
}) {
  return (
    <View style={[styles.previewTab, highlighted && styles.highlightedTab]}>
      <Ionicons name={icon} size={20} color={highlighted ? colors.primary : colors.mutedForeground} />
      <Text maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit style={styles.previewLabel}>{label}</Text>
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
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  menuPreview: {
    alignSelf: 'flex-end',
    width: '78%',
    padding: spacing.sm,
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceElevated,
    boxShadow: '0 2px 8px rgba(29, 27, 24, 0.08)',
  },
  menuTitle: { ...typography.text.bodySmall, fontWeight: typography.weight.semibold, color: colors.foreground },
  menuSubtitle: { ...typography.text.caption, color: colors.inkSubtle },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  menuLabel: { ...typography.text.caption, flex: 1, color: colors.foreground },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
  },
  previewTab: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, borderRadius: radii.md },
  highlightedTab: { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.primary },
  previewLabel: { color: colors.foreground, fontSize: 10, fontWeight: typography.weight.medium },
  holdMark: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  holdLabel: { ...typography.text.caption, color: colors.inkSubtle },
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
