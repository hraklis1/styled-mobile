import type { TodayWeather } from '../hooks/useWeather';
import type { OutfitLog } from '../hooks/useOutfitLogs';
import type { Event } from '../types/event';
import type { Item } from '../types/item';
import type { Outfit } from '../types/outfit';
import { parseEventDate } from './outfitAssignments';

export type DailyPickHistoryEntry = {
  date: string;
  outfitId: number;
};

export type DailyPickScoreDetails = {
  occasion: number;
  weather: number;
  favorite: number;
  rating: number;
  wearRotation: number;
  recentPickPenalty: number;
  total: number;
};

export type DailyStylistPick = {
  outfit: Outfit;
  reason: string;
  scoreDetails: DailyPickScoreDetails;
};

type SelectDailyStylistPickInput = {
  outfits: Outfit[];
  items: Item[];
  events: Event[];
  weather?: TodayWeather;
  logs: OutfitLog[];
  date: string;
  now?: Date;
  history: DailyPickHistoryEntry[];
};

const ZERO_SCORE: DailyPickScoreDetails = {
  occasion: 0,
  weather: 0,
  favorite: 0,
  rating: 0,
  wearRotation: 0,
  recentPickPenalty: 0,
  total: 0,
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function formatOccasion(value: string): string {
  return value.trim().replaceAll('_', ' ');
}

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextTodayEvent(events: Event[], now: Date, date: string): Event | undefined {
  return events
    .filter((event) => {
      const eventDate = parseEventDate(event.date);
      return toLocalDateKey(eventDate) === date && eventDate.getTime() >= now.getTime();
    })
    .sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime())[0];
}

function outfitItems(outfit: Outfit, itemMap: Map<number, Item>): Item[] {
  return outfit.itemIds.map((entry) => itemMap.get(entry.id)).filter((item): item is Item => !!item);
}

function exactItemSetRating(outfit: Outfit, logs: OutfitLog[]): number | null {
  const ids = [...new Set(outfit.itemIds.map((entry) => entry.id))].sort((a, b) => a - b);
  const matchingRatings = logs
    .filter((log) => log.rating != null)
    .filter((log) => {
      const logIds = [...new Set(log.itemIds)].sort((a, b) => a - b);
      return ids.length === logIds.length && ids.every((id, index) => id === logIds[index]);
    })
    .map((log) => log.rating as number);

  if (matchingRatings.length === 0) return null;
  return matchingRatings.reduce((sum, rating) => sum + rating, 0) / matchingRatings.length;
}

function scoreOccasion(outfit: Outfit, items: Item[], event?: Event): number {
  if (!event?.occasion) return 0;
  const occasion = normalize(event.occasion);
  if (outfit.event && normalize(outfit.event) === occasion) return 36;
  if (outfit.tags.some((tag) => normalize(tag) === occasion)) return 30;
  const matchingItems = items.filter((item) => item.occasions.some((value) => normalize(value) === occasion));
  if (matchingItems.length === 0) return 0;
  return Math.round(24 * (matchingItems.length / Math.max(items.length, 1)));
}

function scoreWeather(items: Item[], weather?: TodayWeather): number {
  if (!weather || items.length === 0) return 0;
  const temp = weather.current.temperatureC;
  const averageWarmth = items.reduce((sum, item) => sum + (item.warmthRating ?? 3), 0) / items.length;
  const hasOuterwear = items.some((item) => item.category === 'outerwear');
  const hasLongSleeve = items.some((item) => item.sleeveLength === 'long');
  const hasShortOrSleeveless = items.some((item) => item.sleeveLength === 'short' || item.sleeveLength === 'sleeveless');
  const seasons = new Set(items.flatMap((item) => item.seasons.map(normalize)));
  let score = 0;

  if (temp <= 8) {
    score += averageWarmth >= 3.5 ? 10 : -8;
    score += hasOuterwear ? 6 : -4;
    score += seasons.has('winter') ? 4 : 0;
  } else if (temp >= 24) {
    score += averageWarmth <= 2.5 ? 10 : -8;
    score += hasShortOrSleeveless ? 5 : 0;
    score += seasons.has('summer') ? 4 : 0;
  } else {
    score += averageWarmth >= 2 && averageWarmth <= 4 ? 8 : 0;
    score += hasLongSleeve || hasOuterwear ? 3 : 0;
    score += seasons.has('spring') || seasons.has('fall') ? 3 : 0;
  }

  if (weather.current.condition === 'rainy' && hasOuterwear) score += 3;
  return score;
}

function scoreWearRotation(outfit: Outfit, now: Date): number {
  if (!outfit.lastWornAt) return 12;
  const daysSinceWorn = Math.floor((now.getTime() - new Date(outfit.lastWornAt).getTime()) / 86_400_000);
  if (daysSinceWorn >= 30) return 10;
  if (daysSinceWorn >= 14) return 7;
  if (daysSinceWorn >= 7) return 3;
  if (daysSinceWorn >= 2) return 0;
  return -10;
}

