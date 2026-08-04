import type { Event } from '../../types/event';
import type { Item } from '../../types/item';
import { itemCoverPresentation } from '../../lib/itemImage';
import { getOutfitCategoryPriority } from '../outfits/outfitMosaic';

const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const TRAILING_URL_PUNCTUATION = /[),.;!?]+$/;

export type EventSourceLink = {
  url: string;
  label: string;
};

export type EventNotesPresentation = {
  summary: string | null;
  links: EventSourceLink[];
  hasMore: boolean;
};

export type CalendarEventPresentation = {
  hasOutfit: boolean;
  readinessLabel: 'Outfit planned' | 'Needs outfit';
  readinessShortLabel: 'Planned' | 'Needs outfit';
  monthLabel: string;
  dayLabel: string;
};

export type EventLookPiecePresentation = {
  key: string;
  itemId: number;
  item: Item | null;
  uri: string | undefined;
  contentFit: 'cover' | 'contain';
  ghost: boolean;
};

function sourceLabel(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'g.co' || host.includes('calendar.google.')) return 'Open in Google Calendar';
    if (host === 'mail.google.com' || host.includes('gmail.')) return 'Open in Gmail';
    return 'Open source link';
  } catch {
    return 'Open source link';
  }
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function presentEventNotes(notes: string | null | undefined): EventNotesPresentation {
  const original = notes?.trim() ?? '';
  if (!original) return { summary: null, links: [], hasMore: false };

  const links: EventSourceLink[] = [];
  const seen = new Set<string>();
  const withoutUrls = original.replace(URL_PATTERN, (match) => {
    const url = match.replace(TRAILING_URL_PUNCTUATION, '');
    if (!seen.has(url)) {
      seen.add(url);
      links.push({ url, label: sourceLabel(url) });
    }
    return '';
  });

  const summary = normalizeWhitespace(withoutUrls)
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/([:;,])\s*\n/g, '$1\n');

  return {
    summary: summary || null,
    links,
    hasMore: original.length > 220 || links.length > 0 || summary.length !== original.length,
  };
}

export function presentCalendarEvent(event: Event): CalendarEventPresentation {
  const date = new Date(event.date);
  const hasOutfit = (event.itemIds ?? []).length > 0;

  return {
    hasOutfit,
    readinessLabel: hasOutfit ? 'Outfit planned' : 'Needs outfit',
    readinessShortLabel: hasOutfit ? 'Planned' : 'Needs outfit',
    monthLabel: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    dayLabel: date.toLocaleDateString('en-US', { day: 'numeric' }),
  };
}

export function presentEventLook(
  itemIds: number[] | null | undefined,
  allItems: Item[],
): EventLookPiecePresentation[] {
  const itemMap = new Map(allItems.map((item) => [item.id, item]));

  return (itemIds ?? [])
    .map((itemId, originalIndex) => {
      const item = itemMap.get(itemId) ?? null;
      const cover = itemCoverPresentation(item);
      return {
        key: `${itemId}-${originalIndex}`,
        itemId,
        item,
        uri: cover.uri,
        contentFit: cover.contentFit,
        ghost: item === null,
        priority: getOutfitCategoryPriority(item?.category ?? null),
        originalIndex,
      };
    })
    .sort((a, b) => a.priority - b.priority || a.originalIndex - b.originalIndex)
    .map(({ priority: _priority, originalIndex: _originalIndex, ...piece }) => piece);
}
