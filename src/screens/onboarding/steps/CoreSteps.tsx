import React from 'react';
import { View } from 'react-native';
import { SelectionGroup } from '../../../components/primitives/SelectionGroup';
import { BODY_TYPE_OPTIONS, FIT_SILHOUETTE_OPTIONS } from '../../../lib/profileOptions';
import type { OnboardingValues } from '../useOnboardingForm';
import { Field, s as f } from './atoms';

type StepProps = {
  values: OnboardingValues;
  set: <K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) => void;
};

/**
 * Proportions and default fit. The last survivor of the v1 core steps: the
 * deferred "fit" profile question (features/profilePrompts) renders it.
 */
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
