import { useCallback, useMemo } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { api } from '../lib/api';
import { track } from '../lib/analytics';
import type { Board, BoardFeedItem } from '../types/board';
import type { Item } from '../types/item';
import type { Outfit } from '../types/outfit';
import type { WishlistEntry } from '../lib/wishlist';
import type { Event } from '../types/event';
import { useEvents } from './useEvents';

export const BOARDS_QUERY_KEY = ['boards'] as const;

function invalidateBoardQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
}

export type CreateBoardInput = {
  name: string;
  itemIds?: number[];
  outfitIds?: number[];
  wishlistIds?: string[];
};

export type UpdateBoardInput = {
  id: number;
  name?: string;
  itemIds?: number[];
  outfitIds?: number[];
  wishlistIds?: string[];
  coverImageUrl?: string | null;
};

/** A reference that can be toggled into/out of a board. */
export type BoardEntryRef =
  | { type: 'item'; id: number }
  | { type: 'outfit'; id: number }
  | { type: 'wishlist'; id: string };

export function useBoards() {
  return useQuery({
    queryKey: BOARDS_QUERY_KEY,
    // Coerce to an array defensively — a stale/misrouted backend could return a
    // non-array body, and consumers call `.map`/`.find` on this directly.
    queryFn: () => api.get<Board[]>('/api/boards').then((r) => (Array.isArray(r.data) ? r.data : [])),
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBoardInput) =>
      api.post<Board>('/api/boards', input).then((r) => r.data),
    onSuccess: (board) => {
      qc.setQueryData<Board[]>(BOARDS_QUERY_KEY, (old = []) => [board, ...old]);
      track('board_created', { boardId: board.id });
    },
    onError: () => {
      Alert.alert('Error', "Couldn't create board. Please try again.");
    },
    onSettled: () => invalidateBoardQueries(qc),
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateBoardInput) =>
      api.patch<Board>(`/api/boards/${id}`, patch).then((r) => r.data),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: BOARDS_QUERY_KEY });
      const previous = qc.getQueryData<Board[]>(BOARDS_QUERY_KEY);
      qc.setQueryData<Board[]>(BOARDS_QUERY_KEY, (old) =>
        old?.map((b) => (b.id === id ? { ...b, ...patch } : b)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(BOARDS_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't update board. Please try again.");
    },
    onSettled: () => invalidateBoardQueries(qc),
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/boards/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: BOARDS_QUERY_KEY });
      const previous = qc.getQueryData<Board[]>(BOARDS_QUERY_KEY);
      qc.setQueryData<Board[]>(BOARDS_QUERY_KEY, (old) => old?.filter((b) => b.id !== id) ?? []);
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(BOARDS_QUERY_KEY, ctx.previous);
      Alert.alert('Error', "Couldn't delete board. Please try again.");
    },
    onSettled: () => invalidateBoardQueries(qc),
  });
}

/**
 * Returns `toggle(boardId, ref)` which adds the reference to the board if absent,
 * or removes it if already present. Newest saves go to the front so derived
 * covers favour the most recently added pieces. Built on the optimistic
 * useUpdateBoard mutation, so the UI reflects the change immediately.
 */
export function useToggleBoardEntry() {
  const qc = useQueryClient();
  const { mutate } = useUpdateBoard();

  return useCallback(
    (boardId: number, ref: BoardEntryRef) => {
      const board = (qc.getQueryData<Board[]>(BOARDS_QUERY_KEY) ?? []).find((b) => b.id === boardId);
      if (!board) return;

      if (ref.type === 'item') {
        const has = board.itemIds.includes(ref.id);
        mutate({
          id: boardId,
          itemIds: has ? board.itemIds.filter((i) => i !== ref.id) : [ref.id, ...board.itemIds],
        });
      } else if (ref.type === 'outfit') {
        const has = board.outfitIds.includes(ref.id);
        mutate({
          id: boardId,
          outfitIds: has ? board.outfitIds.filter((i) => i !== ref.id) : [ref.id, ...board.outfitIds],
        });
      } else {
        const has = board.wishlistIds.includes(ref.id);
        mutate({
          id: boardId,
          wishlistIds: has ? board.wishlistIds.filter((i) => i !== ref.id) : [ref.id, ...board.wishlistIds],
        });
      }
    },
    [qc, mutate]
  );
}

/**
 * The event a board is attached to, preferring the soonest one still ahead.
 *
 * A pure derivation over the events already in cache rather than a query of its
 * own: the link lives on `events.boardId`, so there is nothing extra to fetch.
 * Falls back to the most recent past event so a board used for something that
 * already happened still shows what it was for.
 */
export function useBoardEvent(boardId: number): Event | null {
  const { data: events = [] } = useEvents();
  return useMemo(() => {
    const linked = events.filter((event) => event.boardId === boardId);
    if (linked.length === 0) return null;
    const now = Date.now();
    const upcoming = linked
      .filter((event) => new Date(event.date).getTime() >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (upcoming.length > 0) return upcoming[0];
    return linked
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [events, boardId]);
}

/** Whether a board already contains the given reference (for checkmarks in the save sheet). */
export function boardContains(board: Board, ref: BoardEntryRef): boolean {
  if (ref.type === 'item') return board.itemIds.includes(ref.id);
  if (ref.type === 'outfit') return board.outfitIds.includes(ref.id);
  return board.wishlistIds.includes(ref.id);
}

type BoardFeedRef =
  | { kind: 'item'; data: Item }
  | { kind: 'outfit'; data: Outfit }
  | { kind: 'wishlist'; data: WishlistEntry };
type BoardFeedPage = { items: BoardFeedRef[]; nextCursor: string | null };

/** Cursor-paginated mixed feed for a board (items + outfits + wishlist). */
export function useBoardFeed(boardId: number) {
  return useInfiniteQuery({
    queryKey: [...BOARDS_QUERY_KEY, boardId, 'feed'] as const,
    queryFn: ({ pageParam }) =>
      api
        .get<BoardFeedPage>(`/api/boards/${boardId}/feed`, {
          params: { cursor: pageParam, limit: 30 },
        })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Flatten infinite-query pages into the unified BoardFeedItem list for rendering. */
export function flattenBoardFeed(pages: BoardFeedPage[] | undefined): BoardFeedItem[] {
  if (!pages) return [];
  const out: BoardFeedItem[] = [];
  for (const page of pages) {
    for (const ref of page.items) {
      // Match kinds explicitly rather than falling through to wishlist: the
      // server still emits legacy `storeFind` entries for the hidden Daily
      // Finds board, and a catch-all would render one as a malformed tile.
      if (ref.kind === 'item') out.push({ kind: 'item', key: `i${ref.data.id}`, item: ref.data });
      else if (ref.kind === 'outfit') out.push({ kind: 'outfit', key: `o${ref.data.id}`, outfit: ref.data });
      else if (ref.kind === 'wishlist') out.push({ kind: 'wishlist', key: `w${ref.data.id}`, entry: ref.data });
    }
  }
  return out;
}
