import { filterVisibleBoards, isLegacyDailyFindsBoard } from '../legacyBoards';

describe('legacyBoards', () => {
  it('identifies the retired Daily Finds board by exact name', () => {
    expect(isLegacyDailyFindsBoard({ name: 'Daily Finds' })).toBe(true);
    expect(isLegacyDailyFindsBoard({ name: 'Vacation' })).toBe(false);
    expect(isLegacyDailyFindsBoard(null)).toBe(false);
  });

  it('hides Daily Finds while preserving other boards', () => {
    const visible = { id: 1, name: 'Vacation' };
    const boards = [
      { id: 2, name: 'Daily Finds' },
      visible,
      { id: 3, name: 'Workwear' },
    ];

    expect(filterVisibleBoards(boards)).toEqual([visible, { id: 3, name: 'Workwear' }]);
    expect(filterVisibleBoards(boards)[0]).toBe(visible);
  });
});
