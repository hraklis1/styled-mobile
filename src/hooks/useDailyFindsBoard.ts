import { useEffect, useRef } from 'react';
import { useBoards, useCreateBoard } from './useBoards';

const DAILY_FINDS_NAME = 'Daily Finds';

/**
 * Ensures a "Daily Finds" board exists for the current user and returns its
 * id. Auto-creates it on first call if no board with that name is found.
 * The creation guard is a component-lifetime ref so concurrent renders don't
 * fire duplicate POSTs.
 */
export function useDailyFindsBoard() {
  const { data: boards = [], isSuccess } = useBoards();
  const { mutate: createBoard } = useCreateBoard();
  const createAttempted = useRef(false);

  const dailyFindsBoard = boards.find((b) => b.name === DAILY_FINDS_NAME);

  useEffect(() => {
    if (!isSuccess) return;
    if (dailyFindsBoard) return;
    if (createAttempted.current) return;
    createAttempted.current = true;
    createBoard({ name: DAILY_FINDS_NAME });
  }, [isSuccess, dailyFindsBoard, createBoard]);

  return {
    dailyFindsBoard: dailyFindsBoard ?? null,
    dailyFindsBoardId: dailyFindsBoard?.id ?? null,
  };
}
