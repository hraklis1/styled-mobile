jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  }),
}));
jest.mock('../supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, rpc: jest.fn() },
}));
jest.mock('../analytics', () => ({ track: jest.fn() }));
jest.mock('../queryClient', () => ({
  queryClient: { setQueryData: jest.fn(), invalidateQueries: jest.fn() },
}));
jest.mock('../../stores/useShoppingSessionStore', () => ({
  getShoppingAccount: () => 'alice',
  useShoppingSessionStore: { getState: () => ({ pendingUploads: [] }) },
}));
import { supabase } from '../supabase';
import { syncShoppingMutations } from '../shoppingMutationSync';
import { useShoppingOfflineStore } from '../../stores/useShoppingOfflineStore';
import type { ShoppingSnap } from '../../types/shoppingSnap';
const rpc = supabase.rpc as jest.Mock;
const session = supabase.auth.getSession as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  useShoppingOfflineStore.setState({ accounts: {} });
  session.mockResolvedValue({ data: { session: { user: { id: 'alice' } } } });
  useShoppingOfflineStore
    .getState()
    .cache('alice', [
      {
        id: 'photo',
        captureGroupId: 'piece',
        notes: 'original',
      } as ShoppingSnap,
    ]);
});
function enqueue(id: string, groupId = 'piece') {
  useShoppingOfflineStore
    .getState()
    .enqueue('alice', {
      id,
      kind: 'catalog',
      groupId,
      base: { notes: 'original' },
      patch: { notes: id },
    });
}
it('retains an interrupted mutation and retries using the same operation identity', async () => {
  enqueue('stable-id');
  rpc
    .mockResolvedValueOnce({ error: new Error('offline') })
    .mockResolvedValueOnce({ data: { ok: true } });
  await syncShoppingMutations('alice');
  expect(
    useShoppingOfflineStore.getState().accounts.alice.operations[0].error,
  ).toBeTruthy();
  await syncShoppingMutations('alice');
  expect(rpc.mock.calls.map((call) => call[1].operation_id)).toEqual([
    'stable-id',
    'stable-id',
  ]);
  expect(
    useShoppingOfflineStore.getState().accounts.alice.operations,
  ).toHaveLength(0);
  expect(useShoppingOfflineStore.getState().accounts.alice.snaps[0].notes).toBe(
    'stable-id',
  );
});
it('blocks a conflicted piece while allowing independent pieces to sync', async () => {
  enqueue('first');
  enqueue('later');
  enqueue('independent', 'other-piece');
  rpc
    .mockResolvedValueOnce({ data: { conflicts: { notes: 'another device' } } })
    .mockResolvedValueOnce({ data: { ok: true } });
  await syncShoppingMutations('alice');
  expect(rpc.mock.calls.map((call) => call[1].operation_id)).toEqual([
    'first',
    'independent',
  ]);
  expect(
    useShoppingOfflineStore
      .getState()
      .accounts.alice.operations.map((op) => op.id),
  ).toEqual(['first', 'later']);
});
it('never sends pending changes with another account session', async () => {
  enqueue('private');
  session.mockResolvedValue({ data: { session: { user: { id: 'bob' } } } });
  await syncShoppingMutations('alice');
  expect(rpc).not.toHaveBeenCalled();
  expect(
    useShoppingOfflineStore.getState().accounts.alice.operations,
  ).toHaveLength(1);
});
