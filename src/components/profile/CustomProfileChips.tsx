import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SelectionGroup } from '../primitives/SelectionGroup';
import { colors, radii, spacing, typography } from '../../theme';
import { OCCASION_OPTIONS, type ProfileOption } from '../../lib/profileOptions';
import { profileOptionsWithCustom, resolveProfileTerm, termKey } from '../../lib/customProfileTerms';

type Props = {
  label: string;
  options: readonly ProfileOption[];
  values: string[];
  onChange: (values: string[]) => void;
  max?: number;
  maxLength?: number;
  normalizeTerm?: (value: string) => string;
  occasionCategories?: Record<string, string>;
  onAddOccasion?: (value: string, category: string) => void;
};

export function CustomProfileChips({ label, options, values, onChange, max = 8, maxLength = 40,
  occasionCategories, onAddOccasion, normalizeTerm = (value) => value }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const atCap = values.length >= max;
  const reset = () => { setEditing(false); setDraft(''); setCategory(''); setError(''); };
  const add = () => {
    const value = normalizeTerm(resolveProfileTerm(draft, options));
    if (!value) { setError('Enter a term first.'); return; }
    if (values.some((entry) => termKey(entry) === termKey(value))) {
      setError('Already selected.'); return;
    }
    if (atCap) { setError(`Choose up to ${max}. Remove a selection first.`); return; }
    const isCustom = !options.some((option) => option.value === value);
    if (onAddOccasion && isCustom && !category) {
      setError('Choose the closest occasion below.'); return;
    }
    if (onAddOccasion && isCustom) onAddOccasion(value, category);
    else onChange([...values, value]);
    reset();
  };
  const displayed = profileOptionsWithCustom(options, values).map((option) => {
    const mapped = occasionCategories?.[option.value];
    return mapped ? { ...option, label: `${option.label} · ${OCCASION_OPTIONS.find((o) => o.value === mapped)?.label ?? mapped}` } : option;
  });
  return (
    <View style={s.container}>
      <SelectionGroup mode="multi" options={displayed} values={values} onChange={onChange}
        max={max} layout="pill" caption={null}
        trailing={<Pressable accessibilityRole="button" accessibilityLabel={`Add your own ${label}`}
          accessibilityState={{ disabled: atCap, expanded: editing }} disabled={atCap}
          onPress={() => setEditing(true)} style={[s.pill, atCap && s.disabled]}>
          <Text style={s.action}>+ Add your own</Text>
        </Pressable>} />
      {atCap && <Text style={s.hint}>Up to {max} selections. Remove one to add another.</Text>}
      {editing && <View style={s.editor}>
        <TextInput autoFocus accessibilityLabel={`Custom ${label}`} value={draft}
          onChangeText={(text) => { setDraft(text); setError(''); }} maxLength={maxLength}
          placeholder={`Add your own ${label}`} placeholderTextColor={colors.mutedForeground}
          style={s.input} returnKeyType="done" onSubmitEditing={add} />
        {onAddOccasion && <>
          <Text style={s.hint}>Choose the closest occasion to help match your wardrobe.</Text>
          <SelectionGroup mode="single" options={OCCASION_OPTIONS} value={category}
            onChange={setCategory} layout="pill" caption={null} />
        </>}
        {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        <View style={s.actions}>
          <Pressable accessibilityRole="button" onPress={reset} style={s.pill}><Text style={s.hint}>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Add ${label}`} onPress={add} style={s.pill}><Text style={s.action}>Add</Text></Pressable>
        </View>
      </View>}
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: spacing.sm },
  editor: { gap: spacing.sm, paddingTop: spacing.sm },
  pill: { minHeight: 44, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline, borderRadius: radii.full, paddingHorizontal: spacing.lg },
  action: { color: colors.primary, fontSize: typography.text.body.fontSize },
  hint: { color: colors.mutedForeground, fontSize: typography.text.caption.fontSize },
  error: { color: colors.error, fontSize: typography.text.caption.fontSize },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.md,
    paddingHorizontal: spacing.md, color: colors.foreground, fontSize: typography.text.body.fontSize },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  disabled: { opacity: 0.4 },
});
