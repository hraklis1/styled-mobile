import { buildWearWeek } from '../wearWeek';
import type { OutfitLog } from '../../hooks/useOutfitLogs';

function log(id: number, date: string, createdAt = `${date}T09:00:00Z`): OutfitLog {
  return { id, userId: 1, date, itemIds: [id], notes: null, location: null, rating: null, createdAt };
}

// Wednesday 30 Sep 2026, local time.
const today = new Date(2026, 8, 30, 20, 0, 0);

describe('buildWearWeek', () => {
  it('starts the week on Monday and flags today and future days', () => {
    const week = buildWearWeek([], today);
    expect(week.days.map((day) => day.dateKey)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ]);
    expect(week.days.filter((day) => day.isToday).map((day) => day.dateKey)).toEqual(['2026-09-30']);
    expect(week.days.filter((day) => day.isFuture)).toHaveLength(4);
  });

  it('starts on the previous Monday when today is Sunday', () => {
    const sunday = new Date(2026, 9, 4, 12);
    expect(buildWearWeek([], sunday).days[0].dateKey).toBe('2026-09-28');
  });

  it('keeps the latest entry when a day has several', () => {
    const week = buildWearWeek([
      log(1, '2026-09-29', '2026-09-29T08:00:00Z'),
      log(2, '2026-09-29', '2026-09-29T18:00:00Z'),
    ], today);
    expect(week.days[1].log?.id).toBe(2);
    expect(week.loggedCount).toBe(1);
  });

  it('reports the last log when nothing was logged this week', () => {
    const week = buildWearWeek([log(1, '2026-08-05'), log(2, '2026-07-30')], today);
    expect(week.loggedCount).toBe(0);
    expect(week.lastLog?.id).toBe(1);
  });

  it('has no last log when the diary is empty', () => {
    expect(buildWearWeek([], today).lastLog).toBeNull();
  });
});
