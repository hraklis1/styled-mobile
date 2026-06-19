import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoreFind } from '../types/storeFind';

const QUEUE_KEY = '@styled/store_find_queue_v2';
const LEGACY_QUEUE_KEY = '@styled/store_find_queue';

export type StoreFindQueueEntry = {
  userId: string;
  boardId: number | null;
  targetBoardName: string;
  find: StoreFind;
  localImageUris?: string[];
  queuedAt: string;
};

async function readAll(): Promise<StoreFindQueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as StoreFindQueueEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(queue: StoreFindQueueEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function readStoreFindQueue(userId?: string): Promise<StoreFindQueueEntry[]> {
  const queue = await readAll();
  return userId ? queue.filter((entry) => entry.userId === userId) : queue;
}

export async function enqueueStoreFind(entry: StoreFindQueueEntry): Promise<void> {
  const queue = await readAll();
  const index = queue.findIndex((queued) => queued.userId === entry.userId && queued.find.id === entry.find.id);
  if (index >= 0) queue[index] = entry;
  else queue.push(entry);
  await writeAll(queue);
}

export async function updateQueuedStoreFind(
  userId: string,
  findId: string,
  update: Partial<StoreFindQueueEntry> & { find?: StoreFind },
): Promise<void> {
  const queue = await readAll();
  const index = queue.findIndex((entry) => entry.userId === userId && entry.find.id === findId);
  if (index < 0) return;
  queue[index] = { ...queue[index], ...update };
  await writeAll(queue);
}

export async function removeQueuedStoreFind(userId: string, findId: string): Promise<void> {
  const queue = await readAll();
  await writeAll(queue.filter((entry) => !(entry.userId === userId && entry.find.id === findId)));
}

export async function removeLegacyStoreFindQueue(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_QUEUE_KEY).catch(() => undefined);
}

export async function migrateLegacyStoreFindQueue(userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_QUEUE_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw) as Array<{ boardId: number; find: StoreFind; queuedAt: string }>;
    for (const entry of legacy) {
      await enqueueStoreFind({
        userId,
        boardId: entry.boardId,
        targetBoardName: 'Daily Finds',
        find: { ...entry.find, syncStatus: entry.find.syncStatus ?? 'pending' },
        localImageUris: (entry.find.imageUrls ?? []).filter((uri) => uri.startsWith('file://')),
        queuedAt: entry.queuedAt,
      });
    }
    await removeLegacyStoreFindQueue();
  } catch {
    // Keep malformed legacy data intact rather than deleting potentially recoverable finds.
  }
}
