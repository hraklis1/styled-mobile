import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../lib/api';
import type { AppPreferences, Profile, ProfilePrompts, StyleProfileDetails } from '../types/profile';

export const PROFILE_QUERY_KEY = ['profile'] as const;

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => api.get<Profile>('/api/profile').then((r) => r.data),
  });
}

export type ProfileInput = {
  onboardingComplete?: boolean;
  onboardingVersion?: number;
  /** Merged per key on the server; send only the entries that changed. */
  profilePrompts?: ProfilePrompts;
  displayName?: string | null;
  photoUrl?: string | null;
  stylePreference?: string[] | null;
  colorPalette?: string[] | null;
  budgetRange?: string[] | null;
  bodyType?: string[] | null;
  fitPreference?: string | null;
  fitSilhouette?: string | null;
  styleProfileDetails?: StyleProfileDetails | null;
  sizingRegion?: string | null;
  location?: string | null;
  favoriteRetailers?: string[] | null;
  stylistVoice?: string | null;
  tempUnit?: string | null;
  appPreferences?: AppPreferences | null;
  occasions?: string[] | null;
  fitNotes?: string | null;
  sizeTop?: string | null;
  sizeBottom?: string | null;
  sizeDress?: string | null;
  sizeShoe?: string | null;
  suitJacket?: string | null;
  measurementChest?: string | null;
  measurementWaist?: string | null;
  measurementHips?: string | null;
  measurementInseam?: string | null;
  measurementHeight?: string | null;
};

/**
 * @param options.silent Suppress the failure alert. For background autosaves —
 *   onboarding checkpoints each step as you advance, and an alert per step on a
 *   flaky connection would be worse than the dropped write it is reporting. The
 *   next checkpoint sends the whole accumulated payload again, so a silent
 *   failure self-heals. Keep it false wherever the user pressed Save.
 */
export function useUpdateProfile(options?: { silent?: boolean }) {
  const qc = useQueryClient();
  const silent = options?.silent ?? false;
  return useMutation({
    mutationFn: (input: ProfileInput) =>
      api.patch<Profile>('/api/profile', input).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(PROFILE_QUERY_KEY, data);
    },
    onError: () => {
      if (!silent) Alert.alert('Error', "Couldn't save profile. Please try again.");
    },
  });
}
