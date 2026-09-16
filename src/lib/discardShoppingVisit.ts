import { useShoppingSessionStore, type ShoppingVisitPreview } from '../stores/useShoppingSessionStore';
import type { ShoppingSnap } from '../types/shoppingSnap';
import { deleteShoppingSnaps } from './deleteShoppingSnaps';
import { deleteShoppingPreview } from './shoppingPreviews';

/** Read fresh backup status and retain failed remote deletions for retry. */
export async function discardShoppingVisit(
  sessionId: string,
  userId: string | null,
  toSnap: (preview: ShoppingVisitPreview) => ShoppingSnap,
): Promise<void> {
  const previews = useShoppingSessionStore.getState().visitPreviews
    .filter((preview) => preview.shoppingSessionId === sessionId);
  try {
    await deleteShoppingSnaps(previews.map(toSnap), userId);
  } catch (error) {
    previews.filter((preview) => preview.syncStatus === 'synced')
      .forEach((preview) => useShoppingSessionStore.getState().recordVisitPreview(preview));
    throw error;
  }
  previews.forEach((preview) => deleteShoppingPreview(preview.previewUri));
}
