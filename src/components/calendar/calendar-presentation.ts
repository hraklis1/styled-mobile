import type { Ionicons } from '@expo/vector-icons';
import type { Event } from '../../types/event';
import type { Item } from '../../types/item';
import type { ForecastWeather, WeatherCondition } from '../../hooks/useWeather';
import { OCCASIONS } from './calendarUtils';
import { itemCoverPresentation } from '../../lib/itemImage';
import { getOutfitCategoryPriority } from '../outfits/outfitMosaic';

const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const TRAILING_URL_PUNCTUATION = /[),.;!?]+$/;

// Shared between NextEventHero and EventDetailModal so the two surfaces never
// drift on which glyph a forecast condition gets.
export const WEATHER_ICONS: Record<WeatherCondition, keyof typeof Ionicons.glyphMap> = {
  sunny: 'sunny-outline',
  rainy: 'rainy-outline',
  cold: 'snow-outline',
  mild: 'partly-sunny-outline',
};

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

/** Display-only normalisation; stored occasion identifiers remain unchanged. */
export function occasionDisplayLabel(occasion: string): string {
  const label = OCCASIONS.find((entry) => entry.id === occasion)?.label;
  if (label) return label;
  const readable = occasion.replace(/[_-]+/g, ' ').trim();
  return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : 'Occasion unspecified';
}

/**
 * The hero's overline: how soon, in words. Timed events count down in hours
 * on the day itself; all-day events never pretend to have a start time.
 */
export function heroCountdown(event: Event, now = new Date()): string {
  const day = event.calendarMetadata?.allDay && event.calendarMetadata.allDayDate
    ? event.calendarMetadata.allDayDate
    : localDay(new Date(event.date));
  const today = localDay(now);
  const dayDiff = Math.round((new Date(`${day}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
  if (event.calendarMetadata?.allDay) {
    if (dayDiff === 0) return 'All day today';
    if (dayDiff === 1) return 'Tomorrow';
    return `In ${dayDiff} days`;
  }
  const minutes = Math.round((new Date(event.date).getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return 'Now';
  if (dayDiff === 0) {
    if (minutes < 60) return `In ${minutes} min`;
    const hours = Math.round(minutes / 60);
    return `In ${hours} hr${hours === 1 ? '' : 's'}`;
  }
  if (dayDiff === 1) return 'Tomorrow';
  return `In ${dayDiff} days`;
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const OCCASION_PROMPTS: Record<string, string> = {
  casual: 'Easy pieces, still put together.',
  smart_casual: 'Relaxed, with one sharp piece.',
  business: 'Polished, not stiff.',
  formal: 'Sharpen every detail.',
  party: 'Room for one statement piece.',
  workout: 'Built to move.',
};

/**
 * One line of styling direction for the hero. The forecast leads when it
 * should change what you wear; otherwise the occasion sets the tone.
 */
export function heroPrompt(
  occasion: string,
  forecast: Pick<ForecastWeather, 'condition' | 'tempMaxC' | 'tempMinC' | 'tempMaxF' | 'tempMinF'> | null | undefined,
  unit: 'C' | 'F' = 'C',
): string {
  const occasionLine = OCCASION_PROMPTS[occasion] ?? 'Dressed for the occasion.';
  if (!forecast) return occasionLine;
  const high = Math.round(unit === 'C' ? forecast.tempMaxC : forecast.tempMaxF);
  if (forecast.condition === 'rainy') return `${high}° and wet. Shoes and a layer that can take it.`;
  if (forecast.condition === 'cold' || forecast.tempMaxC < 8) return `${high}° at best. Layer up, coat on top.`;
  if (forecast.tempMaxC >= 24) return `${high}° and warm. Keep it light and breathable.`;
  return `${high}°. ${occasionLine}`;
}

/** The hero's weather line, only when the day's weather changes what to wear. */
export function heroWeatherNote(
  forecast: Pick<ForecastWeather, 'condition' | 'tempMaxC' | 'tempMinC' | 'tempMaxF' | 'tempMinF'> | null | undefined,
  unit: 'C' | 'F' = 'C',
): string | null {
  if (!forecast) return null;
  const notable = forecast.condition === 'rainy' || forecast.condition === 'cold'
    || forecast.tempMaxC < 8 || forecast.tempMaxC >= 24;
  return notable ? heroPrompt('', forecast, unit) : null;
}

/** Whether a wear log already records this look on the event's day. */
export function isLookWornOn(
  logs: { date: string; itemIds: number[] }[],
  itemIds: number[] | null | undefined,
  day: string,
): boolean {
  if (!itemIds?.length) return false;
  const look = [...itemIds].sort().join(',');
  return logs.some((log) => (log.date.slice(0, 10) === day || localDay(new Date(log.date)) === day)
    && [...log.itemIds].sort().join(',') === look);
}

/**
 * The image that stands for a planned day in the month grid: the lead piece
 * (by outfit category priority) of the day's first planned event.
 */
export function buildDayThumbs(
  events: Event[],
  itemsById: Map<number, Item>,
  dayKey: (event: Event) => string,
): Map<string, string> {
  const thumbs = new Map<string, string>();
  for (const event of events) {
    const day = dayKey(event);
    if (thumbs.has(day) || !event.itemIds?.length) continue;
    const lead = event.itemIds
      .map((id) => itemsById.get(id))
      .filter((item): item is Item => !!item)
      .sort((a, b) => getOutfitCategoryPriority(a.category ?? null) - getOutfitCategoryPriority(b.category ?? null))
      .map((item) => itemCoverPresentation(item).uri)
      .find(Boolean);
    if (lead) thumbs.set(day, lead);
  }
  return thumbs;
}

/** Wear logs grouped by the local day they record. */
export function groupWearLogsByDay<T extends { date: string }>(logs: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const log of logs) {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(log.date) ? log.date : localDay(new Date(log.date));
    const group = map.get(day);
    if (group) group.push(log);
    else map.set(day, [log]);
  }
  return map;
}
