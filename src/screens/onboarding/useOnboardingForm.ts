import { useEffect, useRef, useState } from 'react';
import { useProfile, useUpdateProfile, type ProfileInput } from '../../hooks/useProfile';
import { derivePalette, deviceCountryCode, sizingRegionForCountry } from '../../lib/onboardingDefaults';
import {
  collapseToOnboardingOccasions,
  createEmptyStyleProfileDetails,
  expandOnboardingOccasions,
  hasStyleProfileDetailsValue,
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
  // v2
  /** Onboarding's 7 occasion picks; expanded to stored values on save. */
  occasionPicks: string[];
  /** Whether the user opened and changed the palette; otherwise it is derived. */
  paletteTouched: boolean;
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
  occasionPicks: [],
  paletteTouched: false,
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
      occasionPicks: collapseToOnboardingOccasions(normalizeOccasions(profile.occasions)),
      // A palette the user chose before counts as touched, so a retake
      // never quietly swaps it for a derived one.
      paletteTouched: details.paletteSource !== 'derived' && uniqueClean(profile.colorPalette).length > 0,
    });
  }, [profile]);

  const set = <K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const buildPayload = (v: OnboardingValues, onboardingComplete?: boolean): ProfileInput => {
    // Palette: the user's own if they touched it, otherwise a guess from the
    // chosen aesthetics, flagged so the stylist treats it as a soft default.
    const derived = !v.paletteTouched;
    const colorPalette = derived ? derivePalette(v.stylePreference) : uniqueClean(v.colorPalette);

    // Merge rather than replace: the Profile screen writes a much richer
    // styleProfileDetails than onboarding asks about, and a re-run must not
    // wipe the fields it never showed.
    const details = {
      ...(normalizeStyleProfileDetails(profile?.styleProfileDetails) ?? createEmptyStyleProfileDetails()),
      styleAvoids: uniqueClean(v.styleAvoids),
      avoidedColors: uniqueClean(v.avoidedColors),
      shoppingPriorities: uniqueClean(v.shoppingPriorities),
      paletteSource: derived && colorPalette.length ? ('derived' as const) : ('user' as const),
    };
    // Judge the whole merged blob, not just onboarding's fields: checking only
    // those sent null on a retake and erased everything Profile had written.
    const hasDetails = hasStyleProfileDetailsValue(details);

    const occasions = expandOnboardingOccasions(v.occasionPicks, normalizeOccasions(profile?.occasions));

    return {
      displayName: v.displayName.trim() || null,
      fitPreference: v.fitPreference || null,
      occasions: occasions.length ? occasions : null,
      stylePreference: v.stylePreference.length ? v.stylePreference : null,
      colorPalette: colorPalette.length ? colorPalette : null,
      budgetRange: v.budgetRange.length ? v.budgetRange : null,
      bodyType: v.bodyType.length ? v.bodyType : null,
      fitSilhouette: v.fitSilhouette || null,
      location: v.location.trim() || null,
      // Inferred from the device region when never set; editable in Profile.
      sizingRegion: v.sizingRegion || sizingRegionForCountry(deviceCountryCode()),
      sizeTop: v.sizeTop || null,
      sizeBottom: v.sizeBottom || null,
      sizeShoe: v.sizeShoe || null,
      sizeDress: v.sizeDress || null,
      favoriteRetailers: v.retailers.length ? v.retailers : null,
      styleProfileDetails: hasDetails ? details : null,
      ...(onboardingComplete != null ? { onboardingComplete, onboardingVersion: 2 } : {}),
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

  /**
   * Save only the named profile fields. The deferred questions (Profile's
   * "Sharpen your stylist", in-context prompts) reuse this form's field UIs
   * but must not rewrite answers they never showed — e.g. re-deriving the
   * palette or re-stamping the onboarding version.
   */
  const savePartial = (fields: (keyof ProfileInput)[]) => {
    const full = buildPayload(values);
    const partial: ProfileInput = {};
    for (const f of fields) (partial as Record<string, unknown>)[f] = full[f];
    return commit.mutateAsync(partial);
  };

  return {
    values,
    set,
    isLoading,
    isSaving: commit.isPending,
    saveCheckpoint,
    finish,
    savePartial,
  };
}
