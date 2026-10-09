import type { OnboardingValues } from '../useOnboardingForm';

export type StepProps = {
  values: OnboardingValues;
  set: <K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) => void;
};
