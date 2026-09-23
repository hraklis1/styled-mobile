import { useMutation } from '@tanstack/react-query';

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

/**
 * Ask the stylist a free-form question about one board, without opening the chat.
 *
 * The `ask` board action routes server-side to advice mode (one call, no
 * classifier). The server re-reads the board's membership itself, so `itemIds`
 * is a hint rather than the authority; the answer may still draw on the rest of
 * the closet. Each question stands alone — there is no conversation history.
 *
 * `_stream` is deliberately omitted: the JSON path returns the whole answer at
 * once, and there is nothing to render progressively inside a one-shot sheet.
 */
export function useBoardAsk() {
  return useMutation({
    mutationFn: async ({ boardId, name, itemIds, question }: BoardAskInput) => {
      const res = await api.post<BoardAskResponse>('/api/stylist/ask', {
        text: question,
        source: 'board_detail',
        context: { kind: 'board', boardId, name, itemIds: itemIds.slice(0, 80), action: 'ask' },
      });
      return res.data;
    },
  });
}
