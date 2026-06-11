import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert } from 'react-native';
import { api, isNetworkError } from '../lib/api';
import { FASHION_BRANDS } from '../lib/fashionBrands';
import { track } from '../lib/analytics';
import type { Item, ItemCategory, ScanResult } from '../types/item';
import type { SizeProfile } from '../lib/sizes';
import { OUTFITS_QUERY_KEY } from './useOutfits';

export type { ScanResult };

export type PoseScanItem = {
  name: string;
  category: string;
  color: string;
  description?: string;
  croppedWebP?: string | null;
  bbox_pct?: { x: number; y: number; width: number; height: number } | null;
};

export const ITEMS_QUERY_KEY = ['items'] as const;
export const ARCHIVED_ITEMS_QUERY_KEY = ['items', 'archived'] as const;
export const BRANDS_QUERY_KEY = ['brands'] as const;
export const CLOSET_REFRESH_QUERY_KEY = ['closet', 'refresh'] as const;

function invalidateItemQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
  qc.invalidateQueries({ queryKey: BRANDS_QUERY_KEY });
}

export type CreateItemInput = {
  name: string;
  brand?: string | null;
  category?: ItemCategory | null;
  color?: string | null;
  colorNormalized?: string | null;
  colorTemperature?: string | null;
  tags?: string[];
  imageUrl?: string | null;
  subcategory?: string | null;
  style?: string | null;
  seasons?: string[];
  occasions?: string[];
  pattern?: string | null;
  fit?: string | null;
  neckline?: string | null;
  sleeveLength?: string | null;
  material?: string | null;
  care?: string | null;
  condition?: string | null;
  warmthRating?: number | null;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  formalityStyles?: string[];
  notableDetails?: string[];
  colorPalette?: string[];
  notes?: string | null;
  sizeProfile?: SizeProfile | null;
  needsDetails?: boolean;
};

type ScanInput = { uri: string; brandHint?: string; outfitContext?: string };

