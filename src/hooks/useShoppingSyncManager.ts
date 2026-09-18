import { retainShoppingImage } from '../lib/shoppingImageCache';
import { syncShoppingMutations } from '../lib/shoppingMutationSync';
import { purchaseDetails } from '../lib/shoppingCatalog';
import { useShoppingOfflineStore } from '../stores/useShoppingOfflineStore';
import { mergeShoppingSnaps } from '../lib/shoppingGallery';
import { useCallback, useEffect } from 'react';
import { File } from 'expo-file-system';
import * as Network from 'expo-network';

import { useAuth } from '../contexts/AuthContext';
import { SHOPPING_SNAPS_QUERY_KEY } from './useShoppingSnaps';
import { SHOPPING_STORE_LOCATIONS_QUERY_KEY } from './useShoppingStoreLocations';
import { queryClient } from '../lib/queryClient';
import { buildShoppingLocationKey, normalizeStoreName } from '../lib/shoppingLocations';
import { supabase } from '../lib/supabase';
import { describeSyncError, isSupabaseSchemaMissing } from '../lib/supabaseErrors';
import {
  getShoppingAccount,
  useShoppingSessionStore,
  type PendingShoppingUpload,
  type ShoppingSessionContext,
} from '../stores/useShoppingSessionStore';

const SHOPPING_BUCKET = 'shopping-snaps';

let activeSync: Promise<void> | null = null;
let syncAgain = false;

// Failed items wait before another attempt. Without this, a server-side
// rejection (schema drift, a bad row) is retried on every store change - and
// during a visit, GPS ticks rewrite pendingVisitMetadata continuously - which
// hammered Supabase at several requests a second and hung the app.
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 10 * 60_000;
const retryState = new Map<string, { failures: number; nextAttemptAt: number }>();

function shouldSkipUntilRetry(key: string, now: number): boolean {
  const entry = retryState.get(key);
  return entry !== undefined && entry.nextAttemptAt > now;
}

function noteSyncFailure(key: string, now: number): void {
  const failures = (retryState.get(key)?.failures ?? 0) + 1;
  const delay = Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS);
  retryState.set(key, { failures, nextAttemptAt: now + delay });
}

function legacyShoppingSessionPayload<T extends Record<string, unknown>>(payload: T): T {
  const legacyPayload = { ...payload };
  Reflect.deleteProperty(legacyPayload, 'location_hint');
  Reflect.deleteProperty(legacyPayload, 'store_location_id');
  return legacyPayload;
}

function contentTypeFor(file: File): string {
  switch (file.extension.toLowerCase()) {
    case '.heic': return 'image/heic';
    case '.heif': return 'image/heif';
    case '.png': return 'image/png';
    default: return 'image/jpeg';
  }
}

type StoreLocationSyncSource = Pick<
  PendingShoppingUpload,
  | 'storeName' | 'shoppingSessionId' | 'sessionStartedAt' | 'timestamp'
  | 'branchLabel' | 'latitude' | 'longitude' | 'locationAccuracyMeters'
  | 'locality' | 'region' | 'countryCode' | 'locationSource'
>;

