import { presentCalendarEvent, presentEventNotes } from '../calendar-presentation';
import type { Event } from '../../../types/event';

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
});
