jest.mock('../../lib/api', () => ({ api: { post: jest.fn() }, isNetworkError: jest.fn() }));
jest.mock('../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../useOutfits', () => ({ OUTFITS_QUERY_KEY: ['outfits'] }));
jest.mock('../useShoppingBrief', () => ({ invalidateShoppingBriefQueries: jest.fn() }));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '../../lib/api';
import { LOANS_QUERY_KEY, useReopenLoans, useReturnItems } from '../useLendContacts';
import { ITEMS_QUERY_KEY } from '../useItems';
import type { ItemLoan } from '../../lib/lending';
import type { Item } from '../../types/item';

const mockPost = jest.mocked(api.post);

const loan = (id: number, itemId: number, returnedAt: string | null): ItemLoan => ({
  id, itemId, contactId: 1, lentAt: '2026-10-01', dueBack: null, returnedAt, itemName: 'Coat',
  imageUrl: null, thumbUrl: null, cutoutUrl: null, polishedUrl: null, coverImageVariant: 'original',
});

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach((fn) => act(fn)); });

function setup() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } } });
  // Keep invalidations from refetching (no query functions are registered).
  jest.spyOn(qc, 'invalidateQueries').mockResolvedValue();
  qc.setQueryData<Item[]>(ITEMS_QUERY_KEY, [
    { id: 1, name: 'Coat', availability: 'lent' } as Item,
    { id: 2, name: 'Scarf', availability: 'lent' } as Item,
  ]);
  qc.setQueryData<ItemLoan[]>(LOANS_QUERY_KEY, [loan(11, 1, null), loan(12, 2, null), loan(5, 1, '2026-09-01')]);
  const hooks: { ret?: ReturnType<typeof useReturnItems>; reopen?: ReturnType<typeof useReopenLoans> } = {};
  function Probe() {
    hooks.ret = useReturnItems();
    hooks.reopen = useReopenLoans();
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<QueryClientProvider client={qc}><Probe /></QueryClientProvider>);
  });
  cleanups.push(() => { renderer.unmount(); qc.clear(); });
  return { qc, hooks };
}

describe('return / undo hooks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns several items in one request and updates the cache optimistically', async () => {
    let resolve!: (v: unknown) => void;
    mockPost.mockReturnValue(new Promise((r) => { resolve = r; }) as never);
    const { qc, hooks } = setup();

    act(() => { hooks.ret!.mutate([1, 2]); });
    await act(async () => {});

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/api/loans/return', expect.objectContaining({ itemIds: [1, 2] }));
    expect(qc.getQueryData<Item[]>(ITEMS_QUERY_KEY)!.map((i) => i.availability)).toEqual(['available', 'available']);
    const loans = qc.getQueryData<ItemLoan[]>(LOANS_QUERY_KEY)!;
    expect(loans.find((l) => l.id === 11)!.returnedAt).not.toBeNull();
    expect(loans.find((l) => l.id === 5)!.returnedAt).toBe('2026-09-01');
    await act(async () => { resolve({ data: { returned: [1, 2] } }); });
  });

  it('undo reopens only the latest loan of each item', async () => {
    let resolve!: (v: unknown) => void;
    mockPost.mockReturnValue(new Promise((r) => { resolve = r; }) as never);
    const { qc, hooks } = setup();
    qc.setQueryData<ItemLoan[]>(LOANS_QUERY_KEY, [loan(11, 1, '2026-10-13'), loan(5, 1, '2026-09-01')]);

    act(() => { hooks.reopen!.mutate([1]); });
    await act(async () => {});

    expect(mockPost).toHaveBeenCalledWith('/api/loans/reopen', expect.objectContaining({ itemIds: [1] }));
    const loans = qc.getQueryData<ItemLoan[]>(LOANS_QUERY_KEY)!;
    expect(loans.find((l) => l.id === 11)!.returnedAt).toBeNull();
    expect(loans.find((l) => l.id === 5)!.returnedAt).toBe('2026-09-01');
    expect(qc.getQueryData<Item[]>(ITEMS_QUERY_KEY)![0].availability).toBe('lent');
    await act(async () => { resolve({ data: { reopened: [1], conflicts: [] } }); });
  });

  it('rolls back a failed undo', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockPost.mockRejectedValue(new Error('409'));
    const { qc, hooks } = setup();
    qc.setQueryData<Item[]>(ITEMS_QUERY_KEY, [{ id: 1, name: 'Coat', availability: 'available' } as Item]);
    qc.setQueryData<ItemLoan[]>(LOANS_QUERY_KEY, [loan(11, 1, '2026-10-13')]);

    await act(async () => { hooks.reopen!.mutate([1]); });

    expect(qc.getQueryData<Item[]>(ITEMS_QUERY_KEY)![0].availability).toBe('available');
    expect(qc.getQueryData<ItemLoan[]>(LOANS_QUERY_KEY)![0].returnedAt).toBe('2026-10-13');
    expect(alert).toHaveBeenCalled();
  });
});
