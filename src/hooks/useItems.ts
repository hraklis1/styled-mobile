import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Item, ItemCategory, ScanResult } from '../types/item';

export type { ScanResult };

export const ITEMS_QUERY_KEY = ['items'] as const;
export const BRANDS_QUERY_KEY = ['brands'] as const;

function invalidateItemQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
  qc.invalidateQueries({ queryKey: BRANDS_QUERY_KEY });
}

export type CreateItemInput = {
  name: string;
  brand?: string | null;
  category?: ItemCategory | null;
  color?: string | null;
  tags?: string[];
  imageUrl?: string | null;
  subcategory?: string | null;
  style?: string | null;
  season?: string | null;
  occasion?: string | null;
  pattern?: string | null;
  fit?: string | null;
  neckline?: string | null;
  material?: string | null;
  care?: string | null;
  formalityStyles?: string[];
  notableDetails?: string[];
  colorPalette?: string[];
  notes?: string | null;
};

export function useScanItem() {
  return useMutation({
    mutationFn: (imageData: string) =>
      api.post<ScanResult>('/api/items/scan', { imageData }).then((r) => r.data),
  });
}

export function useItems() {
  return useQuery({
    queryKey: ITEMS_QUERY_KEY,
    queryFn: () => api.get<Item[]>('/api/items').then((r) => r.data),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Item> & { id: number }) =>
      api.patch<Item>(`/api/items/${id}`, patch).then((r) => r.data),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ITEMS_QUERY_KEY });
      const previous = qc.getQueryData<Item[]>(ITEMS_QUERY_KEY);
      qc.setQueryData<Item[]>(ITEMS_QUERY_KEY, (old) =>
        old?.map((i) => (i.id === id ? { ...i, ...patch } : i)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ITEMS_QUERY_KEY, ctx.previous);
    },
    onSettled: () => invalidateItemQueries(qc),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/items/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ITEMS_QUERY_KEY });
      const previous = qc.getQueryData<Item[]>(ITEMS_QUERY_KEY);
      qc.setQueryData<Item[]>(ITEMS_QUERY_KEY, (old) => old?.filter((i) => i.id !== id) ?? []);
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(ITEMS_QUERY_KEY, ctx.previous);
    },
    onSettled: () => invalidateItemQueries(qc),
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput) =>
      api.post<Item>('/api/items', input).then((r) => r.data),
    onSuccess: (newItem) => {
      qc.setQueryData<Item[]>(ITEMS_QUERY_KEY, (old = []) => [newItem, ...old]);
    },
    onSettled: () => invalidateItemQueries(qc),
  });
}

export function useMarkItemWorn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/api/items/${id}/worn`).then((r) => r.data as Item),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ITEMS_QUERY_KEY });
      const previous = qc.getQueryData<Item[]>(ITEMS_QUERY_KEY);
      qc.setQueryData<Item[]>(ITEMS_QUERY_KEY, (old) =>
        old?.map((i) =>
          i.id === id
            ? { ...i, wearCount: i.wearCount + 1, lastWornAt: new Date().toISOString() }
            : i
        ) ?? []
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(ITEMS_QUERY_KEY, ctx.previous);
    },
    onSettled: () => invalidateItemQueries(qc),
  });
}