export function useScanItem() {
  return useMutation({
    mutationFn: ({ uri, brandHint, outfitContext }: ScanInput) => {
      const formData = new FormData();
      formData.append('image', { uri, type: 'image/jpeg', name: 'scan.jpg' } as unknown as Blob);
      if (brandHint) formData.append('brandHint', brandHint);
      if (outfitContext) formData.append('outfitContext', outfitContext);
      return api
        .post<ScanResult>('/api/items/scan', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    },
    retry: (failureCount, error) => isNetworkError(error) && failureCount < 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

/** Direct API call for parallel multi-item extraction (no hook — avoids shared mutation state). */
export async function scanItemDirect(input: {
  imageData: string;
  brandHint?: string;
  outfitContext?: string;
}): Promise<ScanResult> {
  return api
    .post<ScanResult>('/api/items/scan', input)
    .then((r) => r.data);
}

function useWardrobeBrands() {
  return useQuery({
    queryKey: BRANDS_QUERY_KEY,
    queryFn: () => api.get<string[]>('/api/items/brands').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBrandSuggestions(): string[] {
  const { data: wardrobeBrands = [] } = useWardrobeBrands();
  return useMemo(() => {
    const wardrobeSet = new Set(wardrobeBrands.map((b) => b.toLowerCase()));
    const extras = FASHION_BRANDS.filter((b) => !wardrobeSet.has(b.toLowerCase()));
    return [...wardrobeBrands, ...extras];
  }, [wardrobeBrands]);
}

export function useScanVisionPose() {
  return useMutation({
    mutationFn: ({ imageBase64 }: { imageBase64: string }) =>
      api
        .post<{ items: PoseScanItem[] }>('/api/scan-vision-pose', { imageBase64 })
        .then((r) => r.data),
    retry: (failureCount, error) => isNetworkError(error) && failureCount < 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

/** Direct API call for batch processing (no shared mutation state). */
export async function scanVisionPoseDirect(imageBase64: string): Promise<{ items: PoseScanItem[] }> {
  return api
    .post<{ items: PoseScanItem[] }>('/api/scan-vision-pose', { imageBase64 })
    .then((r) => r.data);
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
      Alert.alert('Error', "Couldn't update item. Please try again.");
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
      Alert.alert('Error', "Couldn't delete item. Please try again.");
    },
    onSettled: () => {
      invalidateItemQueries(qc);
      qc.invalidateQueries({ queryKey: CLOSET_REFRESH_QUERY_KEY });
      qc.invalidateQueries({ queryKey: OUTFITS_QUERY_KEY });
    },
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput) =>
      api.post<Item>('/api/items', input).then((r) => r.data),
    onSuccess: (newItem) => {
      qc.setQueryData<Item[]>(ITEMS_QUERY_KEY, (old = []) => [newItem, ...old]);
      track('item_added', { category: newItem.category });
    },
    onError: () => {
      Alert.alert('Error', "Couldn't save item. Please try again.");
    },
    onSettled: () => invalidateItemQueries(qc),
  });
}

export type TagScanResult = {
  brand: string | null;
  size: string | null;
  material: string | null;
  care: string | null;
};

export function useScanTag() {
  return useMutation({
    mutationFn: ({ imageData }: { imageData: string }) =>
      api.post<TagScanResult>('/api/items/scan-tag', { imageData }).then((r) => r.data),
  });
}

export type RefineImageInput = {
  name: string;
  color: string;
  brand?: string | null;
  category: ItemCategory;
};

export function useRefineImage() {
  return useMutation({
    mutationFn: (input: RefineImageInput) =>
      api.post<{ imageData: string }>('/api/items/refine-image', input).then((r) => r.data),
  });
}

export function useArchivedItems() {
  return useQuery({
    queryKey: ARCHIVED_ITEMS_QUERY_KEY,
    queryFn: () => api.get<Item[]>('/api/items/archived').then((r) => r.data),
  });
}

export function useArchiveItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, archive }: { ids: number[]; archive: boolean }) =>
      Promise.all(ids.map((id) => api.patch<Item>(`/api/items/${id}`, { isArchived: archive }).then((r) => r.data))),
    onMutate: async ({ ids, archive }) => {
      await qc.cancelQueries({ queryKey: ITEMS_QUERY_KEY });
      await qc.cancelQueries({ queryKey: ARCHIVED_ITEMS_QUERY_KEY });
      const prevActive = qc.getQueryData<Item[]>(ITEMS_QUERY_KEY);
      const prevArchived = qc.getQueryData<Item[]>(ARCHIVED_ITEMS_QUERY_KEY);
      if (archive) {
        qc.setQueryData<Item[]>(ITEMS_QUERY_KEY, (old) => old?.filter((i) => !ids.includes(i.id)) ?? []);
      } else {
        qc.setQueryData<Item[]>(ARCHIVED_ITEMS_QUERY_KEY, (old) => old?.filter((i) => !ids.includes(i.id)) ?? []);
      }
      return { prevActive, prevArchived };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevActive) qc.setQueryData(ITEMS_QUERY_KEY, ctx.prevActive);
      if (ctx?.prevArchived) qc.setQueryData(ARCHIVED_ITEMS_QUERY_KEY, ctx.prevArchived);
      Alert.alert('Error', "Couldn't archive items. Please try again.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ARCHIVED_ITEMS_QUERY_KEY });
    },
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
      Alert.alert('Error', "Couldn't mark as worn. Please try again.");
    },
    onSettled: () => {
      invalidateItemQueries(qc);
      qc.invalidateQueries({ queryKey: CLOSET_REFRESH_QUERY_KEY });
    },
  });
}

export type ClosetRefreshData = {
  summary: {
    totalItems: number;
    neverWornCount: number;
    staleCount: number;
    duplicateCount: number;
    staleThresholdDays: number;
  };
  staleItems: Array<{
    item: Item;
    daysSinceWorn: number | null;
    reason: 'never_worn' | 'stale';
  }>;
  similarGroups: Array<{
    key: string;
    label: string;
    items: Item[];
  }>;
};

export function useClosetRefresh() {
  return useQuery<ClosetRefreshData>({
    queryKey: CLOSET_REFRESH_QUERY_KEY,
    queryFn: () => api.get('/api/closet/refresh').then((r) => r.data as ClosetRefreshData),
    staleTime: 60 * 1000,
  });
}
