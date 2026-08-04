import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { coverImageVariantLabel, itemCoverPresentation } from '../../lib/itemImage';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, radii, spacing, typography } from '../../theme';
import type { CoverImageVariant, Item } from '../../types/item';

type Props = {
  item: Item;
  visible: boolean;
  isUpdating: boolean;
  isPolishing: boolean;
  onClose: () => void;
  onSelect: (variant: CoverImageVariant) => void;
  onPolish: () => void;
};

type CoverOption = {
  variant: CoverImageVariant;
  uri: string;
  description: string;
};

export function CoverImageSheet({
  item,
  visible,
  isUpdating,
  isPolishing,
  onClose,
  onSelect,
  onPolish,
}: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const isPresented = useRef(false);
  const currentVariant = itemCoverPresentation(item).variant;

  const options = useMemo<CoverOption[]>(() => {
    const next: CoverOption[] = [];
    const original = resolveImageUri(item.imageUrl);
    const cutout = resolveImageUri(item.cutoutUrl);
    const polished = resolveImageUri(item.polishedUrl);
    if (original) {
      next.push({
        variant: 'original',
        uri: original,
        description: 'Your real cropped photo',
      });
    }
    if (cutout) {
      next.push({
        variant: 'cutout',
        uri: cutout,
        description: 'Background removed',
      });
    }
    if (polished) {
      next.push({
        variant: 'polished',
        uri: polished,
        description: 'AI-generated catalog image',
      });
    }
    return next;
  }, [item.cutoutUrl, item.imageUrl, item.polishedUrl]);

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
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        onPress={onClose}
      />
    ),
    [onClose],
  );

  const select = (variant: CoverImageVariant) => {
    if (variant === currentVariant || isUpdating) return;
    void Haptics.selectionAsync();
    onSelect(variant);
  };

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handle}
      onDismiss={handleDismiss}
    >
      <BottomSheetView
        style={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Cover image</Text>
          <Text style={styles.subtitle}>Choose what represents this piece across your closet.</Text>
        </View>

        <View style={styles.options}>
          {options.map((option) => {
            const selected = option.variant === currentVariant;
            const catalogStyle = option.variant !== 'original';
            const label = coverImageVariantLabel(option.variant);
            return (
              <TouchableOpacity
                key={option.variant}
                style={[styles.option, selected && styles.optionSelected]}
                activeOpacity={0.75}
                disabled={isUpdating}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: isUpdating }}
                accessibilityLabel={`${label}. ${option.description}`}
                onPress={() => select(option.variant)}
              >
                <View style={styles.preview}>
                  <Image
                    source={{ uri: option.uri }}
                    style={[styles.previewImage, catalogStyle && styles.catalogPreview]}
                    contentFit={catalogStyle ? 'contain' : 'cover'}
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                </View>
                <View style={styles.optionCopy}>
                  <View style={styles.optionTitleRow}>
                    <Text style={styles.optionTitle}>{label}</Text>
                    {option.variant === 'polished' && (
                      <View style={styles.aiBadge}>
                        <Ionicons name="sparkles" size={10} color={colors.primary} />
                        <Text style={styles.aiBadgeText}>AI</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                {isUpdating && selected ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={selected ? colors.primary : colors.border}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {!item.polishedUrl && (
          <TouchableOpacity
            style={[styles.polishAction, isPolishing && styles.actionDisabled]}
            activeOpacity={0.75}
            disabled={isPolishing}
            accessibilityRole="button"
            accessibilityLabel="Polish with AI. Create a catalog-style cover using a Polish credit."
            onPress={onPolish}
          >
            <View style={styles.polishIcon}>
              {isPolishing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="sparkles" size={19} color={colors.primary} />
              )}
            </View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>Polish with AI</Text>
              <Text style={styles.optionDescription}>Create a catalog-style cover · Uses a Polish credit</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border, width: 36 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  header: { gap: spacing.xs },
  title: {
    color: colors.foreground,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: typography.size.sm,
    lineHeight: 19,
  },
  options: { gap: spacing.sm },
  option: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSelected,
  },
  preview: {
    width: 58,
    height: 58,
    overflow: 'hidden',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  previewImage: { width: '100%', height: '100%' },
  catalogPreview: { padding: spacing.xs },
  optionCopy: { flex: 1, gap: 3 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  optionTitle: {
    color: colors.foreground,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  optionDescription: {
    color: colors.mutedForeground,
    fontSize: typography.size.xs,
    lineHeight: 17,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  aiBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: typography.weight.bold,
  },
  polishAction: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.card,
  },
  polishIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: colors.accent,
  },
  actionDisabled: { opacity: 0.55 },
});