function deterministicTieBreak(date: string, outfitId: number): number {
  let hash = 2166136261;
  for (const char of `${date}:${outfitId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isWithinPreviousSevenDays(entryDate: string, date: string): boolean {
  const current = new Date(`${date}T12:00:00`);
  const previous = new Date(`${entryDate}T12:00:00`);
  const days = Math.round((current.getTime() - previous.getTime()) / 86_400_000);
  return days >= 1 && days <= 7;
}

function reasonForPick(
  outfit: Outfit,
  details: DailyPickScoreDetails,
  weather: TodayWeather | undefined,
  event: Event | undefined,
): string {
  if (details.occasion > 0 && event) return `For today's ${formatOccasion(event.occasion)} plans`;
  if (details.weather > 0 && weather) {
    const temp = Math.round(weather.current.temperatureC);
    if (temp <= 8) return `Warm layers for ${temp}°C`;
    if (temp >= 24) return `Light layers for ${temp}°C`;
    return `Easy layers for ${temp}°C`;
  }
  if (details.wearRotation >= 7) return 'A fresh look for today';
  if (details.favorite > 0) return 'A favourite worth revisiting';
  if (details.rating > 0) return 'A look you loved';
  return outfit.event ? `Ready for ${formatOccasion(outfit.event)}` : 'Today’s edit';
}

export function selectDailyStylistPick({
  outfits,
  items,
  events,
  weather,
  logs,
  date,
  now = new Date(),
  history,
}: SelectDailyStylistPickInput): DailyStylistPick | null {
  const eligible = outfits.filter((outfit) => !outfit.isDraft);
  if (eligible.length === 0) return null;

  const nextTodayEvent = getNextTodayEvent(events, now, date);
  const assigned = nextTodayEvent?.outfitId == null
    ? undefined
    : eligible.find((outfit) => outfit.id === nextTodayEvent.outfitId);
  if (assigned && nextTodayEvent) {
    return {
      outfit: assigned,
      reason: `For ${nextTodayEvent.title.trim() || formatOccasion(nextTodayEvent.occasion)}`,
      scoreDetails: { ...ZERO_SCORE, occasion: 100, total: 100 },
    };
  }

  const itemMap = new Map(items.map((item) => [item.id, item]));
  const recentPickIds = new Set(
    history.filter((entry) => isWithinPreviousSevenDays(entry.date, date)).map((entry) => entry.outfitId),
  );
  const scoreOutfit = (outfit: Outfit): DailyPickScoreDetails => {
    const resolvedItems = outfitItems(outfit, itemMap);
    const rating = exactItemSetRating(outfit, logs);
    const details: DailyPickScoreDetails = {
      occasion: scoreOccasion(outfit, resolvedItems, nextTodayEvent),
      weather: scoreWeather(resolvedItems, weather),
      favorite: outfit.isFavorite ? 8 : 0,
      rating: rating == null ? 0 : rating >= 4 ? 8 : rating >= 3 ? 2 : -6,
      wearRotation: scoreWearRotation(outfit, now),
      recentPickPenalty: recentPickIds.has(outfit.id) ? -40 : 0,
      total: 0,
    };
    details.total = details.occasion + details.weather + details.favorite + details.rating
      + details.wearRotation + details.recentPickPenalty;
    return details;
  };

  const cached = history.find((entry) => entry.date === date);
  const cachedOutfit = cached ? eligible.find((outfit) => outfit.id === cached.outfitId) : undefined;
  if (cachedOutfit) {
    const details = scoreOutfit(cachedOutfit);
    return {
      outfit: cachedOutfit,
      reason: reasonForPick(cachedOutfit, details, weather, nextTodayEvent),
      scoreDetails: details,
    };
  }

  const scored = eligible.map((outfit) => {
    return { outfit, details: scoreOutfit(outfit) };
  });

  const allScoresEqual = scored.every((entry) => entry.details.total === scored[0].details.total);
  scored.sort((a, b) => {
    if (a.details.total !== b.details.total) return b.details.total - a.details.total;
    return deterministicTieBreak(date, b.outfit.id) - deterministicTieBreak(date, a.outfit.id);
  });

  const hasNoRankingContext = !nextTodayEvent && !weather && logs.length === 0 && history.length === 0 && items.length === 0;
  const selected = allScoresEqual && hasNoRankingContext
    ? [...scored].sort((a, b) => new Date(b.outfit.createdAt).getTime() - new Date(a.outfit.createdAt).getTime())[0]
    : scored[0];
  return {
    outfit: selected.outfit,
    reason: reasonForPick(selected.outfit, selected.details, weather, nextTodayEvent),
    scoreDetails: selected.details,
  };
}
