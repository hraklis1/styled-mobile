import { useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '../lib/api';
import { uploadLocalImages } from '../lib/uploadLocalImages';
import {
  enqueueStoreFind,
  readStoreFindQueue,
  migrateLegacyStoreFindQueue,
  removeQueuedStoreFind,
  updateQueuedStoreFind,
  type StoreFindQueueEntry,
} from '../lib/storeFindQueue';
import { useAuth } from '../contexts/AuthContext';
import { BOARDS_QUERY_KEY } from './useBoards';
import type { Board } from '../types/board';
import type { StoreFind } from '../types/storeFind';

export const STORE_FIND_QUEUE_QUERY_KEY = ['storeFindQueue'] as const;
const syncingUsers = new Set<string>();

async function deleteLocalImages(uris: string[]): Promise<void> {
  for (const uri of uris) {
    if (uri.startsWith('file://')) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
  }
}

function readableSyncError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to sync. Your find is still saved on this device.';
}

export function useStoreFindSync(boardId?: number) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ? String(user.id) : null;

  const queueQuery = useQuery({
    queryKey: [...STORE_FIND_QUEUE_QUERY_KEY, userId],
    queryFn: () => (userId ? readStoreFindQueue(userId) : Promise.resolve([])),
    enabled: !!userId,
    staleTime: 0,
  });

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: [...STORE_FIND_QUEUE_QUERY_KEY, userId] });
  }, [qc, userId]);

  const sync = useCallback(async () => {
    if (!userId || syncingUsers.has(userId)) return;
    syncingUsers.add(userId);

    try {
      const queue = await readStoreFindQueue(userId);
      if (queue.length === 0) return;

      let boards = await api.get<Board[]>('/api/boards').then((response) => response.data);

      for (const entry of queue) {
        let workingFind = entry.find;
        try {
          let target = entry.boardId ? boards.find((board) => board.id === entry.boardId) : undefined;
          target ??= boards.find(
            (board) => board.name.toLowerCase() === entry.targetBoardName.toLowerCase(),
          );

          if (!target) {
            const createdBoard = await api
              .post<Board>('/api/boards', { name: entry.targetBoardName })
              .then((response) => response.data);
            target = createdBoard;
            boards = [createdBoard, ...boards];
          }
          if (!target) throw new Error('Daily Finds is unavailable.');
          const targetBoard = target;

          const syncingFind: StoreFind = {
            ...entry.find,
            syncStatus: 'syncing',
            syncError: null,
            lastSyncAttemptAt: new Date().toISOString(),
          };
          await updateQueuedStoreFind(userId, entry.find.id, {
            boardId: targetBoard.id,
            find: syncingFind,
          });
          await refresh();

          const uploaded = await uploadLocalImages(syncingFind, userId);
          if ((uploaded.imageUrls ?? []).some((uri) => uri.startsWith('file://'))) {
            throw new Error('Photo upload is waiting for a better connection.');
          }
          workingFind = uploaded;
          await updateQueuedStoreFind(userId, entry.find.id, {
            boardId: targetBoard.id,
            find: { ...uploaded, syncStatus: 'syncing', syncError: null },
          });
          await refresh();

          const remoteFinds = targetBoard.storeFinds ?? [];
          const syncedFind: StoreFind = {
            ...uploaded,
            syncStatus: 'synced',
            syncError: null,
          };
          const merged = remoteFinds.some((find) => find.id === syncedFind.id)
            ? remoteFinds.map((find) => (find.id === syncedFind.id ? syncedFind : find))
            : [syncedFind, ...remoteFinds];

          const updatedBoard = await api
            .patch<Board>(`/api/boards/${targetBoard.id}`, { storeFinds: merged })
            .then((response) => response.data);
          boards = boards.map((board) => (board.id === updatedBoard.id ? updatedBoard : board));

          await removeQueuedStoreFind(userId, entry.find.id);
          await deleteLocalImages(entry.localImageUris ?? (entry.find.imageUrls ?? []).filter((uri) => uri.startsWith('file://')));
          qc.setQueryData<Board[]>(BOARDS_QUERY_KEY, boards);
        } catch (error) {
          const attempts = (entry.find.syncAttempts ?? 0) + 1;
          await updateQueuedStoreFind(userId, entry.find.id, {
            find: {
              ...workingFind,
              syncStatus: 'failed',
              syncError: readableSyncError(error),
              syncAttempts: attempts,
              lastSyncAttemptAt: new Date().toISOString(),
            },
          });
        }
      }
    } catch {
      // Fetching boards can fail wholesale while offline. The durable queue is untouched.
    } finally {
      syncingUsers.delete(userId);
      await refresh();
      qc.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
    }
  }, [qc, refresh, userId]);

  const queueFind = useCallback(async (
    find: StoreFind,
    targetBoardId: number | null,
    targetBoardName = 'Daily Finds',
  ) => {
    if (!userId) throw new Error('Sign in before saving a find.');
    const pendingFind: StoreFind = {
      ...find,
      syncStatus: 'pending',
      syncError: null,
      syncAttempts: find.syncAttempts ?? 0,
    };
    await enqueueStoreFind({
      userId,
      boardId: targetBoardId,
      targetBoardName,
      find: pendingFind,
      localImageUris: (pendingFind.imageUrls ?? []).filter((uri) => uri.startsWith('file://')),
      queuedAt: new Date().toISOString(),
    });
    await refresh();
    void sync();
  }, [refresh, sync, userId]);

  const retry = useCallback(async (findId?: string) => {
    if (userId && findId) {
      const entries = await readStoreFindQueue(userId);
      const entry = entries.find((candidate) => candidate.find.id === findId);
      if (entry) {
        await updateQueuedStoreFind(userId, findId, {
          find: { ...entry.find, syncStatus: 'pending', syncError: null },
        });
      }
    }
    await refresh();
    await sync();
  }, [refresh, sync, userId]);

  const updateLocalFind = useCallback(async (find: StoreFind) => {
    if (!userId) return false;
    const queue = await readStoreFindQueue(userId);
    const entry = queue.find((candidate) => candidate.find.id === find.id);
    if (!entry) return false;
    await updateQueuedStoreFind(userId, find.id, {
      find: { ...find, syncStatus: 'pending', syncError: null },
      localImageUris: Array.from(new Set([
        ...(entry.localImageUris ?? []),
        ...(find.imageUrls ?? []).filter((uri) => uri.startsWith('file://')),
      ])),
    });
    await refresh();
    void sync();
    return true;
  }, [refresh, sync, userId]);

  const discardLocalFind = useCallback(async (findId: string) => {
    if (!userId) return false;
    const queue = await readStoreFindQueue(userId);
    const entry = queue.find((candidate) => candidate.find.id === findId);
    if (!entry) return false;
    await removeQueuedStoreFind(userId, findId);
    await deleteLocalImages(entry.localImageUris ?? []);
    await refresh();
    return true;
  }, [refresh, userId]);

  useEffect(() => {
    if (!userId) return;
    void migrateLegacyStoreFindQueue(userId).then(() => sync());
  }, [sync, userId]);

  useEffect(() => {
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    const network = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void sync();
    });
    return () => {
      appState.remove();
      network();
    };
  }, [sync]);

  const entries = (queueQuery.data ?? []).filter((entry: StoreFindQueueEntry) => {
    if (boardId == null) return true;
    return entry.boardId === boardId || (entry.boardId == null && entry.targetBoardName === 'Daily Finds');
  });

  return {
    entries,
    pendingFinds: entries.map((entry) => entry.find),
    pendingCount: entries.length,
    isLoading: queueQuery.isLoading,
    queueFind,
    retry,
    updateLocalFind,
    discardLocalFind,
    sync,
    refresh,
  };
}
