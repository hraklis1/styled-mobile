const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
}));

import {
  enqueueStoreFind,
  readStoreFindQueue,
  removeQueuedStoreFind,
  updateQueuedStoreFind,
} from '../storeFindQueue';
import type { StoreFind } from '../../types/storeFind';

const find: StoreFind = {
  id: 'stable-uuid',
  imageUrl: 'file:///find.jpg',
  imageUrls: ['file:///find.jpg'],
  location: null,
  description: null,
  store: null,
  brand: null,
  price: null,
  size: null,
  notes: null,
  syncStatus: 'pending',
  status: 'saved',
  createdAt: '2026-06-19T12:00:00.000Z',
};

describe('storeFindQueue', () => {
  beforeEach(() => mockStorage.clear());

  it('upserts by user and stable find UUID', async () => {
    await enqueueStoreFind({
      userId: '1', boardId: null, targetBoardName: 'Daily Finds', find,
      localImageUris: ['file:///find.jpg'], queuedAt: find.createdAt,
    });
    await enqueueStoreFind({
      userId: '1', boardId: 42, targetBoardName: 'Daily Finds',
      find: { ...find, store: 'Aritzia' }, localImageUris: ['file:///find.jpg'], queuedAt: find.createdAt,
    });

    const entries = await readStoreFindQueue('1');
    expect(entries).toHaveLength(1);
    expect(entries[0].boardId).toBe(42);
    expect(entries[0].find.store).toBe('Aritzia');
  });

  it('keeps different users isolated', async () => {
    await enqueueStoreFind({ userId: '1', boardId: 1, targetBoardName: 'Daily Finds', find, queuedAt: find.createdAt });
    await enqueueStoreFind({ userId: '2', boardId: 2, targetBoardName: 'Daily Finds', find, queuedAt: find.createdAt });
    expect(await readStoreFindQueue('1')).toHaveLength(1);
    expect(await readStoreFindQueue('2')).toHaveLength(1);
  });

  it('retains a failed find until explicit removal', async () => {
    await enqueueStoreFind({ userId: '1', boardId: 1, targetBoardName: 'Daily Finds', find, queuedAt: find.createdAt });
    await updateQueuedStoreFind('1', find.id, {
      find: { ...find, syncStatus: 'failed', syncAttempts: 1, syncError: 'offline' },
    });
    expect((await readStoreFindQueue('1'))[0].find.syncStatus).toBe('failed');
    await removeQueuedStoreFind('1', find.id);
    expect(await readStoreFindQueue('1')).toEqual([]);
  });
});
