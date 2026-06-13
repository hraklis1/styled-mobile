import { selectDailyStylistPick, toLocalDateKey, type DailyPickHistoryEntry } from '../dailyStylistPick';
import type { Event } from '../../types/event';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';
import type { OutfitLog } from '../../hooks/useOutfitLogs';

const now = new Date(2026, 5, 12, 9);
const date = toLocalDateKey(now);

function outfit(id: number, patch: Partial<Outfit> = {}): Outfit {
  return {
    id,
    name: `Outfit ${id}`,
    description: null,
    userId: 1,
    event: null,
    itemIds: [{ id, category: 'top' }],
    tags: [],
    notes: null,
    isDraft: false,
    isFavorite: false,
    aiGeneratedImageUrl: null,
    wearCount: 0,
    lastWornAt: null,
    createdAt: `2026-06-${String(id).padStart(2, '0')}T12:00:00.000Z`,
    ...patch,
  };
}

function item(id: number, patch: Partial<Item> = {}): Item {
  return {
    id,
    name: `Item ${id}`,
    userId: 1,
    imageUrl: null,
    color: null,
    colorPalette: [],
    colorNormalized: null,
    colorTemperature: null,
    category: 'top',
    subcategory: null,
    brand: null,
    style: null,
    seasons: [],
    occasions: [],
    material: null,
    fit: null,
    pattern: null,
    neckline: null,
    sleeveLength: null,
    tags: [],
    formalityStyles: [],
    notableDetails: [],
    notes: null,
    care: null,
    condition: null,
    warmthRating: null,
    purchasePrice: null,
    purchaseDate: null,
    wearCount: 0,
    lastWornAt: null,
    isFavorite: false,
    isArchived: false,
    createdAt: '2026-01-01T12:00:00.000Z',
    ...patch,
  };
}

function event(id: number, hour: number, patch: Partial<Event> = {}): Event {
  return {
    id,
    userId: 1,
    title: `Event ${id}`,
    date: `2026-06-12T${String(hour).padStart(2, '0')}:00:00.000Z`,
    occasion: 'casual',
    location: null,
    notes: null,
    environment: null,
    itemIds: null,
    outfitId: null,
    ...patch,
  };
}

const select = (
  outfits: Outfit[],
  options: {
    items?: Item[];
    events?: Event[];
    history?: DailyPickHistoryEntry[];
    weather?: Parameters<typeof selectDailyStylistPick>[0]['weather'];
    logs?: OutfitLog[];
  } = {},
) => selectDailyStylistPick({
  outfits,
  items: options.items ?? outfits.map((entry) => item(entry.id)),
  events: options.events ?? [],
  weather: options.weather,
  logs: options.logs ?? [],
  date,
  now,
  history: options.history ?? [],
});

describe('daily stylist pick', () => {
  it('always selects the next today event assignment', () => {
    const result = select([outfit(1), outfit(2)], {
      events: [event(1, 14, { outfitId: 2, title: 'Client lunch' })],
      history: [{ date, outfitId: 1 }],
    });

    expect(result?.outfit.id).toBe(2);
    expect(result?.reason).toBe('For Client lunch');
  });

  it('uses the earliest upcoming event when there are multiple today', () => {
    const result = select([outfit(1), outfit(2)], {
      events: [event(2, 18, { outfitId: 2 }), event(1, 11, { outfitId: 1 })],
    });
    expect(result?.outfit.id).toBe(1);
  });

  it('keeps a valid cached pick stable for the date', () => {
    const result = select([outfit(1), outfit(2, { isFavorite: true })], {
      history: [{ date, outfitId: 1 }],
    });
    expect(result?.outfit.id).toBe(1);
  });

  it('keeps a cached pick stable while retaining a contextual reason', () => {
    const result = select([outfit(1, { event: 'business' }), outfit(2)], {
      events: [event(1, 13, { occasion: 'business' })],
      history: [{ date, outfitId: 1 }],
    });
    expect(result?.outfit.id).toBe(1);
    expect(result?.reason).toContain('business');
  });

  it('replaces a deleted cached pick', () => {
    const result = select([outfit(2)], { history: [{ date, outfitId: 1 }] });
    expect(result?.outfit.id).toBe(2);
  });

  it('rotates away from recently featured outfits', () => {
    const result = select([outfit(1), outfit(2)], {
      history: [{ date: '2026-06-11', outfitId: 2 }],
    });
    expect(result?.outfit.id).toBe(1);
  });

  it('does not penalize picks older than seven days', () => {
    const result = select([outfit(1), outfit(2, { isFavorite: true })], {
      history: [{ date: '2026-05-01', outfitId: 2 }],
    });
    expect(result?.outfit.id).toBe(2);
  });

  it('uses occasion and weather suitability to rank outfits', () => {
    const result = select(
      [outfit(1, { event: 'business' }), outfit(2)],
      {
        events: [event(1, 13, { occasion: 'business' })],
        items: [
          item(1, { occasions: ['business'], warmthRating: 5, seasons: ['winter'], sleeveLength: 'long' }),
          item(2, { warmthRating: 1, seasons: ['summer'], sleeveLength: 'short' }),
        ],
        weather: {
          current: { condition: 'cold', temperatureC: 2, temperatureF: 36, summary: 'Cold' },
          forecast: { condition: 'cold', tempMaxC: 4, tempMinC: -2, tempMaxF: 39, tempMinF: 28 },
        },
      },
    );
    expect(result?.outfit.id).toBe(1);
    expect(result?.reason).toContain('business');
  });

  it('uses favorites, exact-item ratings, and wear recency as ranking signals', () => {
    const result = select(
      [
        outfit(1, { lastWornAt: '2026-06-12T08:00:00.000Z' }),
        outfit(2, { isFavorite: true }),
      ],
      {
        logs: [{
          id: 1,
          userId: 1,
          date,
          itemIds: [2],
          notes: null,
          location: null,
          rating: 5,
          createdAt: '2026-06-10T12:00:00.000Z',
        }],
      },
    );
    expect(result?.outfit.id).toBe(2);
    expect(result?.scoreDetails.favorite).toBeGreaterThan(0);
    expect(result?.scoreDetails.rating).toBeGreaterThan(0);
  });

  it('is deterministic for the same date', () => {
    const first = select([outfit(1), outfit(2)]);
    const second = select([outfit(1), outfit(2)]);
    expect(first?.outfit.id).toBe(second?.outfit.id);
  });

  it('ignores drafts and works without optional context or item metadata', () => {
    const result = select([outfit(1, { isDraft: true }), outfit(2)], { items: [] });
    expect(result?.outfit.id).toBe(2);
  });

  it('falls back to the newest outfit when no signals distinguish candidates', () => {
    const wornAt = now.toISOString();
    const result = select([
      outfit(1, { createdAt: '2026-06-01T12:00:00.000Z', lastWornAt: wornAt }),
      outfit(2, { createdAt: '2026-06-10T12:00:00.000Z', lastWornAt: wornAt }),
    ], { items: [] });
    expect(result?.outfit.id).toBe(2);
  });
});
