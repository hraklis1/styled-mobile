export type StoreFind = {
  id: string; // Stable UUID minted on-device for idempotent sync
  imageUrl: string | null;
  imageUrls?: string[]; // multi-photo array; imageUrl mirrors imageUrls[0] for backward compat
  location: string | null;
  locationData?: {
    latitude: number;
    longitude: number;
    label: string | null;
    address: string | null;
    placeId?: string | null;
  } | null;
  description: string | null;
  store: string | null;
  brand: string | null;
  price: number | null;
  currency?: string | null;
  size: string | null;
  notes: string | null;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  status?: 'saved' | 'purchased' | 'archived';
  syncError?: string | null;
  syncAttempts?: number;
  lastSyncAttemptAt?: string | null;
  createdAt: string;
};
