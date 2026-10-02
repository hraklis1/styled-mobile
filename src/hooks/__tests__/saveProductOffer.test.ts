import { saveProductOffer, unsaveProductEntry } from '../useWishlist';
import { queryClient, clearUserQueryCache } from '../../lib/queryClient';
import { api } from '../../lib/api';
import type { ProductOffer } from '../../types/commerce';
jest.mock('../../lib/api', () => ({ api: { post: jest.fn(), delete: jest.fn() } }));
jest.mock('../../lib/shoppingFeedback', () => ({ shoppingFeedbackQueue: { clear: jest.fn() } }));
const offer = { id: 'serper:1', provider: 'serper' } as ProductOffer;
const context = { reference: 'ref', targetKey: 'shirt', surface: 'guide' };
const entry = { id: 'product_stable', outfit: { product: { offer } } };
afterEach(() => { queryClient.clear(); jest.clearAllMocks(); });
test('duplicate taps share a save and cache the server-assigned identity once', async () => {
  let resolve!: (value: unknown) => void;
  (api.post as jest.Mock).mockImplementation(() => new Promise((r) => { resolve = r; }));
  const first = saveProductOffer(offer, context), second = saveProductOffer(offer, context);
  expect(api.post).toHaveBeenCalledTimes(1);
  resolve({ data: entry });
  expect(await first).toEqual(entry); await second;
  expect(queryClient.getQueryData(['wishlist'])).toEqual([entry]);
});
test('a failed save is retryable and does not alter the wishlist', async () => {
  (api.post as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: entry });
  await expect(saveProductOffer(offer, context)).rejects.toThrow('offline');
  expect(queryClient.getQueryData(['wishlist'])).toBeUndefined();
  expect(await saveProductOffer(offer, context)).toEqual(entry);
});
test('a completed save from a previous account never repopulates the cleared cache', async () => {
  let resolve!: (value: unknown) => void;
  (api.post as jest.Mock).mockImplementation(() => new Promise((r) => { resolve = r; }));
  const save = saveProductOffer(offer, context);
  await clearUserQueryCache();
  resolve({ data: entry }); await save;
  expect(queryClient.getQueryData(['wishlist'])).toBeUndefined();
});

test('unsave removes only its entry after confirmation and preserves cache on failure', async () => {
  queryClient.setQueryData(['wishlist'], [entry, { ...entry, id: 'other' }]);
  (api.delete as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
  await expect(unsaveProductEntry(entry.id)).rejects.toThrow('offline');
  expect(queryClient.getQueryData(['wishlist'])).toHaveLength(2);
  await unsaveProductEntry(entry.id);
  expect(api.delete).toHaveBeenCalledWith('/api/wishlist/product_stable');
  expect(queryClient.getQueryData(['wishlist'])).toEqual([{ ...entry, id: 'other' }]);
});
