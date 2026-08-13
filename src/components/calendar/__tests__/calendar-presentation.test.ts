jest.mock('../../../lib/api', () => ({
  API_BASE_URL: 'https://api.styled.test',
}));

import { presentCalendarEvent, presentEventLook, presentEventNotes } from '../calendar-presentation';
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
