import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SelectionGroup } from '../../../components/primitives/SelectionGroup';
import { LocationAutocompleteInput } from '../../../components/primitives/LocationAutocompleteInput';
import { useActiveStylingLocation } from '../../../hooks/useActiveStylingLocation';
import { colors, radii, spacing, typography } from '../../../theme';
import {
  BODY_TYPE_OPTIONS,
  BUDGET_OPTIONS,
  FIT_PREFERENCE_OPTIONS,
  FIT_SILHOUETTE_OPTIONS,
  OCCASION_OPTIONS,
  PALETTE_OPTIONS,
  SIZING_REGION_OPTIONS,
  STYLE_OPTIONS,
  TOP_SIZES,
} from '../../../lib/profileOptions';
import type { OnboardingValues } from '../useOnboardingForm';
import { Field, TextField, s as f } from './atoms';

type StepProps = {
  values: OnboardingValues;
  set: <K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) => void;
};

const asOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));

/** 1 — Introductions. */
export function StepIntro({ values, set }: StepProps) {
  return (
    <View style={f.step}>
      <Field label="Your name" hint="How your stylist addresses you.">
        <TextField
          value={values.displayName}
          onChangeText={(v) => set('displayName', v)}
          placeholder="e.g. Alex"
          maxLength={80}
        />
      </Field>

      <Field
        label="Cuts you shop"
        hint="Sets the size scales we use and the shapes we suggest. You can change it any time."
      >
        <SelectionGroup
          mode="single"
          options={FIT_PREFERENCE_OPTIONS}
          value={values.fitPreference}
          onChange={(v) => set('fitPreference', v)}
          layout="pill"
        />
      </Field>
    </View>
  );
}

/** 2 — Occasions. */
export function StepOccasions({ values, set }: StepProps) {
  return (
    <SelectionGroup
      mode="multi"
      options={OCCASION_OPTIONS}
      values={values.occasions}
      onChange={(v) => set('occasions', v)}
      layout="pill"
    />
  );
}

/** 3 — Aesthetic. Capped, because eleven answers is the same as none. */
export function StepStyle({ values, set }: StepProps) {
  return (
    <SelectionGroup
      mode="multi"
      options={STYLE_OPTIONS}
      values={values.stylePreference}
      onChange={(v) => set('stylePreference', v)}
      layout="card"
      max={4}
    />
  );
}

/** 4 — Colour and budget. Both plural: people shop more than one tier. */
export function StepColorBudget({ values, set }: StepProps) {
  return (
    <View style={f.step}>
      <Field label="Colour palette">
        <SelectionGroup
          mode="multi"
          options={PALETTE_OPTIONS}
          values={values.colorPalette}
          onChange={(v) => set('colorPalette', v)}
          layout="swatch"
          max={3}
        />
      </Field>

      <Field label="Budget" hint="Pick every tier you actually shop — thrift for basics and premium for coats is a normal answer.">
        <SelectionGroup
          mode="multi"
          options={BUDGET_OPTIONS}
          values={values.budgetRange}
          onChange={(v) => set('budgetRange', v)}
          layout="pill"
        />
      </Field>
    </View>
  );
}

/** 5 — Proportions and fit. */
export function StepBodyFit({ values, set }: StepProps) {
  return (
    <View style={f.step}>
      <Field label="Proportions" hint="Whatever applies — these combine.">
        <SelectionGroup
          mode="multi"
          options={BODY_TYPE_OPTIONS}
          values={values.bodyType}
          onChange={(v) => set('bodyType', v)}
          layout="card"
          max={3}
        />
      </Field>

      <Field label="Default fit" hint="Your starting point. We'll still vary it by piece.">
        <SelectionGroup
          mode="single"
          options={FIT_SILHOUETTE_OPTIONS}
          value={values.fitSilhouette}
          onChange={(v) => set('fitSilhouette', v)}
          layout="card"
        />
      </Field>
    </View>
  );
}

/** 6 — Location and top size. */
export function StepLocationSizing({ values, set }: StepProps) {
  const { permissionStatus, requestCurrentLocation } = useActiveStylingLocation();
  const [requesting, setRequesting] = React.useState(false);
  const granted = permissionStatus === 'granted';

  const handleRequest = async () => {
    setRequesting(true);
    try {
      await requestCurrentLocation();
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={f.step}>
      <Field
        label="Weather-aware styling"
        hint="Let Styled use your current city while the app is open, so outfits match the weather wherever you are."
      >
        <TouchableOpacity
          style={[s.permissionBtn, granted && s.permissionBtnGranted]}
          onPress={handleRequest}
          disabled={requesting || granted}
          activeOpacity={0.75}
          accessibilityRole="button"
        >
          {requesting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons
              name={granted ? 'checkmark-circle' : 'navigate-outline'}
              size={18}
              color={colors.primary}
            />
          )}
          <Text style={s.permissionText}>
            {granted ? 'Current location enabled' : 'Use current location'}
          </Text>
        </TouchableOpacity>
        {permissionStatus === 'denied' ? (
          <Text style={f.hint}>Location is off. A home city below works just as well.</Text>
        ) : null}
      </Field>

      <Field
        label="Home city"
        optional
        hint="The fallback when location is unavailable. We never store GPS coordinates as Home."
      >
        <LocationAutocompleteInput
          value={values.location}
          onChangeText={(v) => set('location', v)}
          onSelect={(v) => set('location', v)}
          placeholder="e.g. London, UK"
        />
      </Field>

      <Field label="Sizing region">
        <SelectionGroup
          mode="single"
          options={SIZING_REGION_OPTIONS}
          value={values.sizingRegion}
          onChange={(v) => set('sizingRegion', v)}
          layout="pill"
          clearable={false}
        />
      </Field>

      <Field label="Top size" optional>
        <SelectionGroup
          mode="single"
          options={asOptions(TOP_SIZES)}
          value={values.sizeTop}
          onChange={(v) => set('sizeTop', v)}
          layout="pill"
          caption={null}
        />
      </Field>
    </View>
  );
}

const s = StyleSheet.create({
  permissionBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSelected,
  },
  permissionBtnGranted: { opacity: 0.8 },
  permissionText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
});
