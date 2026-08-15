import { useMutation } from '@tanstack/react-query';

import { api } from '../lib/api';
import type { StylistTripPlanData } from '../features/stylist/types';

/**
 * The subset of POST /api/stylist/ask we care about here. The route is shared
 * with the chat, but this call never opens it — the board sheet renders the
 * result itself.
 */
export type BoardCapsuleResponse = {
  response: string;
  tripPlan?: StylistTripPlanData | null;
  mode?: string;
  boardAction?: 'outfit' | 'complete' | 'capsule' | 'theme' | null;
};

export type BoardCapsuleInput = {
  boardId: number;
  name: string;
  itemIds: number[];
};

/**
 * Ask the stylist for a capsule built from one board's owned pieces.
 *
 * `action: 'capsule'` maps server-side to the trip workflow
 * (resolveBoardStylistMode), which returns a tripPlan tagged
 * `kind: 'board_capsule'`. The server re-reads the board's membership itself
 * and ignores anything we send that it doesn't own, so `itemIds` here is a
 * hint for prompt context rather than the authority.
 *
 * `_stream` is deliberately omitted: the JSON path returns the whole payload
 * at once, and there is nothing to render progressively inside a one-shot sheet.
 */
export function useBoardCapsule() {
  return useMutation({
    mutationFn: async ({ boardId, name, itemIds }: BoardCapsuleInput) => {
      const res = await api.post<BoardCapsuleResponse>('/api/stylist/ask', {
        text: `Build a capsule from ${name}`,
        source: 'board_detail',
        context: { kind: 'board', boardId, name, itemIds: itemIds.slice(0, 80), action: 'capsule' },
      });
      return res.data;
    },
  });
}

/**
 * Did the server actually run the capsule path?
 *
 * The mode can differ from what we asked for — a board with no wearable pieces
 * falls through to a plain prose answer rather than the trip workflow. Reading
 * the returned `mode`/`boardAction` avoids a second source of truth for that.
 */
export function ranCapsuleWorkflow(res: BoardCapsuleResponse): boolean {
  return res.boardAction === 'capsule' && res.mode === 'trip';
}
