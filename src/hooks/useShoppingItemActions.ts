import { useCallback, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { useGlobalAIStylist } from '../contexts/GlobalAIStylistContext';
import { track } from '../lib/analytics';
import { deleteShoppingSnaps } from '../lib/deleteShoppingSnaps';
import { queryClient } from '../lib/queryClient';
import { buildShopStylistLaunch } from '../lib/shopDecisionWorkspace';
import { mergeShoppingSnaps, type ShoppingEditItem } from '../lib/shoppingGallery';
import type { ShoppingSnapOrganizationUpdate } from '../lib/shoppingSnapOrganizer';
import { supabase } from '../lib/supabase';
import { useShoppingSessionStore } from '../stores/useShoppingSessionStore';
import type { ShoppingFindCatalogPatch, ShoppingSnap } from '../types/shoppingSnap';
import { SHOPPING_SNAPS_QUERY_KEY, useShoppingSnaps } from './useShoppingSnaps';

function catalogPatchPayload(patch: ShoppingFindCatalogPatch) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(patch, 'category')) payload.category = patch.category ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, 'sizeLabel')) payload.size_label = patch.sizeLabel ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, 'colorLabel')) payload.color_label = patch.colorLabel ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, 'materialLabel')) payload.material_label = patch.materialLabel ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, 'notes')) payload.notes = patch.notes ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, 'isFavorite')) payload.is_favorite = patch.isFavorite ?? false;
  if (Object.prototype.hasOwnProperty.call(patch, 'catalogStatus')) payload.catalog_status = patch.catalogStatus ?? 'considering';
  return payload;
}

function applyCatalogPatchToSnap(snap: ShoppingSnap, patch: ShoppingFindCatalogPatch): ShoppingSnap {
  return {
    ...snap,
    category: Object.prototype.hasOwnProperty.call(patch, 'category') ? patch.category ?? null : snap.category,
    sizeLabel: Object.prototype.hasOwnProperty.call(patch, 'sizeLabel') ? patch.sizeLabel ?? null : snap.sizeLabel,
    colorLabel: Object.prototype.hasOwnProperty.call(patch, 'colorLabel') ? patch.colorLabel ?? null : snap.colorLabel,
    materialLabel: Object.prototype.hasOwnProperty.call(patch, 'materialLabel') ? patch.materialLabel ?? null : snap.materialLabel,
    notes: Object.prototype.hasOwnProperty.call(patch, 'notes') ? patch.notes ?? null : snap.notes,
    isFavorite: Object.prototype.hasOwnProperty.call(patch, 'isFavorite') ? patch.isFavorite ?? false : snap.isFavorite,
    catalogStatus: Object.prototype.hasOwnProperty.call(patch, 'catalogStatus') ? patch.catalogStatus ?? 'considering' : snap.catalogStatus,
  };
}

/**
 * Shopping-find mutations (catalog, organize, delete, ask-stylist) live here
 * so any surface — the Shortlist list, the haul gallery, the item lightbox —
 * can act on a find without re-deriving Supabase/query-cache wiring or
 * depending on another screen's local state.
 */
