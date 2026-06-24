import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { isSupabaseSchemaMissing } from '../lib/supabaseErrors';
import { supabase } from '../lib/supabase';
import type { RemoteShoppingSnapRow, ShoppingSnap } from '../types/shoppingSnap';

export const SHOPPING_SNAPS_QUERY_KEY = ['shopping-snaps'] as const;

function mapRemoteSnap(row: RemoteShoppingSnapRow): ShoppingSnap {
  const parsedPrice = row.extracted_price === null ? null : Number(row.extracted_price);
  const session = Array.isArray(row.shopping_sessions)
    ? row.shopping_sessions[0] ?? null
    : row.shopping_sessions;

  return {
    id: row.id,
    imageUri: row.image_url,
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
    locationSource: session?.location_source ?? null,
    extractedPrice: parsedPrice !== null && Number.isFinite(parsedPrice) ? parsedPrice : null,
    rawOcrText: row.raw_ocr_text ?? '',
    capturedAt: row.captured_at,
    syncStatus: 'synced',
  };
}

function mapRemoteSnapWithoutStoreLocation(row: Omit<RemoteShoppingSnapRow, 'shopping_sessions'> & {
  shopping_sessions: Omit<Exclude<RemoteShoppingSnapRow['shopping_sessions'], null>, 'store_location_id'> | null;
}): ShoppingSnap {
  return mapRemoteSnap({
    ...row,
    shopping_sessions: Array.isArray(row.shopping_sessions)
      ? row.shopping_sessions.map((session) => ({ ...session, store_location_id: null }))
      : row.shopping_sessions
        ? { ...row.shopping_sessions, store_location_id: null }
        : null,
  } as RemoteShoppingSnapRow);
}

export function useShoppingSnaps() {
  const { user } = useAuth();

  return useQuery({
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
          shopping_sessions(
            store_location_id,branch_label,location_accuracy_meters,locality,region,country_code,location_source
          )
        `)
        .eq('user_id', user.id)
        .order('captured_at', { ascending: false });

      if (error) {
        if (!isSupabaseSchemaMissing(error)) throw error;

        const { data: fallbackData, error: fallbackError } = await supabase
          .from('shopping_snaps')
          .select(`
            id,image_url,storage_path,store_name,shopping_session_id,capture_group_id,capture_role,capture_sequence,
            latitude,longitude,
            extracted_price,raw_ocr_text,captured_at,
            shopping_sessions(
              branch_label,location_accuracy_meters,locality,region,country_code,location_source
            )
          `)
          .eq('user_id', user.id)
          .order('captured_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        return ((fallbackData ?? []) as unknown as Parameters<typeof mapRemoteSnapWithoutStoreLocation>[0][])
          .map(mapRemoteSnapWithoutStoreLocation);
      }
      return ((data ?? []) as unknown as RemoteShoppingSnapRow[]).map(mapRemoteSnap);
    },
  });
}
