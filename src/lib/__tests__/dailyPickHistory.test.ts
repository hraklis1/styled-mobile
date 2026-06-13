jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

import { recordDailyPick } from '../dailyPickHistory';

describe('daily pick history', () => {
  it('keeps the newest seven unique dates', () => {
    const existing = Array.from({ length: 7 }, (_, index) => ({
      date: `2026-06-${String(11 - index).padStart(2, '0')}`,
      outfitId: index + 1,
    }));

    const result = recordDailyPick(existing, { date: '2026-06-12', outfitId: 2 });

    expect(result).toHaveLength(7);
    expect(result[0]).toEqual({ date: '2026-06-12', outfitId: 2 });
    expect(result.some((entry) => entry.date === '2026-06-05')).toBe(false);
  });
});
