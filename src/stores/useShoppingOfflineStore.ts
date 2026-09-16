import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import type {
  ShoppingFindCatalogPatch,
  ShoppingSnap,
} from '../types/shoppingSnap';
import type { ShoppingSnapOrganizationUpdate } from '../lib/shoppingSnapOrganizer';

export type ShoppingOperation = {
  id: string;
  kind: 'catalog' | 'organization';
  groupId?: string;
  patch?: ShoppingFindCatalogPatch;
  base?: ShoppingFindCatalogPatch;
  updates?: (ShoppingSnapOrganizationUpdate & { baseGroupId?: string })[];
  error?: string;
  conflicts?: Record<string, unknown>;
};
export type ShoppingWardrobeDraft = {
  fields: Record<string, string>;
  category: string;
};
type Account = {
  wardrobeDrafts?: Record<string, ShoppingWardrobeDraft>;
  snaps: ShoppingSnap[];
  operations: ShoppingOperation[];
  view: 'pieces' | 'visits';
};
const EMPTY: Account = { snaps: [], operations: [], view: 'pieces' };
export const emptyShoppingAccount = EMPTY;
const mmkv = createMMKV({ id: 'styled.shopping-offline' });
export const useShoppingOfflineStore = create<{
  accounts: Record<string, Account>;
  wardrobeDraft: (
    userId: string,
    groupId: string,
    draft: ShoppingWardrobeDraft | null,
  ) => void;
  cache: (userId: string, snaps: ShoppingSnap[]) => void;
  enqueue: (userId: string, operation: ShoppingOperation) => void;
  update: (
    userId: string,
    id: string,
    patch: Partial<ShoppingOperation>,
  ) => void;
  remove: (userId: string, id: string) => void;
  view: (userId: string, value: Account['view']) => void;
}>()(
  persist(
    (set) => ({
      accounts: {},
      wardrobeDraft: (userId, groupId, draft) =>
        set((state) => {
          const account = state.accounts[userId] ?? EMPTY;
          const drafts = { ...account.wardrobeDrafts };
          if (draft) drafts[groupId] = draft;
          else delete drafts[groupId];
          return {
            accounts: {
              ...state.accounts,
              [userId]: { ...account, wardrobeDrafts: drafts },
            },
          };
        }),
      cache: (userId, snaps) =>
        set((s) => ({
          accounts: {
            ...s.accounts,
            [userId]: { ...(s.accounts[userId] ?? EMPTY), snaps },
          },
        })),
      enqueue: (userId, operation) =>
        set((s) => {
          const a = s.accounts[userId] ?? EMPTY;
          return {
            accounts: {
              ...s.accounts,
              [userId]: { ...a, operations: [...a.operations, operation] },
            },
          };
        }),
      update: (userId, id, patch) =>
        set((s) => {
          const a = s.accounts[userId] ?? EMPTY;
          return {
            accounts: {
              ...s.accounts,
              [userId]: {
                ...a,
                operations: a.operations.map((op) =>
                  op.id === id ? { ...op, ...patch } : op,
                ),
              },
            },
          };
        }),
      remove: (userId, id) =>
        set((s) => {
          const a = s.accounts[userId] ?? EMPTY;
          const op = a.operations.find((o) => o.id === id);
          return {
            accounts: {
              ...s.accounts,
              [userId]: {
                ...a,
                snaps: overlayShoppingOperations(a.snaps, op ? [op] : []),
                operations: a.operations.filter((o) => o.id !== id),
              },
            },
          };
        }),
      view: (userId, view) =>
        set((s) => ({
          accounts: {
            ...s.accounts,
            [userId]: { ...(s.accounts[userId] ?? EMPTY), view },
          },
        })),
    }),
    {
      name: 'shopping-offline-v1',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (key) => mmkv.getString(key) ?? null,
        setItem: (key, value) => mmkv.set(key, value),
        removeItem: (key) => mmkv.remove(key),
      })),
    },
  ),
);

export function overlayShoppingOperations(
  snaps: ShoppingSnap[],
  operations: ShoppingOperation[],
): ShoppingSnap[] {
  return operations.reduce(
    (current, op) =>
      current.map((snap) => {
        if (op.kind === 'catalog')
          return snap.captureGroupId === op.groupId
            ? { ...snap, ...op.patch }
            : snap;
        const update = op.updates?.find((u) => u.snapId === snap.id);
        return update
          ? {
              ...snap,
              captureGroupId: update.captureGroupId,
              captureRole: update.captureRole,
              captureSequence: update.captureSequence,
            }
          : snap;
      }),
    snaps,
  );
}

/** A never-uploaded group may disappear before it exists on the server. Follow
 * its photographs so earlier edits are applied to the final uploaded groups. */
export function remapPendingCatalogOperations(
  operations: ShoppingOperation[],
  pending: { id: string; captureGroupId: string }[],
  synced: ShoppingSnap[],
  updates: ShoppingSnapOrganizationUpdate[],
  nextId: () => string,
): ShoppingOperation[] {
  return operations.flatMap((op) => {
    if (
      op.kind !== 'catalog' ||
      synced.some((snap) => snap.captureGroupId === op.groupId)
    )
      return [op];
    const photos = pending.filter((snap) => snap.captureGroupId === op.groupId);
    if (!photos.length) return [op];
    const targets = [
      ...new Set(
        photos.map(
          (snap) =>
            updates.find((update) => update.snapId === snap.id)
              ?.captureGroupId ?? snap.captureGroupId,
        ),
      ),
    ];
    return targets.map((groupId, index) => ({
      ...op,
      id: index ? nextId() : op.id,
      groupId,
    }));
  });
}
