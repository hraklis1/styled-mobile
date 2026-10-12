import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
export type StylistMemory = {
  id: string; statement: string; kind: 'explicit' | 'inferred';
  source: 'conversation' | 'profile' | 'legacy' | 'correction';
  confidence: number; occurredAt: string | null; sourceQuote: string | null;
};
const key = ['profile', 'stylist-client-memory'] as const;
export function useStylistMemory() {
  return useQuery({ queryKey: key, queryFn: async () => (await api.get<{ enabled: boolean; entries: StylistMemory[]; revision: number }>('/api/stylist/client-memory')).data, retry: 1 });
}
export function useEditStylistMemory() {
  const cache = useQueryClient();
  return useMutation({ mutationFn: async ({ id, statement }: { id: string; statement?: string }) => {
    const path = `/api/stylist/client-memory/${encodeURIComponent(id)}`;
    return statement === undefined ? api.delete(path) : api.patch(path, { statement });
  }, onSuccess: () => cache.invalidateQueries({ queryKey: key }) });
}
