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
