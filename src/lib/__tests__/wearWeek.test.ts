import { buildWearWeek } from '../wearWeek';
import type { OutfitLog } from '../../hooks/useOutfitLogs';

function log(id: number, date: string, createdAt = `${date}T09:00:00Z`): OutfitLog {
  return { id, userId: 1, date, itemIds: [id], notes: null, location: null, rating: null, createdAt };
}

// Wednesday 30 Sep 2026, local time.
const today = new Date(2026, 8, 30, 20, 0, 0);

describe('buildWearWeek', () => {
  it('covers the seven days ending today, with today last', () => {
    const week = buildWearWeek([], today);
    expect(week.days.map((day) => day.dateKey)).toEqual([
      '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30',
    ]);
    expect(week.days.filter((day) => day.isToday).map((day) => day.dateKey)).toEqual(['2026-09-30']);
  });

  it('shows six past days on a Monday instead of six future ones', () => {
    const monday = new Date(2026, 8, 28, 9);
    const days = buildWearWeek([], monday).days;
    expect(days[0].dateKey).toBe('2026-09-22');
    expect(days[6].dateKey).toBe('2026-09-28');
    expect(days[6].isToday).toBe(true);
  });

  it('crosses a month boundary', () => {
    const first = new Date(2026, 9, 1, 12);
    expect(buildWearWeek([], first).days.map((day) => day.dateKey)).toEqual([
      '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01',
    ]);
  });

  it('keeps the latest entry when a day has several', () => {
    const week = buildWearWeek([
      log(1, '2026-09-29', '2026-09-29T08:00:00Z'),
      log(2, '2026-09-29', '2026-09-29T18:00:00Z'),
    ], today);
    expect(week.days[5].log?.id).toBe(2);
    expect(week.loggedCount).toBe(1);
  });

  it('reports the last log when nothing was logged in the window', () => {
    const week = buildWearWeek([log(1, '2026-08-05'), log(2, '2026-07-30')], today);
    expect(week.loggedCount).toBe(0);
    expect(week.lastLog?.id).toBe(1);
  });

  it('has no last log when the diary is empty', () => {
    expect(buildWearWeek([], today).lastLog).toBeNull();
  });
});
