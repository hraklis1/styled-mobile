import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '../lib/api';
import { uploadLocalImages } from '../lib/uploadLocalImages';
import { dequeueAll, removeEntry, StoreFindQueueEntry } from '../lib/storeFindQueue';
import { useAuth } from '../contexts/AuthContext';
import { BOARDS_QUERY_KEY } from './useBoards';
import type { StoreFind } from '../types/storeFind';

type BoardFeedRef = { kind: string; data: unknown };
type BoardFeedPage = { items: BoardFeedRef[]; nextCursor: string | null };

async function fetchRemoteStoreFinds(boardId: number): Promise<StoreFind[]> {
  const res = await api.get<BoardFeedPage>(`/api/boards/${boardId}/feed`, {
    params: { limit: 100 },
  });
  return res.data.items
    .filter((r) => r.kind === 'storeFind')
    .map((r) => r.data as StoreFind);
}

async function deleteLocalImages(find: StoreFind): Promise<void> {
  for (const uri of find.imageUrls ?? []) {
    if (uri.startsWith('file://')) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  }
}

export function useStoreFindSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSyncing = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const queue = await dequeueAll();
    setPendingCount(queue.length);
  }, []);

  const sync = useCallback(async () => {
    if (!user?.id || isSyncing.current) return;
    isSyncing.current = true;

    try {
      const queue = await dequeueAll();
      if (queue.length === 0) {
        setPendingCount(0);
        return;
      }

      // Group entries by boardId so we make one PATCH per board
      const byBoard = new Map<number, StoreFindQueueEntry[]>();
      for (const entry of queue) {
        const list = byBoard.get(entry.boardId) ?? [];
        list.push(entry);
        byBoard.set(entry.boardId, list);
      }

      for (const [boardId, entries] of byBoard) {
        let remoteFinds: StoreFind[];
        try {
          remoteFinds = await fetchRemoteStoreFinds(boardId);
        } catch {
          continue; // network unavailable — leave in queue
        }

        const remoteIds = new Set(remoteFinds.map((sf) => sf.id));
        const toAppend: StoreFind[] = [];
        const pendingEntries: StoreFindQueueEntry[] = [];

        for (const entry of entries) {
          if (remoteIds.has(entry.find.id)) {
            // Already on server (e.g. a previous partial sync succeeded)
            await removeEntry(entry.find.id);
            await deleteLocalImages(entry.find);
            continue;
          }
          const uploaded = await uploadLocalImages(entry.find, user.id);

          // If any image still has a file:// URI the upload failed — skip this
          // entry and leave it in the queue so the next sync can retry.
          if ((uploaded.imageUrls ?? []).some((u) => u.startsWith('file://'))) continue;

          toAppend.push(uploaded);
          pendingEntries.push(entry);
        }

        if (toAppend.length === 0) continue;

        const merged = [...toAppend, ...remoteFinds];

        try {
          await api.patch(`/api/boards/${boardId}`, { storeFinds: merged });
          qc.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });

          // Delete the ORIGINAL local files (not the uploaded R2 URLs).
          for (let i = 0; i < toAppend.length; i++) {
            await removeEntry(toAppend[i].id);
            await deleteLocalImages(pendingEntries[i].find);
          }
        } catch {
          // Leave in queue for next retry
        }
      }
    } finally {
      isSyncing.current = false;
      const remaining = await dequeueAll();
      setPendingCount(remaining.length);
    }
  }, [user?.id, qc]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, [sync]);

  return { pendingCount, sync };
}
