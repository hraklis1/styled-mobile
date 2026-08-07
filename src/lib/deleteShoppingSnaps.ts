import { File } from 'expo-file-system';

import { queryClient } from './queryClient';
import { supabase } from './supabase';
import { SHOPPING_SNAPS_QUERY_KEY } from '../hooks/useShoppingSnaps';
import { useShoppingSessionStore } from '../stores/useShoppingSessionStore';
import type { ShoppingSnap } from '../types/shoppingSnap';

const SHOPPING_BUCKET = 'shopping-snaps';

export async function deleteShoppingSnaps(
  snaps: ShoppingSnap[],
  userId: string | null,
): Promise<void> {
  if (snaps.length === 0) return;
  const store = useShoppingSessionStore.getState();
  for (const snap of snaps) store.markCaptureDeleted(snap.id);

  const synced = snaps.filter((snap) => snap.syncStatus === 'synced');
  try {
    if (synced.length > 0) {
      if (!userId) throw new Error('You need to be signed in to delete synced photos.');
      const { error } = await supabase
        .from('shopping_snaps')
        .delete()
        .eq('user_id', userId)
        .in('id', synced.map((snap) => snap.id));
      if (error) throw error;

      const paths = synced.map((snap) => snap.storagePath).filter((path): path is string => Boolean(path));
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from(SHOPPING_BUCKET).remove(paths);
        if (storageError) console.warn('Shopping photo rows deleted; some storage objects remain', storageError);
      }
      await queryClient.invalidateQueries({ queryKey: SHOPPING_SNAPS_QUERY_KEY });
    }

    for (const snap of snaps.filter((item) => item.syncStatus === 'pending')) {
      try {
        const file = new File(snap.imageUri);
        if (file.exists) file.delete();
      } catch {
        // Queue deletion is authoritative; orphan cleanup handles a failed file removal.
      }
    }
  } catch (error) {
    // Keep the tombstone on failure so a queued upload cannot recreate the row.
    throw error;
  }
}
