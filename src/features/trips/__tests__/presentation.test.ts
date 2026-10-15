import { daysWearingLook, luggageFitCopy, packingGroups, packingProgress, tripDayParts } from '../presentation';
import { tripOnDate } from '../../../components/calendar/TripDayBand';
import { isTripPlanV2, type TripPlanV2, type TripSummary } from '../types';
import type { Item } from '../../../types/item';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const item = (id: number, category: string) => ({ id, name: `Piece ${id}`, category }) as unknown as Item;
const items = [item(1, 'outerwear'), item(2, 'top'), item(3, 'bottom'), item(4, 'shoes'), item(5, 'shoes'), item(6, 'top')];

const plan: TripPlanV2 = {
  version: 2,
  intro: 'Navy and stone.',
  outfits: [
    { label: 'Travel', note: '', itemIds: [1, 2, 3, 4] },
    { label: 'Dinner', note: '', itemIds: [6, 3, 5] },
  ],
  packingList: ['Swimwear'],
  packingItemIds: [3, 1, 2, 4, 6, 5],
  capsule: [{ itemId: 3, uses: 2 }, { itemId: 1, uses: 1 }, { itemId: 2, uses: 1 }, { itemId: 4, uses: 1 }, { itemId: 6, uses: 1 }, { itemId: 5, uses: 1 }],
  days: [
    { date: '2026-11-12', title: 'Arrival', note: '', lookIndexes: [0, 1] },
    { date: '2026-11-13', title: 'Tiles', note: '', lookIndexes: [1] },
  ],
  travelLookIndex: 0,
};

test('pieces worn in transit leave the bag and its count', () => {
  const { transit, groups } = packingGroups(plan, items);
  expect(transit.map((r) => r.item.id).sort()).toEqual([1, 2, 3, 4]);
  expect(groups.map((g) => [g.key, g.rows.map((r) => r.item.id)])).toEqual([['tops', [6]], ['shoes', [5]]]);
  expect(packingProgress(plan, items, [6, 1], ['swimwear'])).toEqual({ done: 2, total: 3, fraction: 2 / 3 });
});

test('day labels, the days a look is worn, and luggage copy', () => {
  expect(tripDayParts('2026-11-12')).toEqual({ weekday: 'Thu', day: '12', month: 'Nov' });
  expect(daysWearingLook(plan, 1)).toBe('Thu 12, Fri 13');
  expect(luggageFitCopy('tight')).toBe('A snug carry-on');
  expect(luggageFitCopy(null)).toBeNull();
});

test('only a v2 plan with days opens the Trip screen', () => {
  expect(isTripPlanV2(plan)).toBe(true);
  expect(isTripPlanV2({ ...plan, version: undefined })).toBe(false);
});

test('the calendar finds the trip covering a date, inclusive', () => {
  const trips = [{ id: 1, startDate: '2026-11-12', endDate: '2026-11-18' }] as TripSummary[];
  expect(tripOnDate(trips, '2026-11-18')?.id).toBe(1);
  expect(tripOnDate(trips, '2026-11-19')).toBeUndefined();
});
