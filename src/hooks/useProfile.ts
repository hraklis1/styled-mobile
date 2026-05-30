import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../lib/api';
import type { Profile } from '../types/profile';

export const PROFILE_QUERY_KEY = ['profile'] as const;

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => api.get<Profile>('/api/profile').then((r) => r.data),
  });
}

export type ProfileInput = {
  onboardingComplete?: boolean;
  displayName?: string | null;
  photoUrl?: string | null;
  stylePreference?: string[] | null;
  colorPalette?: string[] | null;
  budgetRange?: string | null;
  bodyType?: string | null;
  fitPreference?: string | null;
  sizingRegion?: string | null;
  location?: string | null;
  favoriteRetailers?: string[] | null;
  stylistVoice?: string | null;
  tempUnit?: string | null;
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

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) =>
      api.patch<Profile>('/api/profile', input).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(PROFILE_QUERY_KEY, data);
    },
    onError: () => {
      Alert.alert('Error', "Couldn't save profile. Please try again.");
    },
  });
}
