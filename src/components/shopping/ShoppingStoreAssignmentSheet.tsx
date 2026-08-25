import { useMemo, useState, type RefObject } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';

import type { ShoppingStoreOption } from '../../lib/shoppingStoreFilters';
import { POPULAR_FASHION_STORES, normalizeStoreName } from '../../lib/shoppingLocations';
import { colors, radii, spacing, typography } from '../../theme';

export function ShoppingStoreAssignmentSheet({
  sheetRef,
  options,
  onSelect,
}: {
  sheetRef: RefObject<BottomSheetModal | null>;
  options: ShoppingStoreOption[];
  onSelect: (storeName: string) => void;
}) {
  const [query, setQuery] = useState('');
  const stores = useMemo(() => {
    const value = normalizeStoreName(query);
    const known = [...new Set([...options.map((option) => option.label), ...POPULAR_FASHION_STORES])];
    const matches = known.filter((name) => !value || normalizeStoreName(name).includes(value)).slice(0, 18);
    if (query.trim() && !matches.some((name) => normalizeStoreName(name) === value)) {
      return [query.trim(), ...matches];
    }
    return matches;
  }, [options, query]);

  const choose = (storeName: string) => {
    onSelect(storeName);
    setQuery('');
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={['70%']}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      onDismiss={() => setQuery('')}
    >
      <BottomSheetFlatList
        data={stores}
        keyExtractor={(item) => normalizeStoreName(item)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text style={styles.title}>Add Store Location</Text>
      <Text style={styles.subtitle}>This will update every piece from this visit.</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="search" size={17} color={colors.mutedForeground} />
              <BottomSheetTextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder="Store name"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => query.trim() && choose(query.trim())}
              />
            </View>
          </View>
        )}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.row} onPress={() => choose(item)}>
            <View style={styles.icon}>
              <Ionicons name={index === 0 && query.trim() === item ? 'create-outline' : 'storefront-outline'} size={16} color={colors.primary} />
            </View>
            <Text style={styles.rowText} numberOfLines={1}>
              {index === 0 && query.trim() === item ? `Use “${item}”` : item}
            </Text>
          </TouchableOpacity>
        )}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border },
  content: { paddingBottom: spacing.xl },
  header: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.text.sheetTitle, color: colors.foreground },
  subtitle: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground },
  inputWrap: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  input: { flex: 1, fontSize: typography.text.body.fontSize, color: colors.foreground },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.accent },
  rowText: { flex: 1, fontSize: typography.text.body.fontSize, color: colors.foreground },
});
