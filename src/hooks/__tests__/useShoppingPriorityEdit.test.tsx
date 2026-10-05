import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { shoppingPriorityEditQueryKey, useShoppingPriorityEdit } from '../useShoppingPriorityEdit';
import type { ShoppingBriefPriority } from '../../lib/shopDecisionWorkspace';
jest.mock('../../lib/api', () => ({ api: { post: jest.fn() } }));
jest.mock('../useProductOffers', () => ({ useCommerceActive: (enabled: boolean) => enabled, useProductOffers: () => ({ data: undefined, refetch: jest.fn() }) }));
jest.mock('../useShoppingBrief', () => ({ SHOPPING_BRIEF_QUERY_KEY: ['shop', 'brief'] }));
const priority: ShoppingBriefPriority = { label: 'Leather shoes', category: 'shoes', context: 'With tailoring', priority: 1, reason: 'wardrobe_gap', unlocks: [] };
const response = { status: 'no_buy', headline: 'Covered', summary: 'Your wardrobe covers this need.', generatedAt: '2026-10-05T12:00:00Z', priority, targets: [], noBuyReason: 'Already covered' };
let result: ReturnType<typeof useShoppingPriorityEdit>;
let renderer: TestRenderer.ReactTestRenderer;
let client: QueryClient;
function Harness({ purpose, enabled = true }: { purpose: 'preview' | 'guide'; enabled?: boolean }) {
  const query = useShoppingPriorityEdit(priority, { purpose, enabled, origin: 'shopping_brief' });
  React.useEffect(() => { result = query; }, [query]);
  return null;
}
async function render(purpose: 'preview' | 'guide', enabled = true) {
  await act(async () => { renderer = TestRenderer.create(<QueryClientProvider client={client}><Harness purpose={purpose} enabled={enabled} /></QueryClientProvider>); });
  await act(async () => { await jest.advanceTimersByTimeAsync(20); });
}
beforeEach(() => {
  jest.useFakeTimers();
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  (api.post as jest.Mock).mockReset().mockResolvedValue({ data: response });
});
afterEach(() => { act(() => renderer?.unmount()); client.clear(); jest.useRealTimers(); });
test('a cached preview never suppresses the deliberate guide request', async () => {
  await render('preview');
  expect(api.post).toHaveBeenLastCalledWith('/api/shop/brief/priority-edit', expect.objectContaining({ purpose: 'preview' }), expect.objectContaining({ signal: expect.anything() }));
  await act(async () => renderer.update(<QueryClientProvider client={client}><Harness purpose="guide" /></QueryClientProvider>));
  await act(async () => { await jest.advanceTimersByTimeAsync(20); });
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenLastCalledWith('/api/shop/brief/priority-edit', expect.objectContaining({ purpose: 'guide' }), expect.anything());
  await act(async () => renderer.update(<QueryClientProvider client={client}><Harness purpose="preview" /></QueryClientProvider>));
  expect(api.post).toHaveBeenCalledTimes(2);
});
test('inactive previews do not generate a recommendation', async () => {
  await render('preview', false);
  expect(api.post).not.toHaveBeenCalled();
});
test('no-buy reconciliation updates the brief without overwriting the priority-edit cache', async () => {
  const updatedBrief = { status: 'balanced', headline: 'Well covered', summary: 'Nothing to add.', source: 'rules', generatedAt: response.generatedAt, priorities: [], localDate: '2026-10-05' };
  (api.post as jest.Mock).mockResolvedValue({ data: { ...response, briefUpdated: true, updatedBrief } });
  await render('preview');
  expect(client.getQueryData(['shop', 'brief', updatedBrief.localDate])).toEqual(updatedBrief);
  expect(client.getQueryData(shoppingPriorityEditQueryKey(priority, { purpose: 'preview', origin: 'shopping_brief' }))).toMatchObject({ status: 'no_buy', targets: [] });
  expect(result!.data?.status).toBe('no_buy');
});
