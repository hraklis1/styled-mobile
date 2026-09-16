jest.mock('react-native-mmkv', () => {
  const stores = new Map();
  return {
    createMMKV: ({ id }: { id: string }) => {
      if (!stores.has(id)) stores.set(id, new Map());
      const values = stores.get(id);
      return {
        getString: (key: string) => values.get(key),
        set: (key: string, value: string) => values.set(key, value),
        remove: (key: string) => values.delete(key),
      };
    },
  };
});
import {
  remapPendingCatalogOperations,
  overlayShoppingOperations,
  useShoppingOfflineStore,
} from '../../stores/useShoppingOfflineStore';
import {
  setShoppingAccount,
  useShoppingSessionStore,
} from '../../stores/useShoppingSessionStore';
import type { ShoppingSnap } from '../../types/shoppingSnap';
const snap = {
  id: 'photo',
  captureGroupId: 'group',
  notes: 'original',
  isFavorite: false,
} as ShoppingSnap;
it('replays ordered edits over stale remote data without changing other fields', () => {
  expect(
    overlayShoppingOperations(
      [snap],
      [
        {
          id: '1',
          kind: 'catalog',
          groupId: 'group',
          patch: { notes: 'first' },
        },
        {
          id: '2',
          kind: 'catalog',
          groupId: 'group',
          patch: { notes: 'latest', isFavorite: true },
        },
      ],
    )[0],
  ).toMatchObject({ notes: 'latest', isFavorite: true });
  expect(snap.notes).toBe('original');
});
it('persists pending changes across hydration and partitions accounts', async () => {
  const store = useShoppingOfflineStore.getState();
  store.cache('alice', [snap]);
  store.enqueue('alice', {
    id: '1',
    kind: 'catalog',
    groupId: 'group',
    patch: { notes: 'offline' },
  });
  await useShoppingOfflineStore.persist.rehydrate();
  expect(
    useShoppingOfflineStore.getState().accounts.alice.operations,
  ).toHaveLength(1);
  expect(useShoppingOfflineStore.getState().accounts.bob).toBeUndefined();
  store.remove('alice', '1');
  expect(useShoppingOfflineStore.getState().accounts.alice.snaps[0].notes).toBe(
    'offline',
  );
});
it('switches capture queues before another account can use them and restores the original queue', () => {
  setShoppingAccount('alice');
  useShoppingSessionStore.getState().setStoreName('Private store');
  setShoppingAccount('bob');
  expect(useShoppingSessionStore.getState().currentStoreName).toBeNull();
  setShoppingAccount('alice');
  expect(useShoppingSessionStore.getState().currentStoreName).toBe(
    'Private store',
  );
  setShoppingAccount(null);
  expect(useShoppingSessionStore.getState().currentStoreName).toBeNull();
});

it('follows unsynced edits when regrouping replaces their original group', () => {
  const operations = [
    {
      id: 'edit',
      kind: 'catalog' as const,
      groupId: 'old',
      patch: { notes: 'Keep this' },
    },
  ];
  const updates = [
    {
      snapId: 'photo',
      captureGroupId: 'new',
      captureGroupStartedAt: 1,
      captureRole: 'garment' as const,
      captureSequence: 1,
    },
  ];
  expect(
    remapPendingCatalogOperations(
      operations,
      [{ id: 'photo', captureGroupId: 'old' }],
      [],
      updates,
      () => 'unused',
    )[0],
  ).toMatchObject({
    id: 'edit',
    groupId: 'new',
    patch: { notes: 'Keep this' },
  });
  expect(
    remapPendingCatalogOperations(
      operations,
      [],
      [{ ...snap, captureGroupId: 'old' }],
      updates,
      () => 'unused',
    )[0].groupId,
  ).toBe('old');
});

it('retains an optional wardrobe draft through restart without sharing it with another account', async () => {
  useShoppingOfflineStore.getState().wardrobeDraft('alice', 'piece', { fields: { name: 'Cream jacket', price: '120', currency: 'CAD' }, category: 'outerwear' });
  await useShoppingOfflineStore.persist.rehydrate();
  expect(useShoppingOfflineStore.getState().accounts.alice.wardrobeDrafts?.piece.fields.currency).toBe('CAD');
  expect(useShoppingOfflineStore.getState().accounts.bob?.wardrobeDrafts).toBeUndefined();
  useShoppingOfflineStore.getState().wardrobeDraft('alice', 'piece', null);
  expect(useShoppingOfflineStore.getState().accounts.alice.wardrobeDrafts?.piece).toBeUndefined();
});
