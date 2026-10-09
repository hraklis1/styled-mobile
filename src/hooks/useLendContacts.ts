import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { api } from '../lib/api';
import { localYmd, type ItemLoan, type LendContact, type LendRelationship } from '../lib/lending';
import type { Item } from '../types/item';
import { ITEMS_QUERY_KEY } from './useItems';

export const LEND_CONTACTS_QUERY_KEY = ['lend-contacts'] as const;

export function useLendContacts(enabled = true) {
  return useQuery({
    queryKey: LEND_CONTACTS_QUERY_KEY,
    queryFn: () => api.get<LendContact[]>('/api/lend-contacts').then((r) => (Array.isArray(r.data) ? r.data : [])),
    enabled,
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
      qc.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
    },
    onError: () => Alert.alert('Error', "Couldn't remove that person. Please try again."),
  });
}

// ── Loans ────────────────────────────────────────────────────────────────────

export const LOANS_QUERY_KEY = ['loans'] as const;

/** Every loan, newest first: open ones (returnedAt null) and the history. */
export function useLoans(enabled = true) {
  return useQuery({
    queryKey: LOANS_QUERY_KEY,
    queryFn: () => api.get<ItemLoan[]>('/api/loans').then((r) => (Array.isArray(r.data) ? r.data : [])),
    enabled,
  });
}

function setItemAvailability(qc: ReturnType<typeof useQueryClient>, itemId: number, availability: Item['availability']) {
  qc.setQueryData<Item[]>(ITEMS_QUERY_KEY, (old) =>
    old?.map((i) => (i.id === itemId ? { ...i, availability, availabilityUntil: null } : i)));
}

/** Lend an item, or edit its open loan (who has it, back-by date). */
export function useLendItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...body }: { itemId: number; contactId: number | null; dueBack: string | null }) =>
      api.post<ItemLoan>(`/api/items/${itemId}/lend`, { ...body, today: localYmd() }).then((r) => r.data),
    onMutate: async ({ itemId }) => {
      await qc.cancelQueries({ queryKey: ITEMS_QUERY_KEY });
      const previous = qc.getQueryData<Item[]>(ITEMS_QUERY_KEY);
      setItemAvailability(qc, itemId, 'lent');
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ITEMS_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't mark that as lent. Please try again.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
    },
  });
}

/** Ends the open loan and puts the item back in rotation. */
export function useReturnItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => api.post(`/api/items/${itemId}/return`, { today: localYmd() }),
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: ITEMS_QUERY_KEY });
      await qc.cancelQueries({ queryKey: LOANS_QUERY_KEY });
      const previous = qc.getQueryData<Item[]>(ITEMS_QUERY_KEY);
      const previousLoans = qc.getQueryData<ItemLoan[]>(LOANS_QUERY_KEY);
      setItemAvailability(qc, itemId, 'available');
      const today = localYmd();
      qc.setQueryData<ItemLoan[]>(LOANS_QUERY_KEY, (old) =>
        old?.map((l) => (l.itemId === itemId && !l.returnedAt ? { ...l, returnedAt: today } : l)));
      return { previous, previousLoans };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(ITEMS_QUERY_KEY, ctx.previous);
      if (ctx?.previousLoans) qc.setQueryData(LOANS_QUERY_KEY, ctx.previousLoans);
      Alert.alert('Error', "Couldn't mark that as returned. Please try again.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: LOANS_QUERY_KEY });
    },
  });
}
