import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';

import { supabase } from '../lib/supabase';
import { isSupabaseSchemaMissing } from '../lib/supabaseErrors';
import type { ShoppingLocationLike } from '../lib/shoppingLocations';

export const SHOPPING_STORE_LOCATIONS_QUERY_KEY = ['shopping-store-locations'] as const;

type RemoteShoppingStoreLocationRow = {
  id: string;
  store_name: string;
  branch_label: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy_meters: number | null;
  locality: string | null;
  region: string | null;
  country_code: string | null;
  location_source: string | null;
};

export type ShoppingStoreLocation = ShoppingLocationLike & {
  id: string;
  locationAccuracyMeters: number | null;
};

function mapRemoteStoreLocation(row: RemoteShoppingStoreLocationRow): ShoppingStoreLocation {
  return {
    id: row.id,
    storeName: row.store_name,
    branchLabel: row.branch_label,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAccuracyMeters: row.location_accuracy_meters,
    locality: row.locality,
    region: row.region,
    countryCode: row.country_code,
    locationSource: row.location_source,
  };
}

export function useShoppingStoreLocations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...SHOPPING_STORE_LOCATIONS_QUERY_KEY, user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<ShoppingStoreLocation[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('shopping_store_locations')
        .select(`
          id,store_name,branch_label,latitude,longitude,location_accuracy_meters,
          locality,region,country_code,location_source
        `)
        .eq('user_id', user.id)
        .order('last_visited_at', { ascending: false })
        .limit(50);

      if (error) {
        if (isSupabaseSchemaMissing(error)) return [];
        throw error;
      }
      return ((data ?? []) as unknown as RemoteShoppingStoreLocationRow[]).map(mapRemoteStoreLocation);
    },
  });
}
