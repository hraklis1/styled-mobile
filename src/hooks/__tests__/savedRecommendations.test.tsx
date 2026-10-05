import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import { api } from '../../lib/api';
import { addOutfitToWishlist, useRemoveFromWishlist } from '../useWishlist';
import type { ShopOutfit } from '../../types/shop';

jest.mock('../../lib/api', () => ({ api: { post: jest.fn(), delete: jest.fn() } }));
jest.mock('../../lib/shoppingFeedback', () => ({ shoppingFeedbackQueue: { clear: jest.fn() } }));
let removal: ReturnType<typeof useRemoveFromWishlist>;
function Observer() { const mutation = useRemoveFromWishlist(); React.useEffect(() => { removal = mutation; }, [mutation]); return null; }
let renderer: TestRenderer.ReactTestRenderer;
const defaults = queryClient.getDefaultOptions();
beforeEach(() => queryClient.setDefaultOptions({ ...defaults, mutations: { ...defaults.mutations, gcTime: Infinity } }));
afterEach(() => { act(() => renderer?.unmount()); queryClient.clear(); queryClient.setDefaultOptions(defaults); jest.clearAllMocks(); });

it('saves without Board membership and refreshes Board feeds after successful removal', async () => {
  (api.post as jest.Mock).mockResolvedValue({});
  (api.delete as jest.Mock).mockResolvedValue({});
  queryClient.setQueryData(['boards'], [{ id: 1, wishlistIds: [] }]);
  const entry = await addOutfitToWishlist({ recommendationType: 'piece', items: [], intro: 'A jacket' } as unknown as ShopOutfit);
  expect(queryClient.getQueryData(['wishlist'])).toEqual([entry]);
  expect(queryClient.getQueryData(['boards'])).toEqual([{ id: 1, wishlistIds: [] }]);
  act(() => { renderer = TestRenderer.create(<QueryClientProvider client={queryClient}><Observer /></QueryClientProvider>); });
  await act(async () => { await removal.mutateAsync(entry.id); });
  expect(queryClient.getQueryData(['wishlist'])).toEqual([]);
  expect(queryClient.getQueryState(['boards'])?.isInvalidated).toBe(true);
});

it('restores the saved entry when removal fails', async () => {
  (api.post as jest.Mock).mockResolvedValue({});
  (api.delete as jest.Mock).mockRejectedValue(new Error('offline'));
  const entry = await addOutfitToWishlist({ recommendationType: 'list', items: [], intro: 'Guide' } as unknown as ShopOutfit);
  act(() => { renderer = TestRenderer.create(<QueryClientProvider client={queryClient}><Observer /></QueryClientProvider>); });
  await act(async () => { await expect(removal.mutateAsync(entry.id)).rejects.toThrow('offline'); });
  expect(queryClient.getQueryData(['wishlist'])).toEqual([entry]);
});
