import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../lib/api';
import { track } from '../lib/analytics';
import type { Outfit } from '../types/outfit';
import type { DailyLookGenerationTrigger } from '../lib/dailyStylistPick';

export type DailyLookCandidateItem = {
  id: number;
  category: string;
};

export type DailyLookReadinessStatus = 'ready' | 'incomplete' | 'priority';

export type DailyLookMissingEssential = {
  label: string;
  category: string;
  reason: string;
  context: string;
  priority: number;
  unlocks: string[];
  anchorItemIds: number[];
  formality?: string;
  silhouette?: string;
  material?: string;
  preferredColors?: string[];
};

export type DailyLookCandidate = {
  id: number;
  userId: number;
  localDate: string;
  status: 'generating' | 'active' | 'saved' | 'dismissed' | 'failed';
  trigger: DailyLookGenerationTrigger;
  eventId: number | null;
  name: string;
  reason: string;
  stylistNotes: string | null;
  itemIds: DailyLookCandidateItem[];
  readinessStatus: DailyLookReadinessStatus;
  foundationItemIds: DailyLookCandidateItem[];
  missingEssentials: DailyLookMissingEssential[];
  contextHash: string | null;
  aiGeneratedImageUrl: string | null;
  compositionHash: string | null;
  recommendationId: number | null;
  savedOutfitId: number | null;
  imageAttempts: number;
  createdAt: string;
  updatedAt: string;
};

export type DailyLookResolveInput = {
  localDate: string;
  timezone: string;
  location?: {
    source?: 'current' | 'home' | 'destination' | 'conversation';
    label?: string;
    lat?: number;
    lon?: number;
  };
  weather?: {
    condition: 'sunny' | 'rainy' | 'cold' | 'mild';
    temperatureC: number;
    summary?: string;
  };
  trigger: DailyLookGenerationTrigger;
  eventId?: number;
  recentOutfitIds: number[];
  fallbackOutfitIds: number[];
  clientContextRevision: string;
  currentOutfitId?: number | null;
};

export type DailyLookResolveResponse = {
  outcome: 'candidate' | 'none' | 'dismissed' | 'failed' | 'generating';
  candidate: DailyLookCandidate | null;
  candidateId?: number;
  fallbackOutfitId?: number | null;
};

export const DAILY_LOOK_QUERY_KEY = ['daily-look'] as const;

function normalizeCandidate(candidate: DailyLookCandidate | null): DailyLookCandidate | null {
  if (!candidate) return null;
  return {
    ...candidate,
    readinessStatus: candidate.readinessStatus ?? 'ready',
    foundationItemIds: candidate.foundationItemIds ?? [],
    missingEssentials: (candidate.missingEssentials ?? []).map((gap) => ({
      ...gap,
      unlocks: gap.unlocks ?? [],
      anchorItemIds: gap.anchorItemIds ?? [],
    })),
    contextHash: candidate.contextHash ?? null,
  };
}

export function useResolveDailyLook(input: DailyLookResolveInput | null, enabled: boolean) {
  return useQuery<DailyLookResolveResponse, Error>({
    queryKey: [...DAILY_LOOK_QUERY_KEY, input?.localDate ?? null, input?.clientContextRevision ?? null],
    enabled: enabled && !!input,
    queryFn: () => api.post<DailyLookResolveResponse>('/api/home/daily-look/resolve', input).then((response) => ({
      ...response.data,
      candidate: normalizeCandidate(response.data.candidate),
    })),
    staleTime: 86_400_000,
    retry: false,
  });
}

export function useSaveDailyLook() {
  const queryClient = useQueryClient();
  return useMutation<{ outfit: Outfit }, Error, { candidateId: number }>({
    mutationFn: ({ candidateId }) => api.post<{ outfit: Outfit }>(`/api/home/daily-look/${candidateId}/save`, {}).then((response) => response.data),
    onError: (error) => {
      if ((error as { response?: { status?: number } }).response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: DAILY_LOOK_QUERY_KEY });
      }
    },
    onSuccess: ({ outfit }) => {
      queryClient.setQueryData<Outfit[]>(['outfits'], (old = []) => old.some((entry) => entry.id === outfit.id) ? old : [outfit, ...old]);
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: DAILY_LOOK_QUERY_KEY });
      track('daily_look_saved', { outfitId: outfit.id });
    },
  });
}

export function useDismissDailyLook() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { candidateId: number }>({
    mutationFn: ({ candidateId }) => api.post(`/api/home/daily-look/${candidateId}/dismiss`, {}).then(() => undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DAILY_LOOK_QUERY_KEY });
      track('daily_look_dismissed');
    },
  });
}
