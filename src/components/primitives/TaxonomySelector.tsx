import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../../types/item';
import { getSubcategories, getStyles } from '../../lib/taxonomy';

interface TaxonomySelectorProps {
  category: string | null;
  subcategory: string | null;
  style: string | null;
  onCategoryChange: (value: string) => void;
  onSubcategoryChange: (value: string) => void;
  onStyleChange: (value: string) => void;
  showCategoryRow?: boolean;
  hideStyleRow?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function TaxonomySelector({
  category,
  subcategory,
  style,
  onCategoryChange,
  onSubcategoryChange,
  onStyleChange,
  showCategoryRow = true,
  hideStyleRow = false,
  containerStyle,
  disabled = false,
}: TaxonomySelectorProps) {
  const subcategoryOptions = category ? getSubcategories(category) : [];
  // Include legacy values not in taxonomy so they remain visible
  const allSubcategoryOptions =
    subcategory && subcategoryOptions.length > 0 && !subcategoryOptions.includes(subcategory)
      ? [subcategory, ...subcategoryOptions]
      : subcategoryOptions;

  const styleOptions =
    category && subcategory ? getStyles(category, subcategory) : [];
  const allStyleOptions =
    style && styleOptions.length > 0 && !styleOptions.includes(style)
      ? [style, ...styleOptions]
      : styleOptions;

  const handleCategoryChange = (val: string) => {
    onCategoryChange(val === category ? '' : val);
    onSubcategoryChange('');
    onStyleChange('');
  };

  const handleSubcategoryChange = (val: string) => {
    onSubcategoryChange(val === subcategory ? '' : val);
    onStyleChange('');
  };

  const handleStyleChange = (val: string) => {
    onStyleChange(val === style ? '' : val);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {showCategoryRow && (
        <PillRow
          label="Category"
          options={CATEGORY_ORDER.map((c) => ({
            value: c,
            label: CATEGORY_LABELS[c],
          }))}
          selected={category ?? null}
          onSelect={handleCategoryChange}
          disabled={disabled}
        />
      )}

      {allSubcategoryOptions.length > 0 && (
        <PillRow
          label="Sub-category"
          options={allSubcategoryOptions.map((s) => ({ value: s, label: s }))}
          selected={subcategory ?? null}
          onSelect={handleSubcategoryChange}
          disabled={disabled}
        />
      )}

      {!hideStyleRow && allStyleOptions.length > 0 && (
        <PillRow
          label="Style"
          options={allStyleOptions.map((s) => ({ value: s, label: s }))}
          selected={style ?? null}
          onSelect={handleStyleChange}
          disabled={disabled}
        />
      )}
    </View>
  );
}

// ─── PillRow ──────────────────────────────────────────────────────────────────

function PillRow({
  label,
  options,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string | null;
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
        keyboardShouldPersistTaps="handled"
      >
        {options.map(({ value, label: optLabel }) => {
          const active = selected === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.pill, active && styles.pillActive, disabled && styles.pillDisabled]}
              onPress={() => onSelect(value)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {optLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  section: { gap: spacing.xs },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 0,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillDisabled: { opacity: 0.5 },
  pillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  pillTextActive: { color: colors.primaryForeground },
});
