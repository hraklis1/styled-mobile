import { useMemo } from 'react';
import { useShoppingOfflineStore, emptyShoppingAccount, overlayShoppingOperations } from '../stores/useShoppingOfflineStore';
import { cacheShoppingImages, resolveShoppingImage } from '../lib/shoppingImageCache';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { isSupabaseSchemaMissing } from '../lib/supabaseErrors';
import { supabase } from '../lib/supabase';
import type { RemoteShoppingSnapRow, ShoppingFindCatalogStatus, ShoppingSnap } from '../types/shoppingSnap';

export const SHOPPING_SNAPS_QUERY_KEY = ['shopping-snaps'] as const;

function mapRemoteSnap(row: RemoteShoppingSnapRow): ShoppingSnap {
  const parsedPrice = row.extracted_price === null ? null : Number(row.extracted_price);
  const session = Array.isArray(row.shopping_sessions)
    ? row.shopping_sessions[0] ?? null
    : row.shopping_sessions;
  const group = Array.isArray(row.shopping_capture_groups)
    ? row.shopping_capture_groups[0] ?? null
    : row.shopping_capture_groups;
  const catalogStatus = group?.catalog_status ?? 'considering';

  return {
    ...group?.purchase_details,
    id: row.id,
    imageUri: row.image_url,
    remoteImageUri: row.image_url,
    storagePath: row.storage_path,
    storeName: row.store_name,
    storeLocationId: session?.store_location_id ?? null,
    shoppingSessionId: row.shopping_session_id,
    captureGroupId: row.capture_group_id ?? row.id,
    captureRole: row.capture_role ?? 'unknown',
    captureSequence: row.capture_sequence ?? 0,
    branchLabel: session?.branch_label ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAccuracyMeters: session?.location_accuracy_meters ?? null,
    locality: session?.locality ?? null,
    region: session?.region ?? null,
    countryCode: session?.country_code ?? null,
    locationHint: session?.location_hint ?? null,
    locationSource: session?.location_source ?? null,
    extractedPrice: parsedPrice !== null && Number.isFinite(parsedPrice) ? parsedPrice : null,
    rawOcrText: row.raw_ocr_text ?? '',
    capturedAt: row.captured_at,
    syncStatus: 'synced',
    category: group?.category ?? null,
    sizeLabel: group?.size_label ?? null,
    colorLabel: group?.color_label ?? null,
    materialLabel: group?.material_label ?? null,
    notes: group?.notes ?? null,
    isFavorite: group?.is_favorite ?? false,
    catalogStatus: isShoppingFindCatalogStatus(catalogStatus) ? catalogStatus : 'considering',
  };
}

function isShoppingFindCatalogStatus(value: string): value is ShoppingFindCatalogStatus {
  return value === 'considering' || value === 'wishlist' || value === 'closet' || value === 'passed';
}

export function useShoppingSnaps() {
  const { user } = useAuth();

  const account = useShoppingOfflineStore((state) => state.accounts[user?.id ?? ''] ?? emptyShoppingAccount);
  const query = useQuery({
    queryKey: [...SHOPPING_SNAPS_QUERY_KEY, user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<ShoppingSnap[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('shopping_snaps')
        .select(`
          id,image_url,storage_path,store_name,shopping_session_id,capture_group_id,capture_role,capture_sequence,
          latitude,longitude,
          extracted_price,raw_ocr_text,captured_at,
          shopping_capture_groups(
            category,size_label,color_label,material_label,notes,is_favorite,catalog_status,purchase_details
          ),
          shopping_sessions(
            store_location_id,branch_label,location_accuracy_meters,locality,region,country_code,location_hint,location_source
          )
        `)
        .eq('user_id', user.id)
        .order('captured_at', { ascending: false });

      if (error) {
        if (!isSupabaseSchemaMissing(error)) throw error;

        let { data: fallbackData, error: fallbackError } = await supabase
          .from('shopping_snaps')
          .select(`
            id,image_url,storage_path,store_name,shopping_session_id,capture_group_id,capture_role,capture_sequence,
            latitude,longitude,
            extracted_price,raw_ocr_text,captured_at,
            shopping_capture_groups(category,size_label,color_label,material_label,notes,is_favorite,catalog_status),
            shopping_sessions(
              branch_label,location_accuracy_meters,locality,region,country_code,location_source
            )
          `)
          .eq('user_id', user.id)
          .order('captured_at', { ascending: false });
        if (fallbackError && isSupabaseSchemaMissing(fallbackError)) {
          const legacy = await supabase.from('shopping_snaps').select(`
            id,image_url,storage_path,store_name,shopping_session_id,capture_group_id,capture_role,capture_sequence,
            latitude,longitude,extracted_price,raw_ocr_text,captured_at,
            shopping_sessions(branch_label,location_accuracy_meters,locality,region,country_code,location_source)
          `).eq('user_id', user.id).order('captured_at', { ascending: false });
          if (legacy.error) throw legacy.error;
          fallbackData = (legacy.data ?? []).map((row) => ({ ...row, shopping_capture_groups: null })) as unknown as typeof fallbackData;
          fallbackError = null;
        }
        if (fallbackError) throw fallbackError;
        const fallback = ((fallbackData ?? []) as unknown as RemoteShoppingSnapRow[]).map(mapRemoteSnap);
        const cached = await cacheShoppingImages(user.id, fallback);
        useShoppingOfflineStore.getState().cache(user.id, cached);
        return cached;
      }
      const snaps = ((data ?? []) as unknown as RemoteShoppingSnapRow[]).map(mapRemoteSnap);
      const cached = await cacheShoppingImages(user.id, snaps);
      useShoppingOfflineStore.getState().cache(user.id, cached);
      return cached;
    },
  });
  const data = useMemo(() => overlayShoppingOperations((query.data ?? account.snaps).map(resolveShoppingImage), account.operations), [query.data, account]);
  return { ...query, data, isLoading: query.isLoading && data.length === 0 };
}
