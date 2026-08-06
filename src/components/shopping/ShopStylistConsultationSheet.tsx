import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ShopConsultationTopic } from '../../lib/shopDecisionWorkspace';
import { colors, radii, spacing, typography } from '../../theme';
import { PressableScale } from '../primitives/PressableScale';

type ConsultationOption = {
  topic: ShopConsultationTopic;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  visible: boolean;
  hasActiveFinds: boolean;
  onSelect: (topic: ShopConsultationTopic) => void;
  onClose: () => void;
};

export function ShopStylistConsultationSheet({ visible, hasActiveFinds, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const isPresented = useRef(false);
  const selectionPending = useRef(false);
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const options = useMemo<ConsultationOption[]>(() => [
    {
      topic: 'next_purchase',
      label: 'Choose my next best purchase',
      description: 'Find the one addition with the greatest wardrobe impact.',
      icon: 'sparkles-outline',
    },
    {
      topic: 'brief_review',
      label: 'Review my shopping priorities',
      description: 'Pressure-test your brief and decide what matters first.',
      icon: 'document-text-outline',
    },
    {
      topic: 'focused_list',
      label: 'Build a focused shopping list',
      description: 'Create a short, versatile list without unnecessary duplicates.',
      icon: 'list-outline',
    },
    {
      topic: 'review_find',
      label: hasActiveFinds ? 'Review a saved find' : 'Consider a piece',
      description: hasActiveFinds
        ? 'Choose something from your shortlist to review with your Stylist.'
        : 'Photograph a piece, then review how it fits your wardrobe.',
      icon: hasActiveFinds ? 'bookmark-outline' : 'camera-outline',
    },
    {
      topic: 'custom',
      label: 'Ask my own question',
      description: 'Open a blank conversation and ask in your own words.',
      icon: 'chatbubble-outline',
    },
  ], [hasActiveFinds]);

  useEffect(() => {
    if (visible) {
      selectionPending.current = false;
      isPresented.current = true;
      ref.current?.present();
    } else if (isPresented.current) {
      isPresented.current = false;
      ref.current?.dismiss();
    }
  }, [visible]);

  useEffect(() => () => {
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
  }, []);

  const handleDismiss = useCallback(() => {
    isPresented.current = false;
    onClose();
  }, [onClose]);

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

  const handleSelect = useCallback((topic: ShopConsultationTopic) => {
    if (selectionPending.current) return;
    selectionPending.current = true;
    onClose();
    selectionTimer.current = setTimeout(() => {
      selectionTimer.current = null;
      onSelect(topic);
    }, 300);
  }, [onClose, onSelect]);

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handle}
      onDismiss={handleDismiss}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR STYLIST</Text>
          <Text style={styles.title}>What would you like perspective on?</Text>
          <Text style={styles.subtitle}>Choose a consultation, or start with your own question.</Text>
        </View>

        <View style={styles.options}>
          {options.map((option) => (
            <PressableScale
              key={option.topic}
              contentStyle={styles.option}
              onPress={() => handleSelect(option.topic)}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}. ${option.description}`}
            >
              <View style={styles.iconBox}>
                <Ionicons name={option.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
            </PressableScale>
          ))}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: colors.background },
  handle: { width: 36, backgroundColor: colors.border },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
  header: { gap: spacing.xs },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.3,
  },
  title: {
    color: colors.foreground,
    fontFamily: typography.family.display,
    fontSize: typography.size.xxl,
    lineHeight: 32,
  },
  subtitle: { color: colors.mutedForeground, fontSize: typography.size.sm, lineHeight: 20 },
  options: { gap: spacing.xs },
  option: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}12`,
  },
  optionCopy: { flex: 1, gap: 3 },
  optionLabel: { color: colors.foreground, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  optionDescription: { color: colors.mutedForeground, fontSize: typography.size.sm, lineHeight: 19 },
});
