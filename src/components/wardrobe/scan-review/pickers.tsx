import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SearchField } from '../../primitives/SearchField';
import { filterBrandSuggestions } from '../../../lib/scan-review';
import { getStyles, getSubcategories } from '../../../lib/taxonomy';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MATERIAL_OPTIONS,
  SEASON_LABELS,
  SEASON_OPTIONS,
} from '../../../types/item';
import { colors, radii, spacing, stroke, typography } from '../../../theme';
import { ChipRow, QuietChip } from './atoms';

function OptionRow({ label, selected, muted, icon, onPress }: {
  label: string;
  selected?: boolean;
  muted?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.option}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
    >
      {icon ? <Ionicons name={icon} size={16} color={muted ? colors.mutedForeground : colors.foreground} /> : null}
      <Text style={[styles.optionText, muted && styles.optionMuted, selected && styles.optionSelected]} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={16} color={colors.foreground} /> : null}
    </TouchableOpacity>
  );
}

function SearchBar({ value, onChange, placeholder, onSubmit, autoFocus }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.searchRow}>
      <SearchField
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
      />
    </View>
  );
}

/**
 * Brands: the field first (most people know the name), then brands already
 * used in this scan — a haul is often several pieces from one shop — then
 * the closet-first suggestion list.
 */
export function BrandPicker({ current, suggestions, scanBrands, onSelect }: {
  current: string;
  suggestions: string[];
  scanBrands: string[];
  onSelect: (brand: string) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterBrandSuggestions(suggestions, query), [query, suggestions]);
  const trimmed = query.trim();
  const exact = suggestions.some((brand) => brand.toLocaleLowerCase() === trimmed.toLocaleLowerCase());

  return (
    <View style={styles.fill}>
      <SearchBar autoFocus value={query} onChange={setQuery} placeholder="Search or type a brand" onSubmit={() => { if (trimmed) onSelect(trimmed); }} />
      <FlatList
        data={filtered}
        keyExtractor={(brand) => brand.toLocaleLowerCase()}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {trimmed && !exact ? <OptionRow icon="add" label={`Use “${trimmed}”`} onPress={() => onSelect(trimmed)} /> : null}
            {!trimmed && scanBrands.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>In this scan</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipLine} keyboardShouldPersistTaps="handled">
                  {scanBrands.map((brand) => (
                    <QuietChip key={brand} label={brand} selected={brand === current} onPress={() => onSelect(brand)} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {current && !trimmed ? <OptionRow icon="close" label="No brand" muted onPress={() => onSelect('')} /> : null}
            <Text style={[styles.sectionLabel, styles.listLabel]}>{trimmed ? 'Matching' : 'Suggested'}</Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>No match. You can still use the name you typed.</Text>}
        renderItem={({ item }) => <OptionRow label={item} selected={item === current} onPress={() => onSelect(item)} />}
      />
    </View>
  );
}

export function MaterialPicker({ current, onSelect }: {
  current: string | null;
  onSelect: (material: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const options = useMemo(() => {
    const all: string[] = current && !(MATERIAL_OPTIONS as readonly string[]).includes(current)
      ? [current, ...MATERIAL_OPTIONS]
      : [...MATERIAL_OPTIONS];
    const q = query.trim().toLocaleLowerCase();
    return q ? all.filter((material) => material.toLocaleLowerCase().includes(q)) : all;
  }, [current, query]);

  return (
    <View style={styles.fill}>
      <SearchBar value={query} onChange={setQuery} placeholder="Search materials" />
      <FlatList
        data={options}
        keyExtractor={(material) => material}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ListHeaderComponent={current && !query ? <OptionRow icon="close" label="Not sure" muted onPress={() => onSelect(null)} /> : null}
        ListEmptyComponent={<Text style={styles.empty}>No material by that name.</Text>}
        renderItem={({ item }) => <OptionRow label={item} selected={item === current} onPress={() => onSelect(item)} />}
      />
    </View>
  );
}

/** Category → type → style, as three quiet chip rows on one page. */
export function CategoryPicker({ category, subcategory, style, onChange }: {
  category: string | null;
  subcategory: string | null;
  style: string | null;
  onChange: (patch: { category?: string | null; subcategory?: string | null; style?: string | null }) => void;
}) {
  const subcategories = category ? getSubcategories(category) : [];
  const styleOptions = category && subcategory ? getStyles(category, subcategory) : [];
  const withCurrent = (options: string[], value: string | null) => (value && !options.includes(value) ? [value, ...options] : options);

  return (
    <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
      <ChipRow
        label="Category"
        options={CATEGORY_ORDER.map((value) => ({ value: value as string, label: CATEGORY_LABELS[value] }))}
        isSelected={(value) => value === category}
        onToggle={(value) => { if (value !== category) onChange({ category: value, subcategory: null, style: null }); }}
      />
      {subcategories.length > 0 ? (
        <ChipRow
          label="Type"
          options={withCurrent(subcategories, subcategory).map((value) => ({ value, label: value }))}
          isSelected={(value) => value === subcategory}
          onToggle={(value) => onChange({ subcategory: value === subcategory ? null : value, style: null })}
        />
      ) : null}
      {styleOptions.length > 0 ? (
        <ChipRow
          label="Style"
          options={withCurrent(styleOptions, style).map((value) => ({ value, label: value }))}
          isSelected={(value) => value === style}
          onToggle={(value) => onChange({ style: value === style ? null : value })}
        />
      ) : null}
    </ScrollView>
  );
}

export function SeasonPicker({ value, onChange }: { value: string[]; onChange: (seasons: string[]) => void }) {
  return (
    <View style={styles.stack}>
      <ChipRow
        label="Season"
        options={SEASON_OPTIONS.map((season) => ({ value: season as string, label: SEASON_LABELS[season] }))}
        isSelected={(season) => value.includes(season)}
        onToggle={(season) => onChange(value.includes(season) ? value.filter((s) => s !== season) : [...value, season])}
      />
      <Text style={styles.note}>Replaces the seasons on every selected piece.</Text>
    </View>
  );
}

export function SheetButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  searchRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  section: { gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.md },
  sectionLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  listLabel: { paddingTop: spacing.md, paddingBottom: spacing.xs },
  chipLine: { gap: spacing.sm },
  option: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: colors.hairline,
  },
  optionText: { ...typography.text.body, color: colors.foreground, flex: 1 },
  optionMuted: { color: colors.mutedForeground },
  optionSelected: { fontWeight: typography.weight.medium },
  empty: { ...typography.text.editorialItalic, fontSize: 15, color: colors.mutedForeground, paddingVertical: spacing.lg },
  stack: { gap: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  note: { ...typography.text.caption, color: colors.mutedForeground },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...typography.text.sectionTitle, color: colors.primaryForeground },
});
