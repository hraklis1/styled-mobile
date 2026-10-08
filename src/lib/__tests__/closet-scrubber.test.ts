import { buildScrubberEntries } from '../closet-scrubber';

const NOW = new Date('2026-10-07T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const piece = (over: Partial<Parameters<typeof buildScrubberEntries>[0][number]> = {}) => ({
  name: 'Coat', createdAt: '2026-10-01T12:00:00Z', wearCount: 0, lastWornAt: null, purchasePrice: null, ...over,
});

test('name sorts index by first letter, with # for non-letters', () => {
  const rows = ['apron', 'Anorak', 'belt', '9 shirt', 'coat'].map(name => piece({ name }));
  expect(buildScrubberEntries(rows, 'name_asc').map(e => [e.label, e.index])).toEqual([['A', 0], ['B', 2], ['#', 3], ['C', 4]]);
});

test('date sorts index by month and keep same-named months of different years apart', () => {
  const rows = ['2026-10-02', '2026-09-15', '2025-10-20', '2025-08-01'].map(d => piece({ createdAt: `${d}T12:00:00Z` }));
  const entries = buildScrubberEntries(rows, 'newest');
  expect(entries.map(e => e.index)).toEqual([0, 1, 2, 3]);
  expect(new Set(entries.map(e => e.title)).size).toBe(4);
});

test('long date ranges fall back to years', () => {
  const rows = Array.from({ length: 30 }, (_, i) => piece({ createdAt: new Date(Date.UTC(2026, 9 - i, 15)).toISOString() }));
  expect(buildScrubberEntries(rows, 'newest').map(e => e.label)).toEqual(['2026', '2025', '2024']);
});

test('wear, recency and cost sorts use bands in sort order', () => {
  expect(buildScrubberEntries([12, 6, 2, 0].map(wearCount => piece({ wearCount })), 'most_worn').map(e => e.label))
    .toEqual(['10+', '5–9', '1–4', 'Never']);
  expect(buildScrubberEntries([2, 20, 200, null].map(d => piece({ lastWornAt: d == null ? null : new Date(NOW - d * DAY).toISOString() })), 'recently_worn', NOW).map(e => e.title))
    .toEqual(['This week', 'This month', 'This year', 'Never worn']);
  expect(buildScrubberEntries([[10, 5], [50, 5], [100, 2], [null, 0]].map(([purchasePrice, wearCount]) => piece({ purchasePrice, wearCount: wearCount! })), 'cost_per_wear').map(e => e.label))
    .toEqual(['<$5', '$5–20', '$20+', '—']);
});

test('fewer than three sections hides the scrubber', () => {
  expect(buildScrubberEntries([piece({ wearCount: 0 }), piece({ wearCount: 3 })], 'least_worn')).toEqual([]);
});
