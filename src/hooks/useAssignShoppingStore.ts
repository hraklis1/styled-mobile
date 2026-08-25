import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { queryClient } from '../lib/queryClient';
import { supabase } from '../lib/supabase';
import { SHOPPING_SNAPS_QUERY_KEY } from './useShoppingSnaps';
import { useShoppingSessionStore } from '../stores/useShoppingSessionStore';
import type { ShoppingSnap } from '../types/shoppingSnap';

export type ShoppingStoreAssignmentTarget = {
  /** Every snap the store should be written to. */
  snaps: ShoppingSnap[];
  /** Set so the visit itself carries the store, not just its photos. */
  shoppingSessionId: string | null;
};

/**
 * Naming the store for a visit, from wherever the user noticed it was missing.
 *
 * A store belongs to a trip rather than to one photograph, so every call site
 * passes the whole visit — the shortlist row, the haul screen, and the item
 * lightbox all end up writing the same thing. Local state moves first so the
 * change is visible immediately; only already-synced photos need the network.
 */
export function useAssignShoppingStore() {
  const { user } = useAuth();
  const assignVisitStore = useShoppingSessionStore((state) => state.assignVisitStore);
  const assignCaptureStore = useShoppingSessionStore((state) => state.assignCaptureStore);

  return useCallback(async (target: ShoppingStoreAssignmentTarget, storeName: string) => {
    const ids = target.snaps.map((snap) => snap.id);
    const syncedIds = target.snaps.filter((snap) => snap.syncStatus === 'synced').map((snap) => snap.id);

    assignCaptureStore(ids, storeName);
    if (target.shoppingSessionId) assignVisitStore(target.shoppingSessionId, storeName);

    try {
      if (syncedIds.length > 0) {
        if (!user) throw new Error('You need to be signed in to update synced photos.');
        if (target.shoppingSessionId) {
          const { error: sessionError } = await supabase
            .from('shopping_sessions')
            .update({ store_name: storeName })
            .eq('id', target.shoppingSessionId)
            .eq('user_id', user.id);
          if (sessionError) throw sessionError;
        }
        const { error: snapsError } = await supabase
          .from('shopping_snaps')
          .update({ store_name: storeName })
          .eq('user_id', user.id)
          .in('id', syncedIds);
        if (snapsError) throw snapsError;
        await queryClient.invalidateQueries({ queryKey: SHOPPING_SNAPS_QUERY_KEY });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('Could not add store', error instanceof Error ? error.message : 'Please try again.');
      return false;
    }
  }, [assignCaptureStore, assignVisitStore, user]);
}
