import { useEffect, useRef, useState } from 'react';
import { useProfile, useUpdateProfile, type ProfileInput } from '../../hooks/useProfile';
import {
  createEmptyStyleProfileDetails,
  normalizeBodyType,
  normalizeBudgetRange,
  normalizeOccasions,
  normalizeStyleProfileDetails,
  normalizeStylePreference,
  uniqueClean,
} from '../../lib/profileOptions';

/**
 * Onboarding's answers, and the rules for getting them in and out of the profile.
 *
 * Two behaviours here are corrections of how this flow used to work:
 *
 * - It PREFILLS. Every field used to start empty, so anyone who skipped, quit,
 *   or came back through the new "Retake style quiz" entry re-answered from
 *   scratch and overwrote what they had already told us.
 * - It CHECKPOINTS on every step instead of writing once at Finish, and Skip
 *   saves what you answered rather than throwing it away. Abandoning at step 4
 *   used to lose all four steps.
 */

export type OnboardingValues = {
  // Core
  displayName: string;
  fitPreference: string;
  occasions: string[];
  stylePreference: string[];
  colorPalette: string[];
  budgetRange: string[];
  bodyType: string[];
  fitSilhouette: string;
  location: string;
  sizingRegion: string;
  sizeTop: string;
  // Deep dive
  styleAvoids: string[];
  avoidedColors: string[];
  shoppingPriorities: string[];
  retailers: string[];
  sizeBottom: string;
  sizeShoe: string;
  sizeDress: string;
};

const EMPTY: OnboardingValues = {
  displayName: '',
  fitPreference: '',
  occasions: [],
  stylePreference: [],
  colorPalette: [],
  budgetRange: [],
  bodyType: [],
  fitSilhouette: '',
  location: '',
  sizingRegion: '',
  sizeTop: '',
  styleAvoids: [],
  avoidedColors: [],
  shoppingPriorities: [],
  retailers: [],
  sizeBottom: '',
  sizeShoe: '',
  sizeDress: '',
};

export function useOnboardingForm() {
  const { data: profile, isLoading } = useProfile();
  // Checkpoints are silent; only the explicit Finish surfaces a failure.
  const checkpoint = useUpdateProfile({ silent: true });
  const commit = useUpdateProfile();

  const [values, setValues] = useState<OnboardingValues>(EMPTY);
  const hydrated = useRef(false);

  // Hydrate once. Re-running on every profile refetch would stomp on whatever
  // the user is mid-way through typing, since each checkpoint returns a fresh
  // profile and would otherwise bounce the form back to the last saved state.
  useEffect(() => {
    if (!profile || hydrated.current) return;
    hydrated.current = true;
    const details = normalizeStyleProfileDetails(profile.styleProfileDetails);
    setValues({
      displayName: profile.displayName ?? '',
      fitPreference: profile.fitPreference ?? '',
      occasions: normalizeOccasions(profile.occasions),
      stylePreference: normalizeStylePreference(profile.stylePreference),
      colorPalette: uniqueClean(profile.colorPalette),
      budgetRange: normalizeBudgetRange(profile.budgetRange),
      bodyType: normalizeBodyType(profile.bodyType),
      fitSilhouette: profile.fitSilhouette ?? '',
      location: profile.location ?? '',
      sizingRegion: profile.sizingRegion ?? '',
      sizeTop: profile.sizeTop ?? '',
      styleAvoids: details.styleAvoids,
      avoidedColors: details.avoidedColors,
      shoppingPriorities: details.shoppingPriorities,
      retailers: uniqueClean(profile.favoriteRetailers),
      // `size_bottom` is stored as "32x30" when an inseam is known. Onboarding
      // only ever asks for the waist, so keep the inseam if it is already there.
      sizeBottom: profile.sizeBottom ?? '',
      sizeShoe: profile.sizeShoe ?? '',
      sizeDress: profile.sizeDress ?? '',
    });
  }, [profile]);

  const set = <K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const buildPayload = (v: OnboardingValues, onboardingComplete?: boolean): ProfileInput => {
    // Merge rather than replace: the Profile screen writes a much richer
    // styleProfileDetails than onboarding asks about, and a re-run must not
    // wipe the fields it never showed.
    const details = {
      ...(normalizeStyleProfileDetails(profile?.styleProfileDetails) ?? createEmptyStyleProfileDetails()),
      styleAvoids: uniqueClean(v.styleAvoids),
      avoidedColors: uniqueClean(v.avoidedColors),
      shoppingPriorities: uniqueClean(v.shoppingPriorities),
    };
    const hasDetails =
      details.styleAvoids.length > 0 ||
      details.avoidedColors.length > 0 ||
      details.shoppingPriorities.length > 0;

    return {
      displayName: v.displayName.trim() || null,
      fitPreference: v.fitPreference || null,
      occasions: v.occasions.length ? v.occasions : null,
      stylePreference: v.stylePreference.length ? v.stylePreference : null,
      colorPalette: v.colorPalette.length ? v.colorPalette : null,
      budgetRange: v.budgetRange.length ? v.budgetRange : null,
      bodyType: v.bodyType.length ? v.bodyType : null,
      fitSilhouette: v.fitSilhouette || null,
      location: v.location.trim() || null,
      sizingRegion: v.sizingRegion || null,
      sizeTop: v.sizeTop || null,
      sizeBottom: v.sizeBottom || null,
      sizeShoe: v.sizeShoe || null,
      sizeDress: v.sizeDress || null,
      favoriteRetailers: v.retailers.length ? v.retailers : null,
      styleProfileDetails: hasDetails ? details : null,
      ...(onboardingComplete != null ? { onboardingComplete } : {}),
    };
  };

  /** Fire-and-forget save of everything answered so far. Never gates the UI. */
  const saveCheckpoint = (next?: Partial<OnboardingValues>) => {
    const merged = next ? { ...values, ...next } : values;
    checkpoint.mutate(buildPayload(merged));
  };

  /** Save and hand control to the app. Surfaces failures. */
  const finish = (onDone?: () => void) => {
    commit.mutate(buildPayload(values, true), { onSuccess: () => onDone?.() });
  };

  return {
    values,
    set,
    isLoading,
    isSaving: commit.isPending,
    saveCheckpoint,
    finish,
  };
}
