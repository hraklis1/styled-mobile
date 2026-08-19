import { useCallback, useMemo, useState, type RefObject } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  searchShoppingStoreOptions,
  STORE_FILTER_ALL,
  STORE_FILTER_NONE,
  type ShoppingStoreOption,
} from '../../lib/shoppingStoreFilters';
import { colors, radii, spacing, typography } from '../../theme';

type StoreRow = {
  key: string;
  value: string;
  label: string;
  itemCount: number;
  isLocation: boolean;
};

type ShoppingStoreFilterSheetProps = {
  sheetRef: RefObject<BottomSheetModal | null>;
  options: ShoppingStoreOption[];
  totalItemCount: number;
  unassignedCount: number;
  storeFilter: string;
  onSelect: (value: string) => void;
};

function buildRows(options: ShoppingStoreOption[]): StoreRow[] {
  return options.flatMap((option) => [
    {
      key: option.value,
      value: option.value,
      label: option.label,
      itemCount: option.itemCount,
      isLocation: false,
    },
    ...option.locations.map((location) => ({
      key: `${option.value}/${location.value}`,
      value: location.value,
      label: location.label,
      itemCount: location.itemCount,
      isLocation: true,
    })),
  ]);
}

export function ShoppingStoreFilterSheet({
  sheetRef,
  options,
  totalItemCount,
  unassignedCount,
  storeFilter,
  onSelect,
}: ShoppingStoreFilterSheetProps) {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const matches = searchShoppingStoreOptions(options, query);
    const rows = buildRows(matches);
    if (query.trim()) return rows;
    return [
      { key: STORE_FILTER_ALL, value: STORE_FILTER_ALL, label: 'All stores', itemCount: totalItemCount, isLocation: false },
      ...rows,
      ...(unassignedCount > 0
        ? [{ key: STORE_FILTER_NONE, value: STORE_FILTER_NONE, label: 'Store not set', itemCount: unassignedCount, isLocation: false }]
        : []),
    ];
  }, [options, query, totalItemCount, unassignedCount]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  const choose = useCallback((value: string) => {
    void Haptics.selectionAsync();
    onSelect(value);
    setQuery('');
    sheetRef.current?.dismiss();
  }, [onSelect, sheetRef]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={['72%']}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetHandle}
      onDismiss={() => setQuery('')}
    >
      <BottomSheetFlatList
        data={rows}
        keyExtractor={(row) => row.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text style={styles.title}>Shop by store</Text>
            <View style={styles.searchField}>
              <Ionicons name="search" size={16} color={colors.mutedForeground} />
              <BottomSheetTextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search stores"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No stores match “{query.trim()}”.</Text>
          </View>
        )}
        renderItem={({ item: row }) => {
          const isSelected = row.value === storeFilter;
          return (
            <TouchableOpacity
              style={[styles.row, row.isLocation && styles.rowNested]}
              onPress={() => choose(row.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <View style={styles.rowCheck}>
                {isSelected ? <Ionicons name="checkmark" size={17} color={colors.primary} /> : null}
              </View>
              <Text
                style={[
                  styles.rowLabel,
                  row.isLocation && styles.rowLabelNested,
                  isSelected && styles.rowLabelSelected,
                ]}
                numberOfLines={1}
              >
                {row.label}
              </Text>
              <Text style={styles.rowCount}>
                {row.itemCount} item{row.itemCount === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: colors.background },
  sheetHandle: { backgroundColor: colors.border },
  listContent: { paddingBottom: spacing.xl },
  header: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.text.sheetTitle, color: colors.foreground },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, fontSize: typography.text.body.fontSize, color: colors.foreground },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowNested: { minHeight: 44, paddingLeft: spacing.lg + spacing.md },
  rowCheck: { width: 20, alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: typography.text.body.fontSize, color: colors.foreground },
  rowLabelNested: { fontSize: typography.text.bodySmall.fontSize, color: colors.secondaryForeground },
  rowLabelSelected: { fontWeight: typography.weight.semibold, color: colors.primary },
  rowCount: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  emptyState: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  emptyText: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground },
});
