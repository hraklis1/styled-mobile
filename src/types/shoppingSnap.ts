export type ShoppingSnapSyncStatus = 'pending' | 'synced';
export type ShoppingCaptureRole = 'garment' | 'tag' | 'unknown';

export type ShoppingSnap = {
  id: string;
  imageUri: string;
  storagePath: string | null;
  storeName: string | null;
  storeLocationId: string | null;
  shoppingSessionId: string | null;
  captureGroupId: string;
  captureRole: ShoppingCaptureRole;
  captureSequence: number;
  branchLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyMeters: number | null;
  locality: string | null;
  region: string | null;
  countryCode: string | null;
  locationSource: string | null;
  extractedPrice: number | null;
  rawOcrText: string;
  capturedAt: string;
  syncStatus: ShoppingSnapSyncStatus;
};

export type RemoteShoppingSnapRow = {
  id: string;
  image_url: string;
  storage_path: string | null;
  store_name: string | null;
  shopping_session_id: string | null;
  capture_group_id: string | null;
  capture_role: ShoppingCaptureRole | null;
  capture_sequence: number | null;
  latitude: number | null;
  longitude: number | null;
  extracted_price: number | string | null;
  raw_ocr_text: string | null;
  captured_at: string;
  shopping_sessions: {
    store_location_id: string | null;
    branch_label: string | null;
    location_accuracy_meters: number | null;
    locality: string | null;
    region: string | null;
    country_code: string | null;
    location_source: string | null;
  } | {
    store_location_id: string | null;
    branch_label: string | null;
    location_accuracy_meters: number | null;
    locality: string | null;
    region: string | null;
    country_code: string | null;
    location_source: string | null;
  }[] | null;
};
