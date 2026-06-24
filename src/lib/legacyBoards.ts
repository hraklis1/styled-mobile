import type { Board } from '../types/board';

export const LEGACY_DAILY_FINDS_BOARD_NAME = 'Daily Finds';

export function isLegacyDailyFindsBoard(board: Pick<Board, 'name'> | null | undefined): boolean {
  return board?.name === LEGACY_DAILY_FINDS_BOARD_NAME;
}

export function filterVisibleBoards<T extends Pick<Board, 'name'>>(boards: T[]): T[] {
  return boards.filter((board) => !isLegacyDailyFindsBoard(board));
}
