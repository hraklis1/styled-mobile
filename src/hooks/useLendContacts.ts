import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { api } from '../lib/api';
import { localYmd, type ItemLoan, type LendContact, type LendRelationship } from '../lib/lending';
import type { Item, OpenLoanSummary } from '../types/item';
import { ITEMS_QUERY_KEY } from './useItems';

export const LEND_CONTACTS_QUERY_KEY = ['lend-contacts'] as const;

// People and loans change only through this app's own mutations, which
// update or invalidate the caches; no need to refetch on every mount.
const LENDING_STALE_MS = 5 * 60_000;

export function useLendContacts(enabled = true) {
  return useQuery({
    queryKey: LEND_CONTACTS_QUERY_KEY,
    queryFn: () => api.get<LendContact[]>('/api/lend-contacts').then((r) => (Array.isArray(r.data) ? r.data : [])),
    enabled,
    staleTime: LENDING_STALE_MS,
  });
}

/** Create-or-return by name (case-insensitive) — the server never duplicates a person. */
export function useCreateLendContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; relationship: LendRelationship }) =>
      api.post<LendContact>('/api/lend-contacts', input).then((r) => r.data),
    onSuccess: (contact) => {
      qc.setQueryData<LendContact[]>(LEND_CONTACTS_QUERY_KEY, (old = []) =>
        old.some((c) => c.id === contact.id) ? old : [...old, contact].sort((a, b) => a.name.localeCompare(b.name)));
    },
    onError: () => Alert.alert('Error', "Couldn't save that person. Please try again."),
  });
}

export function useUpdateLendContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number; name?: string; relationship?: LendRelationship }) =>
      api.patch<LendContact>(`/api/lend-contacts/${id}`, patch).then((r) => r.data),
    onSuccess: (contact) => {
      qc.setQueryData<LendContact[]>(LEND_CONTACTS_QUERY_KEY, (old = []) => old.map((c) => (c.id === contact.id ? contact : c)));
      // Items and loans carry the person's name.
      qc.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
    },
    onError: () => Alert.alert('Error', "Couldn't update that person. The name may already be in use."),
  });
}

export function useDeleteLendContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/lend-contacts/${id}`),
    onSuccess: (_res, id) => {
      qc.setQueryData<LendContact[]>(LEND_CONTACTS_QUERY_KEY, (old = []) => old.filter((c) => c.id !== id));
      // Their loans stay, just without a name (FK is ON DELETE SET NULL).
      qc.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
    },
    onError: () => Alert.alert('Error', "Couldn't remove that person. Please try again."),
  });
}

// ── Loans ────────────────────────────────────────────────────────────────────

/** Prefix of every loan query; each filter gets its own key beneath it. */
export const LOANS_QUERY_KEY = ['loans'] as const;

export type LoansFilter = { itemId?: number; contactId?: number; status?: 'open' | 'returned' };

/**
 * Loans newest first. Pass a filter to fetch only what a screen draws: one
 * item's history, or the returned loans. What is out right now is on each
 * item (`item.openLoan`), so most screens never need this.
 */
export function useLoans(filter: LoansFilter = {}, enabled = true) {
  return useQuery({
    queryKey: [...LOANS_QUERY_KEY, filter],
    queryFn: () => api.get<ItemLoan[]>('/api/loans', { params: filter }).then((r) => (Array.isArray(r.data) ? r.data : [])),
    enabled,
    staleTime: LENDING_STALE_MS,
  });
}

type Snapshot = { items: Item[] | undefined; loans: [QueryKey, ItemLoan[] | undefined][] };

/** Stops in-flight fetches and keeps the current caches for a rollback. */
async function snapshot(qc: QueryClient): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: ITEMS_QUERY_KEY });
  await qc.cancelQueries({ queryKey: LOANS_QUERY_KEY });
  return { items: qc.getQueryData<Item[]>(ITEMS_QUERY_KEY), loans: qc.getQueriesData<ItemLoan[]>({ queryKey: LOANS_QUERY_KEY }) };
}

function restore(qc: QueryClient, snap: Snapshot | undefined) {
  if (!snap) return;
  if (snap.items) qc.setQueryData(ITEMS_QUERY_KEY, snap.items);
  for (const [key, data] of snap.loans) qc.setQueryData(key, data);
}

function settle(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
  qc.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
}

function patchItems(qc: QueryClient, itemIds: Iterable<number>, patch: (item: Item) => Partial<Item>) {
  const ids = new Set(itemIds);
  qc.setQueryData<Item[]>(ITEMS_QUERY_KEY, (old) =>
    old?.map((i) => (ids.has(i.id) ? { ...i, ...patch(i) } : i)));
}

/**
 * Lend one or more items to one person in one request, or edit an open loan
 * (who has it, back-by date). Items already out move to this person and keep
 * their lent date.
 */
export function useLendItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { itemIds: number[]; contactId: number | null; dueBack: string | null }) =>
      api.post<ItemLoan[]>('/api/loans', { ...body, today: localYmd() }).then((r) => r.data),
    onMutate: async ({ itemIds, contactId, dueBack }) => {
      const snap = await snapshot(qc);
      const contact = contactId == null ? null
        : qc.getQueryData<LendContact[]>(LEND_CONTACTS_QUERY_KEY)?.find((c) => c.id === contactId) ?? null;
      patchItems(qc, itemIds, (item) => {
        const openLoan: OpenLoanSummary = {
          id: item.openLoan?.id ?? -1,
          contactId,
          contactName: contact?.name ?? null,
          contactRelationship: contact?.relationship ?? null,
          lentAt: item.openLoan?.lentAt ?? localYmd(),
          dueBack,
        };
        return { availability: 'lent', availabilityUntil: null, openLoan };
      });
      return snap;
    },
    onError: (_err, { itemIds }, snap) => {
      restore(qc, snap);
      Alert.alert('Error', `Couldn't mark ${itemIds.length === 1 ? 'that' : 'those'} as lent. Please try again.`);
    },
    onSettled: () => settle(qc),
  });
}

