jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn(), remove: jest.fn() }),
}));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => jest.fn()) }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../lib/queryClient', () => ({ queryClient: { invalidateQueries: jest.fn() } }));
jest.mock('../../../hooks/useProfile', () => ({ PROFILE_QUERY_KEY: ['profile'] }));
jest.mock('../../../hooks/useItems', () => ({ requestPolish: jest.fn(), applyPolishedItem: jest.fn() }));

import { applyPolishedItem, requestPolish } from '../../../hooks/useItems';
import { enqueuePolish, startPolishRunner } from '../runner';
import { resetInFlight, usePolishQueueStore, type PolishJob } from '../store';

const polish = requestPolish as jest.Mock;
const httpError = (status: number, data: Record<string, unknown> = {}) => ({
  isAxiosError: true,
  response: { status, data, headers: {} },
});
async function drain(rounds = 50) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}
const statuses = () => usePolishQueueStore.getState().jobs.map((j) => j.status);

let stop: () => void;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  usePolishQueueStore.getState().reset();
  stop = startPolishRunner();
});
afterEach(() => {
  stop();
  jest.useRealTimers();
});

it('polishes queued items with keys derived from the import id, two at a time', async () => {
  polish.mockImplementation(async (id: number) => ({ item: { id } }));
  enqueuePolish('u1', [{ id: 1, clientImportId: 'a' }, { id: 2, clientImportId: 'b' }, { id: 3, clientImportId: 'c' }]);
  expect(polish).toHaveBeenCalledTimes(2);
  expect(polish).toHaveBeenCalledWith(1, 'polish-import:a');
  await drain();
  expect(polish).toHaveBeenCalledTimes(3);
  expect(statuses()).toEqual(['done', 'done', 'done']);
  expect(applyPolishedItem).toHaveBeenCalledTimes(3);
});

it('ignores an item that is already queued', () => {
  polish.mockImplementation(async (id: number) => ({ item: { id } }));
  enqueuePolish('u1', [{ id: 1, clientImportId: 'a' }]);
  enqueuePolish('u1', [{ id: 1, clientImportId: 'a' }]);
  expect(usePolishQueueStore.getState().jobs).toHaveLength(1);
});

it('blocks the rest of the queue when credits run out, and resumes on unblock', async () => {
  polish.mockReset();
  polish.mockRejectedValueOnce(httpError(402, { code: 'INSUFFICIENT_CREDITS' })).mockImplementation(async (id: number) => ({ item: { id } }));
  usePolishQueueStore.getState().enqueue('u1', [1, 2, 3].map((id) => ({ itemId: id, idempotencyKey: `k${id}` })));
  await drain();
  expect(usePolishQueueStore.getState().blocked).toBe('credits');
  // The one already running finishes; the one still waiting is held.
  expect(statuses()).toEqual(['blocked', 'done', 'blocked']);
  polish.mockClear();
  usePolishQueueStore.getState().unblock();
  expect(polish).toHaveBeenCalledWith(1, 'k1');
});

it('backs off and retries with the same key on a transient failure', async () => {
  polish.mockRejectedValueOnce(httpError(503)).mockResolvedValue({ item: { id: 1 } });
  enqueuePolish('u1', [{ id: 1, clientImportId: 'a' }]);
  await drain();
  expect(statuses()).toEqual(['pending']);
  jest.advanceTimersByTime(20_000);
  await drain();
  expect(polish).toHaveBeenLastCalledWith(1, 'polish-import:a');
  expect(statuses()).toEqual(['done']);
});

it('a new account starts with an empty queue', () => {
  polish.mockImplementation(async (id: number) => ({ item: { id } }));
  enqueuePolish('u1', [{ id: 1 }]);
  enqueuePolish('u2', [{ id: 2 }]);
  expect(usePolishQueueStore.getState().jobs.map((j) => j.itemId)).toEqual([2]);
});

it('puts in-flight jobs back in the queue on resume', () => {
  const job: PolishJob = { itemId: 1, idempotencyKey: 'k', status: 'running', attempts: 0, notBefore: 5, error: null, createdAt: 0 };
  expect(resetInFlight([job])[0]).toMatchObject({ status: 'pending', notBefore: 0, idempotencyKey: 'k' });
});
