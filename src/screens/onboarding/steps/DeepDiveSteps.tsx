import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SelectionGroup } from '../../../components/primitives/SelectionGroup';
import { colors, radii, spacing, typography } from '../../../theme';
import {
  SHOPPING_PRIORITY_OPTIONS,
  STYLE_AVOID_OPTIONS,
  optionsForCut,
  uniqueClean,
} from '../../../lib/profileOptions';
import { ALPHA_SIZES, footwearSizesForRegion, type ShoeRegion } from '../../../lib/sizes';
import type { OnboardingValues } from '../useOnboardingForm';
import { Field, TextField, s as f } from './atoms';

type StepProps = {
  values: OnboardingValues;
  set: <K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) => void;
};

const asOptions = (values: readonly (string | number)[]) =>
  values.map((v) => ({ value: String(v), label: String(v) }));

/** Free-text list with add/remove, for answers no chip list can anticipate. */
function TagField({
  label,
  hint,
  placeholder,
  tags,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange(uniqueClean([...tags, value]));
    setDraft('');
  };

  return (
    <Field label={label} hint={hint}>
      <View style={s.inputRow}>
        <View style={{ flex: 1 }}>
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            autoCapitalize="none"
            onSubmitEditing={add}
          />
        </View>
        <TouchableOpacity
          style={s.addBtn}
          onPress={add}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label}`}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
      {tags.length > 0 && (
        <View style={s.tagWrap}>
          {tags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={s.tag}
              onPress={() => onChange(tags.filter((t) => t !== tag))}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${tag}`}
            >
              <Text style={s.tagText}>{tag}</Text>
              <Ionicons name="close" size={12} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Field>
  );
}

/** 7 — Negative signals. The most useful thing a stylist can be told. */
export function StepAvoids({ values, set }: StepProps) {
  // Heels, bodycon and crop tops are not a question worth asking someone who
  // shops menswear. Anything already selected stays visible regardless.
  const avoidOptions = optionsForCut(STYLE_AVOID_OPTIONS, values.fitPreference, values.styleAvoids);

  return (
    <View style={f.step}>
      <Field label="Never put me in">
        <SelectionGroup
          mode="multi"
          options={avoidOptions}
          values={values.styleAvoids.filter((v) => avoidOptions.some((o) => o.value === v))}
          onChange={(next) => {
            // Chips own only the values they can render; anything typed in the
            // free-text field below survives a chip toggle untouched.
            const custom = values.styleAvoids.filter(
              (v) => !avoidOptions.some((o) => o.value === v),
            );
            set('styleAvoids', uniqueClean([...next, ...custom]));
          }}
          layout="pill"
        />
      </Field>

      <TagField
        label="Anything else"
        placeholder="e.g. boxy cropped jackets"
        tags={values.styleAvoids.filter((v) => !avoidOptions.some((o) => o.value === v))}
        onChange={(custom) => {
          const chips = values.styleAvoids.filter((v) => avoidOptions.some((o) => o.value === v));
          set('styleAvoids', uniqueClean([...chips, ...custom]));
        }}
      />

      <TagField
        label="Colours to avoid"
        placeholder="e.g. neon yellow"
        tags={values.avoidedColors}
        onChange={(next) => set('avoidedColors', next)}
      />
    </View>
  );
}

/** 8 — Shopping intent. Until now the Shopping Brief saw nothing from onboarding. */
export function StepShopping({ values, set }: StepProps) {
  return (
    <View style={f.step}>
      <Field label="What matters when you buy">
        <SelectionGroup
          mode="multi"
          options={SHOPPING_PRIORITY_OPTIONS}
          values={values.shoppingPriorities}
          onChange={(v) => set('shoppingPriorities', v)}
          layout="pill"
        />
      </Field>

      <TagField
        label="Shops you love"
        hint="We'll look here first when suggesting something new."
        placeholder="e.g. COS"
        tags={values.retailers}
        onChange={(next) => set('retailers', next)}
      />
    </View>
  );
}

/** 9 — Sizes. Scales follow the region and cut answered in the core steps. */
export function StepSizes({ values, set }: StepProps) {
  const region = (values.sizingRegion || 'US') as ShoeRegion;
  const showDress = values.fitPreference === 'feminine_cut';
  const waistUnit = region === 'EU' ? 'cm' : 'in';
  const waistValues =
    region === 'EU'
      ? Array.from({ length: 30 }, (_, i) => i + 60)
      : Array.from({ length: 24 }, (_, i) => i + 24);

  return (
    <View style={f.step}>
      <Field label={`Waist (${waistUnit})`} optional>
        <SelectionGroup
          mode="single"
          options={asOptions(waistValues)}
          value={values.sizeBottom}
          onChange={(v) => set('sizeBottom', v)}
          layout="pill"
          caption={null}
        />
      </Field>

      <Field label={`Shoe (${region})`} optional>
        <SelectionGroup
          mode="single"
          options={asOptions(footwearSizesForRegion(region))}
          value={values.sizeShoe}
          onChange={(v) => set('sizeShoe', v)}
          layout="pill"
          caption={null}
        />
      </Field>

      {showDress && (
        <Field label="Dress" optional>
          <SelectionGroup
            mode="single"
            options={asOptions(ALPHA_SIZES)}
            value={values.sizeDress}
            onChange={(v) => set('sizeDress', v)}
            layout="pill"
            caption={null}
          />
        </Field>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
  },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSelected,
  },
  tagText: { fontSize: typography.size.xs, color: colors.foreground },
});
