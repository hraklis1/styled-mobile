import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from './api';
import { queryClient } from './queryClient';
import { loadLocalWishlist, type WishlistEntry } from './wishlist';
import { WISHLIST_QUERY_KEY } from '../hooks/useWishlist';

const MIGRATED_FLAG = 'styled_wishlist_migrated';

/**
 * One-time migration of the on-device wishlist (AsyncStorage) to the server.
 * Runs once per signed-in session until it fully succeeds. Idempotent: entries
 * are pushed by their preserved string id, so re-running never duplicates. The
 * migrated flag is only set when every entry synced, so a partial failure
 * retries on the next launch. The local copy is left intact as a backup.
 */
export async function syncLocalWishlistToServer(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(MIGRATED_FLAG)) return;

    const local = await loadLocalWishlist();
    if (local.length === 0) {
      await AsyncStorage.setItem(MIGRATED_FLAG, '1');
      return;
    }

    const server = await api.get<WishlistEntry[]>('/api/wishlist').then((r) => r.data);
    const serverIds = new Set(server.map((e) => e.id));

    let allSynced = true;
    for (const entry of local) {
      if (serverIds.has(entry.id)) continue;
      try {
        await api.post('/api/wishlist', {
          id: entry.id,
          outfit: entry.outfit,
          eventContext: entry.eventContext ?? null,
        });
      } catch {
        allSynced = false; // leave the flag unset so we retry next launch
      }
    }

    queryClient.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });
    if (allSynced) await AsyncStorage.setItem(MIGRATED_FLAG, '1');
  } catch {
    // Non-fatal — the migration will retry on the next launch.
  }
}
