import {
  getShoppingAccount,
  useShoppingSessionStore,
} from '../stores/useShoppingSessionStore';
import { supabase } from './supabase';
import { catalogPayload } from './shoppingCatalog';
import { useShoppingOfflineStore } from '../stores/useShoppingOfflineStore';
import { track } from './analytics';
import { queryClient } from './queryClient';

const active = new Map<string, Promise<void>>();
export function syncShoppingMutations(userId: string): Promise<void> {
  const running = active.get(userId);
  if (running) return running;
  const task = (async () => {
    const state = useShoppingOfflineStore.getState();
    const blocked = new Set<string>();
    for (const op of state.accounts[userId]?.operations ?? []) {
      const { data: auth } = await supabase.auth.getSession();
      if (auth.session?.user.id !== userId) break;
      const groups =
        op.kind === 'catalog'
          ? [op.groupId!]
          : (op.updates ?? []).flatMap((u) => [
              u.captureGroupId,
              u.baseGroupId ?? u.captureGroupId,
            ]);
      if (op.conflicts || groups.some((g) => blocked.has(g))) {
        groups.forEach((g) => blocked.add(g));
        continue;
      }
      const pending =
        getShoppingAccount() === userId
          ? useShoppingSessionStore.getState().pendingUploads
          : [];
      if (
        pending.some(
          (upload) =>
            groups.includes(upload.captureGroupId) ||
            op.updates?.some((update) => update.snapId === upload.id),
        )
      ) {
        groups.forEach((g) => blocked.add(g));
        continue;
      }
      const { data, error } = await supabase.rpc('apply_shopping_mutation', {
        operation_id: op.id,
        operation:
          op.kind === 'catalog'
            ? {
                kind: op.kind,
                groupId: op.groupId,
                patch: catalogPayload(op.patch ?? {}),
                base: catalogPayload(op.base ?? {}),
              }
            : { kind: op.kind, updates: op.updates },
      });
      if (error || data?.conflicts) {
        state.update(userId, op.id, {
          error: error
            ? (error as { code?: string }).code === 'PGRST202'
              ? "Changes are saved on this phone. Backup isn't available yet."
              : 'Changes are saved on this phone. Tap Retry to back them up.'
            : 'This piece changed on another device.',
          conflicts: data?.conflicts,
        });
        groups.forEach((g) => blocked.add(g));
        track('shopping_sync_failed', {
          kind: op.kind,
          conflict: Boolean(data?.conflicts),
        });
        if (error) break;
      } else {
        state.remove(userId, op.id);
        // Query observers must use the acknowledged local snapshot until refetch completes.
        queryClient.setQueryData(
          ['shopping-snaps', userId],
          useShoppingOfflineStore.getState().accounts[userId].snaps,
        );
      }
    }
    await queryClient.invalidateQueries({
      queryKey: ['shopping-snaps', userId],
    });
  })().finally(() => active.delete(userId));
  active.set(userId, task);
  return task;
}