async function upsertShoppingStoreLocation(
  userId: string,
  upload: StoreLocationSyncSource,
): Promise<string | null> {
  if (!upload.storeName) return null;

  if (upload.shoppingSessionId) {
    const { data: existingSession, error: existingSessionError } = await supabase
      .from('shopping_sessions')
      .select('store_location_id')
      .eq('id', upload.shoppingSessionId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existingSessionError) {
      if (isSupabaseSchemaMissing(existingSessionError)) return null;
      throw existingSessionError;
    }
    if (existingSession?.store_location_id) return existingSession.store_location_id as string;
  }

  const locationKey = buildShoppingLocationKey(upload);
  const visitedAt = new Date(upload.sessionStartedAt ?? upload.timestamp).toISOString();
  const { data: existingLocation, error: existingLocationError } = await supabase
    .from('shopping_store_locations')
    .select('id,visit_count,last_visited_at')
    .eq('user_id', userId)
    .eq('location_key', locationKey)
    .maybeSingle();
  if (existingLocationError) {
    if (isSupabaseSchemaMissing(existingLocationError)) return null;
    throw existingLocationError;
  }

  if (existingLocation?.id) {
    const nextVisitCount = Math.max(1, Number(existingLocation.visit_count) || 1) + 1;
    const lastVisitedAt = typeof existingLocation.last_visited_at === 'string'
      ? existingLocation.last_visited_at
      : null;
    if (!lastVisitedAt || new Date(lastVisitedAt).getTime() < new Date(visitedAt).getTime()) {
      const { error: updateError } = await supabase
        .from('shopping_store_locations')
        .update({
          store_name: upload.storeName,
          branch_label: upload.branchLabel ?? null,
          latitude: upload.latitude ?? null,
          longitude: upload.longitude ?? null,
          location_accuracy_meters: upload.locationAccuracyMeters ?? null,
          locality: upload.locality ?? null,
          region: upload.region ?? null,
          country_code: upload.countryCode ?? null,
          location_source: upload.locationSource ?? 'unavailable',
          visit_count: nextVisitCount,
          last_visited_at: visitedAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingLocation.id)
        .eq('user_id', userId);
      if (updateError) throw updateError;
    }
    return existingLocation.id as string;
  }

  const { data, error } = await supabase
    .from('shopping_store_locations')
    .insert({
      user_id: userId,
      store_name: upload.storeName,
      normalized_store_name: normalizeStoreName(upload.storeName),
      location_key: locationKey,
      branch_label: upload.branchLabel ?? null,
      latitude: upload.latitude ?? null,
      longitude: upload.longitude ?? null,
      location_accuracy_meters: upload.locationAccuracyMeters ?? null,
      locality: upload.locality ?? null,
      region: upload.region ?? null,
      country_code: upload.countryCode ?? null,
      location_source: upload.locationSource ?? 'unavailable',
      first_visited_at: visitedAt,
      last_visited_at: visitedAt,
      visit_count: 1,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function upsertShoppingSession(
  userId: string,
  upload: PendingShoppingUpload,
  storeLocationId: string | null,
): Promise<boolean> {
  if (!upload.shoppingSessionId) return true;

  const sessionPayload = {
    id: upload.shoppingSessionId,
    user_id: userId,
    store_name: upload.storeName,
    branch_label: upload.branchLabel ?? null,
    latitude: upload.latitude ?? null,
    longitude: upload.longitude ?? null,
    location_accuracy_meters: upload.locationAccuracyMeters ?? null,
    locality: upload.locality ?? null,
    region: upload.region ?? null,
    country_code: upload.countryCode ?? null,
    location_hint: upload.locationHint ?? null,
    location_source: upload.locationSource ?? 'unavailable',
    location_captured_at: upload.locationCapturedAt
      ? new Date(upload.locationCapturedAt).toISOString()
      : null,
    started_at: new Date(upload.sessionStartedAt ?? upload.timestamp).toISOString(),
  };

  const fullSessionPayload = {
    ...sessionPayload,
    store_location_id: storeLocationId,
  };
  const { error: sessionError } = await supabase.from('shopping_sessions').upsert(
    fullSessionPayload,
    { onConflict: 'id' },
  );
  if (!sessionError) return true;
  if (!isSupabaseSchemaMissing(sessionError)) throw sessionError;

  // Before the visit-lifecycle migration, sessions require a store name and
  // do not have location_hint. Keep storeless work local until that schema is
  // available instead of uploading a snap without its visit relationship.
  if (!upload.storeName) return false;

  const { error: fallbackSessionError } = await supabase
    .from('shopping_sessions')
    .upsert(legacyShoppingSessionPayload(fullSessionPayload), { onConflict: 'id' });
  if (fallbackSessionError) throw fallbackSessionError;
  return true;
}

async function uploadShoppingSnap(userId: string, upload: PendingShoppingUpload): Promise<boolean> {
  if (useShoppingSessionStore.getState().deletedCaptureIds.includes(upload.id)) return false;
  const localFile = new File(upload.localFileUri);
  if (!localFile.exists) {
    throw new Error('This photo is missing from this phone. Import it again before removing this saved piece.');
  }
  upload = useShoppingSessionStore.getState().pendingUploads.find((item) => item.id === upload.id) ?? upload;
  const captureGroupId = upload.captureGroupId ?? upload.id;
  const storeLocationId = upload.storeLocationId ?? await upsertShoppingStoreLocation(userId, upload);

  const sessionReady = await upsertShoppingSession(userId, upload, storeLocationId);
  if (!sessionReady) return false;

  const groupPayload = {
    id: captureGroupId,
    user_id: userId,
    shopping_session_id: upload.shoppingSessionId ?? null,
    started_at: new Date(upload.captureGroupStartedAt ?? upload.timestamp).toISOString(),
  };

  const { error: groupError } = await supabase.from('shopping_capture_groups').upsert({
    ...groupPayload,
    purchase_details: purchaseDetails(upload),
    category: upload.category ?? null,
    size_label: upload.sizeLabel ?? null,
    color_label: upload.colorLabel ?? null,
    material_label: upload.materialLabel ?? null,
    notes: upload.notes ?? null,
    is_favorite: upload.isFavorite ?? false,
    catalog_status: upload.catalogStatus ?? 'considering',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (groupError) {
    if (!isSupabaseSchemaMissing(groupError)) throw groupError;
    const { error: fallbackGroupError } = await supabase
      .from('shopping_capture_groups')
      .upsert(groupPayload, { onConflict: 'id' });
    if (fallbackGroupError) throw fallbackGroupError;
  }

  const extension = localFile.extension.toLowerCase().replace('.', '') || 'jpg';
  const storagePath = `${userId}/${upload.id}.${extension}`;
  const fileBytes = await localFile.arrayBuffer();
  if (useShoppingSessionStore.getState().deletedCaptureIds.includes(upload.id)) return false;
  const { error: storageError } = await supabase.storage
    .from(SHOPPING_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType: contentTypeFor(localFile),
      upsert: true,
    });
  if (storageError) throw storageError;

  if (useShoppingSessionStore.getState().deletedCaptureIds.includes(upload.id)) {
    await supabase.storage.from(SHOPPING_BUCKET).remove([storagePath]);
    return false;
  }

  const { data: publicUrlData } = supabase.storage.from(SHOPPING_BUCKET).getPublicUrl(storagePath);
  const { error: rowError } = await supabase.from('shopping_snaps').upsert({
    id: upload.id,
    user_id: userId,
    storage_path: storagePath,
    image_url: publicUrlData.publicUrl,
    store_name: upload.storeName,
    shopping_session_id: upload.shoppingSessionId ?? null,
    capture_group_id: captureGroupId,
    capture_role: upload.captureRole ?? 'unknown',
    capture_sequence: upload.captureSequence ?? 0,
    latitude: upload.latitude,
    longitude: upload.longitude,
    extracted_price: upload.extractedPrice,
    raw_ocr_text: upload.rawOcrText || null,
    captured_at: new Date(upload.timestamp).toISOString(),
  }, { onConflict: 'id' });
  if (rowError) throw rowError;

  if (useShoppingSessionStore.getState().deletedCaptureIds.includes(upload.id)) {
    await supabase.from('shopping_snaps').delete().eq('user_id', userId).eq('id', upload.id);
    await supabase.storage.from(SHOPPING_BUCKET).remove([storagePath]);
    return false;
  }

  if (getShoppingAccount() !== userId) return true;
  const cached = useShoppingOfflineStore.getState().accounts[userId]?.snaps ?? [];
  let displayUri = upload.localFileUri;
  try { displayUri = retainShoppingImage(userId, upload.id, upload.localFileUri); } catch { /* Retain the original when caching fails. */ }
  const saved = mergeShoppingSnaps(cached, [{ ...upload, localFileUri: displayUri }]).map((snap) => snap.id === upload.id ? { ...snap, syncStatus: 'synced' as const, storagePath, remoteImageUri: publicUrlData.publicUrl } : snap);
  useShoppingOfflineStore.getState().cache(userId, saved);
  queryClient.setQueryData([...SHOPPING_SNAPS_QUERY_KEY, userId], saved);
  useShoppingSessionStore.getState().removePendingUpload(upload.id);
  useShoppingSessionStore.getState().updateVisitPreview(upload.id, { syncStatus: 'synced', storagePath, localFileUri: displayUri });
  if (displayUri !== upload.localFileUri) {
    try { if (localFile.exists) localFile.delete(); } catch { /* Retry-safe orphan; the display copy is retained. */ }
  }
  return true;
}

async function syncVisitMetadata(userId: string, visit: ShoppingSessionContext): Promise<boolean> {
  const source: StoreLocationSyncSource = {
    storeName: visit.storeName,
    shoppingSessionId: visit.id,
    sessionStartedAt: visit.startedAt,
    timestamp: visit.lastActivityAt,
    branchLabel: visit.branchLabel,
    latitude: visit.latitude,
    longitude: visit.longitude,
    locationAccuracyMeters: visit.locationAccuracyMeters,
    locality: visit.locality,
    region: visit.region,
    countryCode: visit.countryCode,
    locationSource: visit.locationSource,
  };
  const storeLocationId = visit.storeName
    ? visit.storeLocationId ?? await upsertShoppingStoreLocation(userId, source)
    : null;
  const payload = {
    id: visit.id,
    user_id: userId,
    store_name: visit.storeName,
    store_location_id: storeLocationId,
    branch_label: visit.branchLabel,
    latitude: visit.latitude,
    longitude: visit.longitude,
    location_accuracy_meters: visit.locationAccuracyMeters,
    locality: visit.locality,
    region: visit.region,
    country_code: visit.countryCode,
    location_hint: visit.locationHint,
    location_source: visit.locationSource,
    location_captured_at: visit.locationCapturedAt
      ? new Date(visit.locationCapturedAt).toISOString()
      : null,
    started_at: new Date(visit.startedAt).toISOString(),
    ended_at: visit.endedAt ? new Date(visit.endedAt).toISOString() : null,
  };
  const { error } = await supabase.from('shopping_sessions').upsert(payload, { onConflict: 'id' });
  if (error) {
    if (!isSupabaseSchemaMissing(error)) throw error;
    if (!visit.storeName) return false;

    const { error: fallbackError } = await supabase
      .from('shopping_sessions')
      .upsert(legacyShoppingSessionPayload(payload), { onConflict: 'id' });
    if (fallbackError) throw fallbackError;
  }

  // Narrow photo updates intentionally exclude OCR, role, grouping, and catalog data.
  const { error: snapsError } = await supabase
    .from('shopping_snaps')
    .update({
      store_name: visit.storeName,
      latitude: visit.latitude,
      longitude: visit.longitude,
    })
    .eq('user_id', userId)
    .eq('shopping_session_id', visit.id);
  if (snapsError) throw snapsError;
  if (getShoppingAccount() === userId) useShoppingSessionStore.getState().clearPendingVisitMetadata(visit.id);
  return true;
}

async function syncReadyUploads(userId: string): Promise<void> {
  const metadata = useShoppingSessionStore.getState().pendingVisitMetadata;
  const uploads = useShoppingSessionStore.getState().pendingUploads;
  let syncedAny = false;

  for (const visit of metadata) {
    if (getShoppingAccount() !== userId) return;
    const visitKey = `visit:${visit.id}`;
    if (shouldSkipUntilRetry(visitKey, Date.now())) continue;
    const networkState = await Network.getNetworkStateAsync();
    if (networkState.isConnected !== true || networkState.isInternetReachable !== true) return;
    try {
      const didSync = await syncVisitMetadata(userId, visit);
      syncedAny = didSync || syncedAny;
      retryState.delete(visitKey);
    } catch (error) {
      noteSyncFailure(visitKey, Date.now());
      console.warn(`Shopping visit ${visit.id} metadata is still pending: ${describeSyncError(error)}`);
      break;
    }
  }

  for (const upload of uploads) {
    if (getShoppingAccount() !== userId) return;
    if (useShoppingSessionStore.getState().deletedCaptureIds.includes(upload.id)) continue;
    if (upload.ocrStatus === 'processing') continue;
    const uploadKey = `upload:${upload.id}`;
    if (shouldSkipUntilRetry(uploadKey, Date.now())) continue;
    if (upload.locationStatus === 'resolving') {
      if (Date.now() - upload.timestamp < 15_000) continue;
      useShoppingSessionStore.getState().markPendingUploadLocationUnavailable(upload.id);
      continue;
    }

    const networkState = await Network.getNetworkStateAsync();
    if (networkState.isConnected !== true || networkState.isInternetReachable !== true) break;

    try {
      const didSync = await uploadShoppingSnap(userId, upload);
      syncedAny = didSync || syncedAny;
      retryState.delete(uploadKey);
      // A stale failure message must not outlive the attempt that cleared it.
      if (upload.uploadError && getShoppingAccount() === userId) useShoppingSessionStore.setState((state) => ({ pendingUploads: state.pendingUploads.map((value) => value.id === upload.id ? { ...value, uploadError: undefined } : value) }));
    } catch (error) {
      // Keep the item locally. The backoff expires, or the user taps Retry.
      noteSyncFailure(uploadKey, Date.now());
      if (getShoppingAccount() === userId) useShoppingSessionStore.setState((state) => ({ pendingUploads: state.pendingUploads.map((value) => value.id === upload.id ? { ...value, uploadError: error instanceof Error && error.message.startsWith('This photo is missing') ? error.message : 'Photo backup is paused. Your original is safe on this phone. Retry when connected.' } : value) }));
      console.warn(`Shopping snap ${upload.id} is still pending: ${describeSyncError(error)}`);
    }
  }

  if (getShoppingAccount() === userId) await syncShoppingMutations(userId);
  if (syncedAny) {
    await queryClient.invalidateQueries({ queryKey: SHOPPING_SNAPS_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: SHOPPING_STORE_LOCATIONS_QUERY_KEY });
  }
}

export function requestShoppingSync(
  userId: string,
  options: { retryFailed?: boolean } = {},
): Promise<void> {
  if (options.retryFailed) retryState.clear();
  syncAgain = true;
  if (activeSync) return activeSync;

  activeSync = (async () => {
    do {
      syncAgain = false;
      await syncReadyUploads(userId);
    } while (syncAgain);
  })().finally(() => {
    activeSync = null;
  });

  return activeSync;
}

/** Syncs after reconnects and whenever capture/OCR makes a queue item ready. */
export function useShoppingSyncManager(): void {
  const { user } = useAuth();

  const attemptSync = useCallback(() => {
    if (user) void requestShoppingSync(user.id);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected === true && state.isInternetReachable === true) attemptSync();
    });
    const storeSubscription = useShoppingSessionStore.subscribe((state, previousState) => {
      if (
        state.pendingUploads.some((upload, index) => { const prior = previousState.pendingUploads[index]; return !prior || upload.id !== prior.id || upload.ocrStatus !== prior.ocrStatus || upload.captureGroupId !== prior.captureGroupId || upload.locationStatus !== prior.locationStatus; }) || state.pendingUploads.length !== previousState.pendingUploads.length
        || state.pendingVisitMetadata !== previousState.pendingVisitMetadata
      ) attemptSync();
    });

    const timer = setInterval(attemptSync, 30_000);
    attemptSync();
    return () => {
      clearInterval(timer);
      networkSubscription.remove();
      storeSubscription();
    };
  }, [attemptSync, user]);
}
