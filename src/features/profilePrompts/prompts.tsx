import React from 'react';
import { View } from 'react-native';
import { SelectionGroup } from '../../components/primitives/SelectionGroup';
import { budgetOptionsForCurrency, deviceCurrencyCode } from '../../lib/onboardingDefaults';
import { SIZING_REGION_OPTIONS, TOP_SIZES } from '../../lib/profileOptions';
import type { ProfileInput } from '../../hooks/useProfile';
import type { ProfilePromptKey } from '../../types/profile';
import { StepBodyFit } from '../../screens/onboarding/steps/CoreSteps';
import { StepAvoids, StepShopping, StepSizes } from '../../screens/onboarding/steps/DeepDiveSteps';
import { Field, s as f } from '../../screens/onboarding/steps/atoms';
import type { StepProps } from '../../screens/onboarding/v2/types';

/**
 * The deferred profile questions. Each reuses the field UI the old
 * questionnaire had, and saves only its own fields (see savePartial).
 */
export type PromptDef = {
  eyebrow: string;
  title: string;
  sub: string;
  fields: (keyof ProfileInput)[];
  Body: (props: StepProps) => React.ReactElement;
};

function BudgetBody({ values, set }: StepProps) {
  return (
    <SelectionGroup
      mode="multi"
      options={budgetOptionsForCurrency(deviceCurrencyCode())}
      values={values.budgetRange}
      onChange={(v) => set('budgetRange', v)}
      layout="pill"
    />
  );
}

function SizesBody(props: StepProps) {
  const { values, set } = props;
  return (
    <View style={f.step}>
      <Field label="Sizing region">
        <SelectionGroup
          mode="single"
          options={SIZING_REGION_OPTIONS}
          value={values.sizingRegion}
          onChange={(v) => set('sizingRegion', v)}
          layout="pill"
          clearable={false}
          caption={null}
        />
      </Field>
      <Field label="Top" optional>
        <SelectionGroup
          mode="single"
          options={TOP_SIZES.map((v) => ({ value: v, label: v }))}
          value={values.sizeTop}
          onChange={(v) => set('sizeTop', v)}
          layout="pill"
          caption={null}
        />
      </Field>
      <StepSizes {...props} />
    </View>
  );
}

export const PROMPTS: Record<ProfilePromptKey, PromptDef> = {
  budget: {
    eyebrow: 'BUDGET',
    title: "So we show things you'd actually buy.",
    sub: 'Pick every tier you shop — thrift for basics and premium for coats is a normal answer.',
    fields: ['budgetRange'],
    Body: BudgetBody,
  },
  sizes: {
    eyebrow: 'SIZES',
    title: 'Your sizes.',
    sub: 'Only used to keep picks wearable. Private.',
    fields: ['sizingRegion', 'sizeTop', 'sizeBottom', 'sizeShoe', 'sizeDress'],
    Body: SizesBody,
  },
  fit: {
    eyebrow: 'FIT',
    title: 'Two quick ones that sharpen fit advice.',
    sub: 'Whatever applies — these combine.',
    fields: ['bodyType', 'fitSilhouette'],
    Body: StepBodyFit,
  },
  avoids: {
    eyebrow: 'THE NO LIST',
    title: 'Anything you never wear?',
    sub: "We'll keep it out of your looks and picks.",
    fields: ['styleProfileDetails'],
    Body: StepAvoids,
  },
  retailers: {
    eyebrow: 'HOW YOU SHOP',
    title: 'Where should we look first?',
    sub: 'Your shops and what matters when you buy.',
    fields: ['favoriteRetailers', 'styleProfileDetails'],
    Body: StepShopping,
  },
};