export function useShoppingItemActions() {
  const { user } = useAuth();
  const { openStylist } = useGlobalAIStylist();
  const { data: remoteSnaps = [] } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  const regroupPendingUploads = useShoppingSessionStore((state) => state.regroupPendingUploads);
  const updatePendingGroupCatalog = useShoppingSessionStore((state) => state.updatePendingGroupCatalog);

  const allSnaps = useMemo(() => mergeShoppingSnaps(remoteSnaps, pendingUploads), [remoteSnaps, pendingUploads]);

  const [isSavingCatalog, setIsSavingCatalog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);

  const saveCatalog = useCallback(async (captureGroupId: string, patch: ShoppingFindCatalogPatch) => {
    const groupSnaps = allSnaps.filter((snap) => snap.captureGroupId === captureGroupId);
    if (groupSnaps.length === 0) return;
    const syncedSnaps = groupSnaps.filter((snap) => snap.syncStatus === 'synced');
    const pendingSnaps = groupSnaps.filter((snap) => snap.syncStatus === 'pending');

    setIsSavingCatalog(true);
    try {
      if (syncedSnaps.length > 0) {
        if (!user) throw new Error('You need to be signed in to save catalog details.');
        const firstSnap = [...syncedSnaps].sort((a, b) => (
          a.captureSequence - b.captureSequence
          || new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
        ))[0];
        const { error } = await supabase
          .from('shopping_capture_groups')
          .upsert({
            id: captureGroupId,
            user_id: user.id,
            shopping_session_id: firstSnap.shoppingSessionId ?? null,
            started_at: new Date(firstSnap.capturedAt).toISOString(),
            ...catalogPatchPayload(patch),
          }, { onConflict: 'id' });
        if (error) throw error;
      }

      if (pendingSnaps.length > 0) {
        updatePendingGroupCatalog(captureGroupId, patch);
      }

      if (syncedSnaps.length > 0 && user) {
        queryClient.setQueryData<ShoppingSnap[]>(
          [...SHOPPING_SNAPS_QUERY_KEY, user.id],
          (current) => current?.map((snap) => snap.captureGroupId === captureGroupId
            ? applyCatalogPatchToSnap(snap, patch)
            : snap),
        );
        await queryClient.invalidateQueries({ queryKey: SHOPPING_SNAPS_QUERY_KEY });
      }
    } finally {
      setIsSavingCatalog(false);
    }
  }, [allSnaps, updatePendingGroupCatalog, user]);

  const deleteItem = useCallback(async (item: ShoppingEditItem) => {
    setIsDeleting(true);
    try {
      await deleteShoppingSnaps(item.snaps, user?.id ?? null);
    } finally {
      setIsDeleting(false);
    }
  }, [user?.id]);

  const saveOrganization = useCallback(async (updates: ShoppingSnapOrganizationUpdate[]) => {
    if (updates.length === 0) return;
    const snapById = new Map(allSnaps.map((snap) => [snap.id, snap]));
    const syncedUpdates = updates.filter((update) => snapById.get(update.snapId)?.syncStatus === 'synced');
    const pendingUpdates = updates.filter((update) => snapById.get(update.snapId)?.syncStatus === 'pending');

    setIsSavingOrganization(true);
    try {
      if (syncedUpdates.length > 0) {
        if (!user) throw new Error('You need to be signed in to organize synced photos.');
        const groupPayloads = [...new Map(syncedUpdates.map((update) => {
          const snap = snapById.get(update.snapId);
          return [update.captureGroupId, {
            id: update.captureGroupId,
            user_id: user.id,
            shopping_session_id: snap?.shoppingSessionId ?? null,
            started_at: new Date(update.captureGroupStartedAt).toISOString(),
          }];
        })).values()];
        const { error: groupError } = await supabase
          .from('shopping_capture_groups')
          .upsert(groupPayloads, { onConflict: 'id' });
        if (groupError) throw groupError;

        for (const update of syncedUpdates) {
          const { error: rowError } = await supabase
            .from('shopping_snaps')
            .update({
              capture_group_id: update.captureGroupId,
              capture_role: update.captureRole,
              capture_sequence: update.captureSequence,
            })
            .eq('user_id', user.id)
            .eq('id', update.snapId);
          if (rowError) throw rowError;
        }
      }

      if (pendingUpdates.length > 0) {
        regroupPendingUploads(pendingUpdates);
      }
      if (syncedUpdates.length > 0) {
        await queryClient.invalidateQueries({ queryKey: SHOPPING_SNAPS_QUERY_KEY });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsSavingOrganization(false);
    }
  }, [allSnaps, regroupPendingUploads, user]);

  const askStylistAboutItem = useCallback((item: ShoppingEditItem) => {
    track('shopping_find_stylist_opened', { status: item.catalogStatus, has_price: item.extractedPrice !== null });
    openStylist({
      ...buildShopStylistLaunch('Should I buy this? Consider how it fits my wardrobe, whether I own anything similar, and how versatile it would be.'),
      initialAttachmentUri: item.primarySnap.imageUri,
      context: {
        kind: 'shopping_find',
        captureGroupId: item.captureGroupId,
        storeName: item.storeName,
        price: item.extractedPrice,
        category: item.category,
        color: item.colorLabel,
        material: item.materialLabel,
        notes: item.notes,
      },
    });
  }, [openStylist]);

  return {
    saveCatalog,
    isSavingCatalog,
    deleteItem,
    isDeleting,
    saveOrganization,
    isSavingOrganization,
    askStylistAboutItem,
  };
}
