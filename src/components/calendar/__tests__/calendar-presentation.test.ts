jest.mock('../../../lib/api', () => ({
  API_BASE_URL: 'https://api.styled.test',
}));

import { occasionDisplayLabel, presentCalendarEvent, presentEventLook, presentEventNotes, WEATHER_ICONS } from '../calendar-presentation';
import type { Event } from '../../../types/event';
import type { Item } from '../../../types/item';

const baseEvent: Event = {
  id: 1,
  userId: 1,
  title: 'Gallery opening',
  date: '2026-10-11T21:00:00.000Z',
  occasion: 'formal',
  location: 'Toronto, Ontario',
  notes: null,
  environment: 'Indoor',
  itemIds: null,
  outfitId: null,
};

describe('calendar presentation', () => {
  it('derives an outfit-readiness state without changing the event', () => {
    expect(presentCalendarEvent(baseEvent)).toEqual(expect.objectContaining({
      hasOutfit: false,
      readinessLabel: 'Needs outfit',
      readinessShortLabel: 'Needs outfit',
    }));
    expect(presentCalendarEvent({ ...baseEvent, itemIds: [4, 5] })).toEqual(expect.objectContaining({
      hasOutfit: true,
      readinessLabel: 'Outfit planned',
      readinessShortLabel: 'Planned',
    }));
  });

  // NextEventHero and the list rows both render monthLabel/dayLabel directly,
  // but nothing asserted their format before this — a midday UTC timestamp
  // keeps the case timezone-safe across CI runners.
  it('formats the hero date block as a short month and bare day number', () => {
    expect(presentCalendarEvent({ ...baseEvent, date: '2026-10-11T15:00:00.000Z' })).toEqual(
      expect.objectContaining({ monthLabel: 'OCT', dayLabel: '11' }),
    );
    expect(presentCalendarEvent({ ...baseEvent, date: '2026-01-05T15:00:00.000Z' })).toEqual(
      expect.objectContaining({ monthLabel: 'JAN', dayLabel: '5' }),
    );
  });

  // Shared between NextEventHero and EventDetailModal so the two surfaces
  // can't silently drift on which glyph a forecast condition gets.
  it('maps every weather condition to an icon', () => {
    expect(WEATHER_ICONS).toEqual({
      sunny: 'sunny-outline',
      rainy: 'rainy-outline',
      cold: 'snow-outline',
      mild: 'partly-sunny-outline',
    });
  });

  it('separates imported Google links from readable notes', () => {
    const notes = [
      'To see detailed information, use the official Google Calendar app. https://g.co/calendar',
      '',
      'This event was created from an email. https://mail.google.com/mail?extsrc=cal&plid=abc',
    ].join('\n');

    expect(presentEventNotes(notes)).toEqual({
      summary: 'To see detailed information, use the official Google Calendar app.\n\nThis event was created from an email.',
      links: [
        { url: 'https://g.co/calendar', label: 'Open in Google Calendar' },
        { url: 'https://mail.google.com/mail?extsrc=cal&plid=abc', label: 'Open in Gmail' },
      ],
      hasMore: true,
    });
  });

  it('deduplicates links and handles empty notes', () => {
    expect(presentEventNotes(null)).toEqual({ summary: null, links: [], hasMore: false });
    expect(presentEventNotes('Details https://example.com. Again https://example.com')).toEqual({
      summary: 'Details Again',
      links: [{ url: 'https://example.com', label: 'Open source link' }],
      hasMore: true,
    });
  });

  it('orders an event look by outfit hierarchy and preserves unavailable pieces', () => {
    const makeItem = (id: number, category: Item['category']): Item => ({
      id,
      name: `Piece ${id}`,
      userId: 1,
      imageUrl: `https://example.com/${id}.jpg`,
      cutoutUrl: null,
      polishedUrl: null,
      thumbUrl: null,
      coverImageVariant: 'original',
      color: null,
      colorPalette: [],
      colorNormalized: null,
      colorTemperature: null,
      category,
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
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const items = [
      makeItem(1, 'accessory'),
      makeItem(2, 'shoes'),
      makeItem(3, 'top'),
      makeItem(4, 'bottom'),
    ];

    const look = presentEventLook([1, 99, 2, 4, 3], items);

    expect(look.map((piece) => piece.itemId)).toEqual([3, 4, 2, 1, 99]);
    expect(look.at(-1)).toEqual(expect.objectContaining({
      itemId: 99,
      item: null,
      uri: undefined,
      ghost: true,
    }));
  });
});

describe('occasion display labels', () => {
  it('uses canonical labels and readable legacy values without changing stored identifiers', () => {
    expect(occasionDisplayLabel('professional')).toBe('Professional');
    expect(occasionDisplayLabel('garden_party')).toBe('Garden party');
    expect(occasionDisplayLabel('')).toBe('Occasion unspecified');
  });
});

describe('hero presentation', () => {
  const { heroCountdown, heroPrompt, isLookWornOn } = require('../calendar-presentation');
  const base = { id: 1, userId: 1, title: 'T', occasion: 'business', location: null, notes: null, environment: null, itemIds: null, outfitId: null };
  const now = new Date('2026-10-13T12:00:00');

  it('counts down in words', () => {
    expect(heroCountdown({ ...base, date: '2026-10-13T12:30:00' }, now)).toBe('In 30 min');
    expect(heroCountdown({ ...base, date: '2026-10-13T14:00:00' }, now)).toBe('In 2 hrs');
    expect(heroCountdown({ ...base, date: '2026-10-13T11:00:00' }, now)).toBe('Now');
    expect(heroCountdown({ ...base, date: '2026-10-14T09:00:00' }, now)).toBe('Tomorrow');
    expect(heroCountdown({ ...base, date: '2026-10-16T09:00:00' }, now)).toBe('In 3 days');
    const allDay = { calendarId: 'w', calendarName: 'W', allDay: true, allDayDate: '2026-10-13', cancelled: false, syncedAt: '' };
    expect(heroCountdown({ ...base, date: '2026-10-13T04:00:00Z', calendarMetadata: allDay }, now)).toBe('All day today');
  });

  it('leads with weather that changes the outfit, otherwise the occasion', () => {
    const forecast = (condition: string, max: number) => ({ condition, tempMaxC: max, tempMinC: max - 5, tempMaxF: Math.round(max * 1.8 + 32), tempMinF: 0 });
    expect(heroPrompt('business', forecast('rainy', 12))).toBe('12° and wet. Shoes and a layer that can take it.');
    expect(heroPrompt('business', forecast('mild', 5))).toBe('5° at best. Layer up, coat on top.');
    expect(heroPrompt('casual', forecast('sunny', 27), 'F')).toBe('81° and warm. Keep it light and breathable.');
    expect(heroPrompt('formal', forecast('mild', 15))).toBe('15°. Sharpen every detail.');
    expect(heroPrompt('business', null)).toBe('Polished, not stiff.');
    expect(heroPrompt('unknown_occasion', null)).toBe('Dressed for the occasion.');
  });

  it('matches a wear log to the same pieces on the same day in any order', () => {
    const logs = [{ date: '2026-10-13', itemIds: [3, 1, 2] }];
    expect(isLookWornOn(logs, [1, 2, 3], '2026-10-13')).toBe(true);
    expect(isLookWornOn(logs, [1, 2], '2026-10-13')).toBe(false);
    expect(isLookWornOn(logs, [1, 2, 3], '2026-10-14')).toBe(false);
    expect(isLookWornOn(logs, null, '2026-10-13')).toBe(false);
  });
});

describe('month lookbook and wear journal', () => {
  const { buildDayThumbs, groupWearLogsByDay } = require('../calendar-presentation');
  const item = (id: number, category: string, imageUrl: string) => ({ id, category, imageUrl });
  const ev = (id: number, date: string, itemIds: number[] | null) => ({ id, date, itemIds });
  const day = (event: { date: string }) => event.date.slice(0, 10);

  it('uses the lead piece of the first planned event of each day', () => {
    const items = new Map([
      [1, item(1, 'shoes', 'https://img/shoes.jpg')],
      [2, item(2, 'top', 'https://img/top.jpg')],
      [3, item(3, 'bottom', 'https://img/bottom.jpg')],
    ]);
    const thumbs = buildDayThumbs([
      ev(1, '2026-10-13T09:00:00', null),
      ev(2, '2026-10-13T12:00:00', [1, 2]),
      ev(3, '2026-10-13T18:00:00', [3]),
      ev(4, '2026-10-14T09:00:00', [99]),
    ], items, day);
    expect(thumbs.get('2026-10-13')).toBe('https://img/top.jpg');
    expect(thumbs.has('2026-10-14')).toBe(false);
  });

  it('groups plain dates and timestamps by local day', () => {
    const groups = groupWearLogsByDay([
      { date: '2026-10-13', itemIds: [1] },
      { date: '2026-10-13T15:00:00', itemIds: [2] },
      { date: '2026-10-12T09:00:00', itemIds: [3] },
    ]);
    expect(groups.get('2026-10-13')).toHaveLength(2);
    expect(groups.get('2026-10-12')).toHaveLength(1);
  });
});
