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

/** Splits a label around the first case-insensitive match of `query`. */
function splitMatch(label: string, query: string): [string, string, string] | null {
  const q = query.trim();
  const at = q ? label.toLocaleLowerCase().indexOf(q.toLocaleLowerCase()) : -1;
  return at < 0 ? null : [label.slice(0, at), label.slice(at, at + q.length), label.slice(at + q.length)];
}

function OptionRow({ label, selected, muted, icon, query, divided = true, onPress }: {
  label: string;
  selected?: boolean;
  muted?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** When set, the matched run is set in full ink and the rest recedes. */
  query?: string;
  divided?: boolean;
  onPress: () => void;
}) {
  const match = query ? splitMatch(label, query) : null;
  return (
    <TouchableOpacity
      style={[styles.option, !divided && styles.optionLast]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
    >
      {icon ? <Ionicons name={icon} size={16} color={muted ? colors.mutedForeground : colors.foreground} /> : null}
      <Text style={[styles.optionText, muted && styles.optionMuted, selected && styles.optionSelected]} numberOfLines={1}>
        {match ? (
          <>
            <Text style={styles.optionRest}>{match[0]}</Text>
            <Text style={styles.optionMatch}>{match[1]}</Text>
            <Text style={styles.optionRest}>{match[2]}</Text>
          </>
        ) : label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={16} color={colors.foreground} /> : null}
    </TouchableOpacity>
  );
}

/** Saving a brand that isn't in the list: an ink "+" disc and the name, so it reads as an action. */
function SaveTypedRow({ brand, onPress }: { brand: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.saveRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Save ${brand} as the brand`} activeOpacity={0.7}>
      <View style={styles.saveIcon}><Ionicons name="add" size={18} color={colors.primaryForeground} /></View>
      <View style={styles.saveText}>
        <Text style={styles.saveTitle} numberOfLines={1}>Add “{brand}”</Text>
        <Text style={styles.saveHint}>Save as a new brand</Text>
      </View>
    </TouchableOpacity>
  );
}

function SearchBar({ value, onChange, placeholder, onSubmit, autoFocus, returnKeyType = 'done' }: {
  returnKeyType?: 'done' | 'search';
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  const [laidOut, setLaidOut] = useState(false);
  return (
    <View style={styles.searchRow} onLayout={() => setLaidOut(true)}>
      {(!autoFocus || laidOut) && <SearchField
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
      />}
    </View>
  );
}

/**
 * Brands: the field first (most people know the name), then brands already
 * used in this scan — a haul is often several pieces from one shop — then
 * the closet-first suggestion list.
 */
export function BrandPicker({ current, suggestions, scanBrands, closetBrands = [], onSelect }: {
  current: string;
  suggestions: string[];
  /** Brands the user already owns; listed first, under their own label. */
  closetBrands?: string[];
  scanBrands: string[];
  onSelect: (brand: string) => void;
}) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  // The current brand leads the list so the sheet opens on what's chosen.
  const filtered = useMemo(() => {
    const list = filterBrandSuggestions(suggestions, query);
    if (!current || trimmed) return list;
    return [current, ...list.filter((brand) => brand !== current)];
  }, [current, query, suggestions, trimmed]);
  const exact = suggestions.some((brand) => brand.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
  const useTyped = Boolean(trimmed) && !exact;
  // The chosen brand already leads the list with a check; the chips offer the others.
  const otherScanBrands = scanBrands.filter((brand) => brand !== current);
  // Before typing, the list splits into the user's own brands and the generic
  // "Popular brands". "Suggested" is kept for picks chosen for this garment,
  // which this list never is.
  const closet = useMemo(() => new Set(closetBrands.map((brand) => brand.toLocaleLowerCase())), [closetBrands]);
  const rows = useMemo(() => {
    if (trimmed) return filtered.length ? [{ kind: 'label' as const, label: 'Matching' }, ...filtered.map((brand) => ({ kind: 'brand' as const, brand }))] : [];
    const own = filtered.filter((brand) => closet.has(brand.toLocaleLowerCase()) || brand === current);
    const rest = filtered.filter((brand) => !own.includes(brand));
    return [
      ...(own.length ? [{ kind: 'label' as const, label: 'From your closet' }, ...own.map((brand) => ({ kind: 'brand' as const, brand }))] : []),
      ...(rest.length ? [{ kind: 'label' as const, label: 'Popular brands' }, ...rest.map((brand) => ({ kind: 'brand' as const, brand }))] : []),
    ];
  }, [closet, current, filtered, trimmed]);

  return (
    <View style={styles.fill}>
      <SearchBar autoFocus value={query} onChange={setQuery} placeholder="Search or enter a brand" returnKeyType={useTyped ? 'done' : 'search'} onSubmit={() => { if (trimmed) onSelect(trimmed); }} />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.kind === 'label' ? `label:${row.label}` : row.brand.toLocaleLowerCase()}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {/* A name we don't know is saved as typed: said plainly, first, and as a clear action. */}
            {useTyped ? <SaveTypedRow brand={trimmed} onPress={() => onSelect(trimmed)} /> : null}
            {!trimmed && otherScanBrands.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>In this scan</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipLine} keyboardShouldPersistTaps="handled">
                  {otherScanBrands.map((brand) => (
                    <QuietChip key={brand} label={brand} selected={false} onPress={() => onSelect(brand)} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {current && !trimmed ? <OptionRow icon="close" label="No brand" muted onPress={() => onSelect('')} /> : null}
          </>
        }
        renderItem={({ item, index }) => item.kind === 'label' ? (
          <Text style={[styles.sectionLabel, styles.listLabel]}>{item.label}</Text>
        ) : (
          <OptionRow
            label={item.brand}
            query={trimmed}
            selected={item.brand === current}
            divided={rows[index + 1]?.kind === 'brand'}
            onPress={() => onSelect(item.brand)}
          />
        )}
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
        keyboardDismissMode="interactive"
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
  fill: { flex: 1, minHeight: 0 },
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
  saveRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs, marginBottom: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: stroke.hairline, borderColor: colors.hairline },
  saveIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  saveText: { flex: 1, minWidth: 0, gap: 1 },
  saveTitle: { ...typography.text.body, fontWeight: typography.weight.medium, color: colors.foreground },
  saveHint: { ...typography.text.caption, color: colors.mutedForeground },
  optionLast: { borderBottomWidth: 0 },
  optionRest: { color: colors.mutedForeground },
  optionMatch: { fontWeight: typography.weight.medium },
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
