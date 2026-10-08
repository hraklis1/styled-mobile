import type { useQueryClient } from '@tanstack/react-query';
import { applySavedItems, createItemsBatch, type BatchCreateItemInput } from '../hooks/useItems';
import { withRetries } from '../features/batch-import/retryPolicy';
import type { Item } from '../types/item';

export type CommitResult = {
  items: Item[];
  /** clientImportIds that became items. */
  savedIds: Set<string>;
  /** clientImportId → why it wasn't added: rejected by the server, or silently missing. */
  failures: Map<string, string>;
};

/**
 * The create step every add-to-closet path shares — the closet scan, batch
 * import and the outfit log's new pieces. One idempotent request (keyed on
 * each input's clientImportId, which callers own and must keep stable),
 * retried under the batch retry policy, then merged into the items cache.
 *
 * Throws GaveUp when the retries stop, as `withRetries` does. Polish is left
 * to the caller: when it may be queued differs by flow.
 */
export async function commitItems(
  inputs: BatchCreateItemInput[],
  queryClient?: ReturnType<typeof useQueryClient>,
): Promise<CommitResult> {
  if (!inputs.length) return { items: [], savedIds: new Set(), failures: new Map() };
  const result = await withRetries(() => createItemsBatch(inputs));
  // Applied whatever the caller does next: the rows exist either way.
  if (queryClient) applySavedItems(queryClient, result.items);
  const savedIds = new Set(result.items.flatMap((item) => (item.clientImportId ? [item.clientImportId] : [])));
  const failures = new Map<string, string>();
  for (const rejected of result.rejected) {
    if (rejected.clientImportId) failures.set(rejected.clientImportId, rejected.message);
  }
  for (const input of inputs) {
    if (!savedIds.has(input.clientImportId) && !failures.has(input.clientImportId)) {
      failures.set(input.clientImportId, "Couldn't add this piece.");
    }
  }
  return { items: result.items, savedIds, failures };
}
