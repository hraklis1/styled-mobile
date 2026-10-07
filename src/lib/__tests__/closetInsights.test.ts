import { buildClosetInsights } from '../closetInsights';
import type { Item } from '../../types/item';
import type { OutfitLog } from '../../hooks/useOutfitLogs';

const NOW = new Date(2026, 9, 6, 12);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

let nextId = 1;
function item(over: Partial<Item> = {}): Item {
  return {
    id: nextId++, name: 'Piece', userId: 1, category: 'top', colorNormalized: 'black',
    purchasePrice: null, wearCount: 0, lastWornAt: null, isArchived: false,
    createdAt: daysAgo(200), colorPalette: [], seasons: [], occasions: [], tags: [], notableDetails: [],
    ...over,
  } as Item;
}

describe('buildClosetInsights', () => {
  it('is not ready for an empty or sparse closet', () => {
    expect(buildClosetInsights([], [], NOW)).toMatchObject({ totalItems: 0, ready: false, activeShare: 0, rhythm: [] });
    expect(buildClosetInsights([item(), item()], [], NOW).ready).toBe(false);
  });

  it('computes utilization, sleeping pieces and a normal-closet profile', () => {
    const items = [
      ...Array.from({ length: 4 }, () => item({ wearCount: 10, lastWornAt: daysAgo(5), purchasePrice: 100 })),
      ...Array.from({ length: 4 }, () => item({ category: 'shoes', colorNormalized: 'navy', lastWornAt: daysAgo(120), wearCount: 1 })),
      item({ createdAt: daysAgo(3) }), // new, not sleeping
      item({ isArchived: true }),
    ];
    const r = buildClosetInsights(items, [], NOW);
    expect(r.totalItems).toBe(9);
    expect(r.ready).toBe(true);
    expect(r.activeCount).toBe(4);
    expect(r.sleeping).toHaveLength(4);
    expect(r.avgCostPerWear).toBe(10);
    expect(r.colors[0]).toMatchObject({ key: 'black', count: 5 });
    expect(r.categories[0]).toMatchObject({ category: 'top', count: 5 });
    expect(r.hardestWorking[0].wearCount).toBe(10);
    expect(r.bestValue[0].costPerWear).toBe(10);
  });

  it('hides cost per wear without enough prices', () => {
    const items = Array.from({ length: 8 }, (_, i) => item({ wearCount: 2, purchasePrice: i < 2 ? 50 : null }));
    expect(buildClosetInsights(items, [], NOW).avgCostPerWear).toBeNull();
  });

  it('buckets wear logs into 12 weeks, this week last', () => {
    const log = (date: string) => ({ id: 1, userId: 1, date, itemIds: [], notes: null, location: null, rating: null, createdAt: date }) as OutfitLog;
    const r = buildClosetInsights([], [log('2026-10-06'), log('2026-10-01'), log('2026-09-20'), log('2025-01-01')], NOW);
    expect(r.rhythm).toHaveLength(12);
    expect(r.rhythm[11]).toBe(2);
    expect(r.rhythm[9]).toBe(1);
  });
});
