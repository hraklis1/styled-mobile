import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../lib/api';

/** The subset of POST /api/stylist/ask the board sheet renders. */
export type BoardAskResponse = {
  response: string;
  itemIds?: number[];
  mode?: string;
};

export type BoardAskInput = {
  boardId: number;
  name: string;
  itemIds: number[];
  question: string;
};

/** One saved question and answer, newest first from GET /api/boards/:id/asks. */
export type BoardAskEntry = {
  id: number;
  question: string;
  response: string;
  itemIds: number[];
  createdAt: string;
};

export const boardAsksQueryKey = (boardId: number) => ['boards', boardId, 'asks'] as const;

/** The board's saved Ask history (the server keeps the newest 10). */
export function useBoardAsks(boardId: number) {
  return useQuery({
    queryKey: boardAsksQueryKey(boardId),
    queryFn: async () => (await api.get<BoardAskEntry[]>(`/api/boards/${boardId}/asks`)).data,
  });
}

/**
 * Ask the stylist a free-form question about one board, without opening the chat.
 *
 * The `ask` board action routes server-side to advice mode (one call, no
 * classifier). The server re-reads the board's membership itself, so `itemIds`
 * is a hint rather than the authority; the answer may still draw on the rest of
 * the closet. Each question stands alone — there is no conversation history.
 *
 * The answer is saved to the board's history inside `mutationFn`, not in an
 * `onSuccess`, so it still lands if the sheet closes while the stylist thinks.
 * If saving fails the entry is kept in the local cache so the answer the user
 * paid for is still shown this session.
 */
export function useBoardAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ boardId, name, itemIds, question }: BoardAskInput): Promise<BoardAskEntry> => {
      const res = await api.post<BoardAskResponse>('/api/stylist/ask', {
        text: question,
        source: 'board_detail',
        context: { kind: 'board', boardId, name, itemIds: itemIds.slice(0, 80), action: 'ask' },
      });
      const answer = { question, response: res.data.response, itemIds: res.data.itemIds ?? [] };
      let entry: BoardAskEntry;
      try {
        entry = (await api.post<BoardAskEntry>(`/api/boards/${boardId}/asks`, answer)).data;
      } catch {
        entry = { ...answer, id: -Date.now(), createdAt: new Date().toISOString() };
      }
      qc.setQueryData<BoardAskEntry[]>(boardAsksQueryKey(boardId), (prev = []) => [
        entry,
        ...prev.filter((e) => e.id !== entry.id),
      ].slice(0, 10));
      return entry;
    },
  });
}

/** Wipe a board's saved Ask history. */
export function useClearBoardAsks(boardId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/api/boards/${boardId}/asks`);
    },
    onSuccess: () => qc.setQueryData<BoardAskEntry[]>(boardAsksQueryKey(boardId), []),
  });
}
