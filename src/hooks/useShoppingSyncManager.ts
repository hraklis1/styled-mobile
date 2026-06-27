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
  useShoppingSessionStore,
  type PendingShoppingUpload,
} from '../stores/useShoppingSessionStore';

const SHOPPING_BUCKET = 'shopping-snaps';

let activeSync: Promise<void> | null = null;
let syncAgain = false;

function contentTypeFor(file: File): string {
  switch (file.extension.toLowerCase()) {
    case '.heic': return 'image/heic';
    case '.heif': return 'image/heif';
    case '.png': return 'image/png';
    default: return 'image/jpeg';
  }
}

async function upsertShoppingStoreLocation(
  userId: string,
  upload: PendingShoppingUpload,
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
): Promise<void> {
  if (!upload.shoppingSessionId || !upload.storeName) return;

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
    location_source: upload.locationSource ?? 'unavailable',
    location_captured_at: upload.locationCapturedAt
      ? new Date(upload.locationCapturedAt).toISOString()
      : null,
    started_at: new Date(upload.sessionStartedAt ?? upload.timestamp).toISOString(),
  };

  const { error: sessionError } = await supabase.from('shopping_sessions').upsert({
    ...sessionPayload,
    store_location_id: storeLocationId,
  }, { onConflict: 'id' });
  if (!sessionError) return;
  if (!isSupabaseSchemaMissing(sessionError)) throw sessionError;

  const { error: fallbackSessionError } = await supabase
    .from('shopping_sessions')
    .upsert(sessionPayload, { onConflict: 'id' });
  if (fallbackSessionError) throw fallbackSessionError;
}

async function uploadShoppingSnap(userId: string, upload: PendingShoppingUpload): Promise<void> {
  const localFile = new File(upload.localFileUri);
  if (!localFile.exists) {
    // A persisted queue record can outlive its sandbox file after reinstalling
    // a development build. There is nothing left to upload, so retire the
    // orphan instead of retrying and surfacing the same warning forever.
    useShoppingSessionStore.getState().removePendingUpload(upload.id);
    return;
  }
  const captureGroupId = upload.captureGroupId ?? upload.id;
  const storeLocationId = upload.storeLocationId ?? await upsertShoppingStoreLocation(userId, upload);

  await upsertShoppingSession(userId, upload, storeLocationId);

  const groupPayload = {
    id: captureGroupId,
    user_id: userId,
    shopping_session_id: upload.shoppingSessionId ?? null,
    started_at: new Date(upload.captureGroupStartedAt ?? upload.timestamp).toISOString(),
  };

  const { error: groupError } = await supabase.from('shopping_capture_groups').upsert({
    ...groupPayload,
    category: upload.category ?? null,
    size_label: upload.sizeLabel ?? null,
    color_label: upload.colorLabel ?? null,
    material_label: upload.materialLabel ?? null,
    notes: upload.notes ?? null,
    is_favorite: upload.isFavorite ?? false,
    catalog_status: upload.catalogStatus ?? 'considering',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
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
  const { error: storageError } = await supabase.storage
    .from(SHOPPING_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType: contentTypeFor(localFile),
      upsert: true,
    });
  if (storageError) throw storageError;

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

  // The database is durable at this point. Remove the queue record first so a
  // process interruption cannot leave an undeclared local-only photo.
  useShoppingSessionStore.getState().removePendingUpload(upload.id);
  try {
    localFile.delete();
  } catch (fileError) {
    console.warn('Synced shopping photo could not be removed locally', fileError);
  }
}

async function syncReadyUploads(userId: string): Promise<void> {
  const uploads = useShoppingSessionStore.getState().pendingUploads;
  let syncedAny = false;

  for (const upload of uploads) {
    if (upload.ocrStatus === 'processing') continue;
    if (upload.locationStatus === 'resolving') {
      if (Date.now() - upload.timestamp < 15_000) continue;
      useShoppingSessionStore.getState().markPendingUploadLocationUnavailable(upload.id);
      continue;
    }

    const networkState = await Network.getNetworkStateAsync();
    if (networkState.isConnected !== true || networkState.isInternetReachable !== true) break;

    try {
      await uploadShoppingSnap(userId, upload);
      syncedAny = true;
    } catch (error) {
      // Keep the item locally. A later connectivity/store change retries it.
      console.warn(`Shopping snap ${upload.id} is still pending: ${describeSyncError(error)}`);
    }
  }

  if (syncedAny) {
    await queryClient.invalidateQueries({ queryKey: SHOPPING_SNAPS_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: SHOPPING_STORE_LOCATIONS_QUERY_KEY });
  }
}

export function requestShoppingSync(userId: string): Promise<void> {
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
      if (state.pendingUploads !== previousState.pendingUploads) attemptSync();
    });

    attemptSync();
    return () => {
      networkSubscription.remove();
      storeSubscription();
    };
  }, [attemptSync, user]);
}
