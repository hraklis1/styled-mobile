import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProductOffers } from '../useProductOffers';
import { api } from '../../lib/api';
jest.mock('../../lib/api', () => ({ api: { post: jest.fn() } }));
jest.mock('../../lib/analytics', () => ({ track: jest.fn() }));
let result: ReturnType<typeof useProductOffers>;
function Harness({ enabled = true }: { enabled?: boolean }) {
  const query = useProductOffers({ reference: 'reference', surface: 'guide' }, enabled);
  const { isError, data } = query;
  React.useEffect(() => { result = query; }, [query, isError, data]);
  return null;
}
let renderer: TestRenderer.ReactTestRenderer;
let client: QueryClient;
async function flush() { await act(async () => { await jest.advanceTimersByTimeAsync(20); }); }
beforeEach(() => { jest.useFakeTimers(); client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } }); (api.post as jest.Mock).mockReset(); });
afterEach(() => { act(() => renderer?.unmount()); client.clear(); jest.useRealTimers(); });
async function render(enabled = true) { await act(async () => { renderer = TestRenderer.create(<QueryClientProvider client={client}><Harness enabled={enabled} /></QueryClientProvider>); }); await flush(); }
const state = (key: string, status: string) => ({ key, status, offers: [], retrievedAt: '2026-10-01T12:00:00Z', expiresAt: new Date(Date.now() + 60000).toISOString() });
test('settled empty results never poll', async () => {
  (api.post as jest.Mock).mockResolvedValue({ data: { targets: [state('a', 'empty')] } });
  await render();
  expect(result!.data?.a.status).toBe('empty');
  await act(async () => { await jest.advanceTimersByTimeAsync(20000); });
  expect(api.post).toHaveBeenCalledTimes(1);
});
test('only pending targets poll, preserving already settled targets', async () => {
  (api.post as jest.Mock).mockResolvedValueOnce({ data: { targets: [state('a', 'ready'), state('b', 'pending')] } }).mockResolvedValue({ data: { targets: [state('b', 'empty')] } });
  await render();
  await act(async () => { await jest.advanceTimersByTimeAsync(4100); });
  await flush();
  expect(api.post).toHaveBeenLastCalledWith('/api/shop/offers', { reference: 'reference', targetKeys: ['b'] }, expect.objectContaining({ signal: expect.anything() }));
  expect(result!.data?.a.status).toBe('ready'); expect(result!.data?.b.status).toBe('empty');
  await act(async () => { await jest.advanceTimersByTimeAsync(20000); });
  expect(api.post).toHaveBeenCalledTimes(2);
});
test('closing a progressive surface stops pending polling', async () => {
  (api.post as jest.Mock).mockResolvedValue({ data: { targets: [state('a', 'pending')] } });
  await render();
  await act(async () => { renderer.update(<QueryClientProvider client={client}><Harness enabled={false} /></QueryClientProvider>); });
  await act(async () => { await jest.advanceTimersByTimeAsync(20000); });
  expect(api.post).toHaveBeenCalledTimes(1);
});
test('manual failure retains cached content and exposes a retryable error', async () => {
  (api.post as jest.Mock).mockResolvedValueOnce({ data: { targets: [state('a', 'ready')] } }).mockRejectedValueOnce(new Error('offline'));
  await render();
  await act(async () => { await result!.refetch(); }); await flush();
  expect(result!.data?.a.status).toBe('ready'); expect(result!.isError).toBe(true);
});