/**
 * Ends the open loans of one or more items and puts them back in rotation,
 * in one request. Pair with useReopenLoans for undo.
 */
export function useReturnItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: number[]) =>
      api.post<{ returned: number[] }>('/api/loans/return', { itemIds, today: localYmd() }).then((r) => r.data),
    onMutate: async (itemIds) => {
      const snap = await snapshot(qc);
      const ids = new Set(itemIds);
      const today = localYmd();
      patchItems(qc, itemIds, () => ({ availability: 'available', availabilityUntil: null, openLoan: null }));
      qc.setQueriesData<ItemLoan[]>({ queryKey: LOANS_QUERY_KEY }, (old) =>
        old?.map((l) => (ids.has(l.itemId) && !l.returnedAt ? { ...l, returnedAt: today } : l)));
      return snap;
    },
    onError: (_err, itemIds, snap) => {
      restore(qc, snap);
      Alert.alert('Error', `Couldn't mark ${itemIds.length === 1 ? 'that' : 'those'} as returned. Please try again.`);
    },
    onSettled: () => settle(qc),
  });
}

/** Undo a return made today: the same loans reopen, dates and person intact. */
export function useReopenLoans() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: number[]) =>
      api.post<{ reopened: number[]; conflicts: number[] }>('/api/loans/reopen', { itemIds, today: localYmd() }).then((r) => r.data),
    onMutate: async (itemIds) => {
      const snap = await snapshot(qc);
      // The item's openLoan comes back with the refetch; until then 'lent' is enough to draw it as out.
      patchItems(qc, itemIds, () => ({ availability: 'lent', availabilityUntil: null }));
      // The latest loan of each item (every list is newest first) is the one coming back.
      qc.setQueriesData<ItemLoan[]>({ queryKey: LOANS_QUERY_KEY }, (old) => {
        const seen = new Set<number>();
        return old?.map((l) => {
          if (!itemIds.includes(l.itemId) || seen.has(l.itemId)) return l;
          seen.add(l.itemId);
          return { ...l, returnedAt: null };
        });
      });
      return snap;
    },
    onError: (_err, _ids, snap) => {
      restore(qc, snap);
      Alert.alert("Couldn't undo", 'It may have been lent again already.');
    },
    onSettled: () => settle(qc),
  });
}
