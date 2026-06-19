import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WishlistFilterOptions, WishlistSortOrder } from '../../lib/shopWishlistFilters';
import { colors, radii, spacing, typography } from '../../theme';

type Props = {
  options: WishlistFilterOptions;
  categories: string[];
  cities: string[];
  brands: string[];
  sortOrder: WishlistSortOrder;
  resultCount: number;
  onToggleCategory: (value: string) => void;
  onToggleCity: (value: string) => void;
  onToggleBrand: (value: string) => void;
  onSortChange: (value: WishlistSortOrder) => void;
  onClear: () => void;
  onClose: () => void;
};

function ChoiceChips({
  values,
  selected,
  onToggle,
}: {
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {values.map((value) => {
        const active = selected.includes(value);
        return (
          <TouchableOpacity
            key={value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onToggle(value)}
            activeOpacity={0.75}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
          >
            {active && <Ionicons name="checkmark" size={13} color={colors.primaryForeground} />}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{value}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ShopWishlistFilterSheet({
  options,
  categories,
  cities,
  brands,
  sortOrder,
  resultCount,
  onToggleCategory,
  onToggleCity,
  onToggleBrand,
  onSortChange,
  onClear,
  onClose,
}: Props) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['90%'], []);
  const hasFilters = categories.length + cities.length + brands.length > 0 || sortOrder !== 'newest';

  useEffect(() => { ref.current?.present(); }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />,
    [],
  );

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
        <TouchableOpacity onPress={onClear} disabled={!hasFilters} style={styles.headerSide}>
          <Text style={[styles.clearText, !hasFilters && styles.clearTextDisabled]}>Reset</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Sort &amp; filter</Text>
        <TouchableOpacity
          onPress={() => ref.current?.dismiss()}
          style={[styles.headerSide, styles.headerSideRight]}
          accessibilityLabel="Close filters"
        >
          <Ionicons name="close" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 84, 108) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sort by</Text>
          <View style={styles.sortGroup}>
            {([
              ['newest', 'Newest first'],
              ['oldest', 'Oldest first'],
            ] as const).map(([value, label]) => {
              const active = sortOrder === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.sortChoice, active && styles.sortChoiceActive]}
                  onPress={() => onSortChange(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.sortText, active && styles.sortTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {options.categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <ChoiceChips values={options.categories} selected={categories} onToggle={onToggleCategory} />
          </View>
        )}
        {options.cities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>City</Text>
            <ChoiceChips values={options.cities} selected={cities} onToggle={onToggleCity} />
          </View>
        )}
        {options.brands.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Brand</Text>
            <ChoiceChips values={options.brands} selected={brands} onToggle={onToggleBrand} />
          </View>
        )}
      </BottomSheetScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TouchableOpacity style={styles.doneButton} onPress={() => ref.current?.dismiss()} activeOpacity={0.85}>
          <Text style={styles.doneText}>
            Show {resultCount} {resultCount === 1 ? 'outfit' : 'outfits'}
          </Text>
        </TouchableOpacity>
      </View>
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
  headerSide: { width: 64, minHeight: 40, justifyContent: 'center' },
  headerSideRight: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  clearText: { fontSize: typography.size.sm, color: colors.primary },
  clearTextDisabled: { color: colors.mutedForeground, opacity: 0.45 },
  content: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontSize: typography.size.sm, color: colors.foreground },
  chipTextActive: { fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  sortGroup: { flexDirection: 'row', padding: 3, borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  sortChoice: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.sm },
  sortChoiceActive: { backgroundColor: colors.surfaceElevated },
  sortText: { fontSize: typography.size.sm, color: colors.mutedForeground },
  sortTextActive: { fontWeight: typography.weight.semibold, color: colors.foreground },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  doneButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: colors.primary },
  doneText: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
});
