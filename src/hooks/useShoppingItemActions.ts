import { useCallback, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { useGlobalAIStylist } from '../contexts/GlobalAIStylistContext';
import { track } from '../lib/analytics';
import { deleteShoppingSnaps } from '../lib/deleteShoppingSnaps';
import { buildShopStylistLaunch } from '../lib/shopDecisionWorkspace';
import { mergeShoppingSnaps, type ShoppingEditItem } from '../lib/shoppingGallery';
import type { ShoppingSnapOrganizationUpdate } from '../lib/shoppingSnapOrganizer';
import * as Crypto from 'expo-crypto';
import { overlayShoppingOperations, remapPendingCatalogOperations, useShoppingOfflineStore } from '../stores/useShoppingOfflineStore';
import { syncShoppingMutations } from '../lib/shoppingMutationSync';
import { validateShoppingPatch } from '../lib/shoppingCatalog';
import { useShoppingSessionStore } from '../stores/useShoppingSessionStore';
import type { ShoppingFindCatalogPatch } from '../types/shoppingSnap';
import { useShoppingSnaps } from './useShoppingSnaps';

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

  const saveCatalog = useCallback(async (captureGroupId: string, patch: ShoppingFindCatalogPatch, expectedBase?: ShoppingFindCatalogPatch) => {
    if (!user) throw new Error('Sign in to save this piece.');
    const account = useShoppingOfflineStore.getState().accounts[user.id];
    const current = overlayShoppingOperations(mergeShoppingSnaps(account?.snaps ?? allSnaps, useShoppingSessionStore.getState().pendingUploads), account?.operations ?? []);
    const snap = current.find((s) => s.captureGroupId === captureGroupId);
    if (snap?.catalogStatus === 'wishlist') patch = { catalogStatus: 'considering', isFavorite: true, ...patch };
    validateShoppingPatch(patch);
    if (!snap) throw new Error('This piece is no longer available.');
    setIsSavingCatalog(true);
    try {
      const base = Object.fromEntries(Object.keys(patch).map((key) => [key, (expectedBase ?? snap)[key as keyof typeof patch] ?? null]));
      useShoppingOfflineStore.getState().enqueue(user.id, { id: Crypto.randomUUID(), kind: 'catalog', groupId: captureGroupId, patch, base });
      updatePendingGroupCatalog(captureGroupId, patch);
      track('shopping_details_saved', { decision_changed: Boolean(patch.catalogStatus), favorite_changed: patch.isFavorite !== undefined });
      void syncShoppingMutations(user.id).catch(() => undefined);
    } finally { setIsSavingCatalog(false); }
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
    if (!updates.length) return;
    if (!user) throw new Error('Sign in to organize your pieces.');
    setIsSavingOrganization(true);
    try {
      const account = useShoppingOfflineStore.getState().accounts[user.id];
      const current = overlayShoppingOperations(mergeShoppingSnaps(account?.snaps ?? allSnaps, useShoppingSessionStore.getState().pendingUploads), account?.operations ?? []);
      const pending = useShoppingSessionStore.getState().pendingUploads;
      const pendingIds = new Set(pending.map((upload) => upload.id));
      const changedPendingIds = new Set(updates.filter((update) => pendingIds.has(update.snapId)).map((update) => update.snapId));
      const previous = (account?.operations ?? []).flatMap((operation) => {
        if (operation.kind !== 'organization') return [operation];
        const remaining = operation.updates?.filter((update) => !changedPendingIds.has(update.snapId)) ?? [];
        return remaining.length ? [{ ...operation, updates: remaining }] : [];
      });
      const operations = remapPendingCatalogOperations(previous, pending, account?.snaps ?? [], updates, Crypto.randomUUID);
      const pendingGroups = new Set(pending.map((upload) => upload.captureGroupId));
      const deferredIds = new Set(previous.filter((operation) => operation.kind === 'catalog' && pendingGroups.has(operation.groupId!) && !account?.snaps.some((snap) => snap.captureGroupId === operation.groupId)).map((operation) => operation.id));
      const originalIds = new Set(previous.map((operation) => operation.id));
      const deferred = operations.filter((operation) => deferredIds.has(operation.id) || !originalIds.has(operation.id));
      const deferredSet = new Set(deferred.map((operation) => operation.id));
      const rows = updates.map((update) => ({ ...update, baseGroupId: pendingIds.has(update.snapId) ? undefined : current.find((snap) => snap.id === update.snapId)?.captureGroupId }));
      // Membership creates any new destination before its deferred catalog edits.
      useShoppingOfflineStore.setState((state) => ({ accounts: { ...state.accounts, [user.id]: {
        ...(state.accounts[user.id] ?? { snaps: [], view: 'pieces' as const }),
        operations: [...operations.filter((operation) => !deferredSet.has(operation.id)), { id: Crypto.randomUUID(), kind: 'organization' as const, updates: rows }, ...deferred],
      } } }));
      regroupPendingUploads(updates);
      track('shopping_grouping_corrected', { photo_count: updates.length });
      void syncShoppingMutations(user.id).catch(() => undefined);
    } finally { setIsSavingOrganization(false); }
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
        currencyCode: item.currencyCode ?? null,
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
