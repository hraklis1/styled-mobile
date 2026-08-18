import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export type SuggestionRequest = {
  weather: string;
  event: string;
  eventTitle?: string;
  eventLocation?: string;
  eventNotes?: string;
  details?: string;
};

export type SuggestionResult = {
  suggestion: string;
  readinessStatus?: 'ready' | 'incomplete' | 'needs_clarification';
  foundationItemIds?: number[];
  missingEssentials?: Array<{ label: string; category: string; reason: string; context: string; priority: number; unlocks?: string[] }>;
  clarification?: { question: string; options: Array<{ label: string; value: string }>; safestOption?: string };
  outfit: {
    itemIds?: Array<{ id: number; category: string }>;
  };
};

export function useGenerateSuggestion() {
  return useMutation({
    mutationFn: (data: SuggestionRequest) =>
      api.post<SuggestionResult>('/api/suggestions', data).then((r) => r.data),
  });
}
