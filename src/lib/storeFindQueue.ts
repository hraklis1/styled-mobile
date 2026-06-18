import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoreFind } from '../types/storeFind';

const QUEUE_KEY = '@styled/store_find_queue';

export type StoreFindQueueEntry = {
  boardId: number;
  find: StoreFind;
  queuedAt: string;
};

async function readQueue(): Promise<StoreFindQueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as StoreFindQueueEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: StoreFindQueueEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueStoreFind(boardId: number, find: StoreFind): Promise<void> {
  const queue = await readQueue();
  queue.push({ boardId, find, queuedAt: new Date().toISOString() });
  await writeQueue(queue);
}

export async function dequeueAll(): Promise<StoreFindQueueEntry[]> {
  return readQueue();
}

export async function removeEntry(findId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((e) => e.find.id !== findId));
}
