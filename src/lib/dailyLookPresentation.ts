import type { DailyLookCandidate, DailyLookMissingEssential, DailyLookResolveInput, DailyLookResolveResponse } from '../hooks/useDailyLook';
import type { TodayWeather } from '../hooks/useWeather';
import type { DailyLookGenerationDecision, DailyPickHistoryEntry } from './dailyStylistPick';
import type { Event } from '../types/event';
import type { Item } from '../types/item';
import type { Outfit } from '../types/outfit';
import type { ShoppingBriefPriority, ShoppingBriefReason } from './shopDecisionWorkspace';

export type DailyLookPresentation =
  | { kind: 'ready'; candidate: DailyLookCandidate }
  | { kind: 'incomplete'; candidate: DailyLookCandidate; gap: DailyLookMissingEssential }
  | { kind: 'priority'; candidate: DailyLookCandidate; gap: DailyLookMissingEssential }
  | { kind: 'owned'; outfit: Outfit; reason: string; source: 'ranked' | 'fallback' | 'saved' }
  | { kind: 'loading' }
  | { kind: 'empty' };

type PresentationInput = {
  premium: boolean;
  shouldResolve: boolean;
  fetching: boolean;
  response?: DailyLookResolveResponse;
  rankedOutfit?: Outfit | null;
  rankedReason?: string;
  fallbackOutfits: Array<{ outfit: Outfit; reason: string }>;
  savedOutfit?: Outfit | null;
  savedReason?: string;
};

export function resolveDailyLookPresentation({
  premium,
  shouldResolve,
  fetching,
  response,
  rankedOutfit,
  rankedReason = 'Today’s Look',
  fallbackOutfits,
  savedOutfit,
  savedReason = 'Today’s Look',
}: PresentationInput): DailyLookPresentation {
  if (savedOutfit) return { kind: 'owned', outfit: savedOutfit, reason: savedReason, source: 'saved' };

  if (!premium || !shouldResolve) {
    return rankedOutfit
      ? { kind: 'owned', outfit: rankedOutfit, reason: rankedReason, source: 'ranked' }
      : { kind: 'empty' };
  }

  const candidate = response?.outcome === 'candidate' && response.candidate?.status === 'active'
    ? response.candidate
    : null;
  const previouslySaved = response?.outcome === 'candidate' && response.candidate?.status === 'saved'
    ? fallbackOutfits.find((entry) => entry.outfit.id === response.candidate?.savedOutfitId)
    : undefined;
  if (previouslySaved) {
    return {
      kind: 'owned',
      outfit: previouslySaved.outfit,
      reason: response?.candidate?.reason ?? previouslySaved.reason,
      source: 'saved',
    };
  }
  if (candidate?.readinessStatus === 'ready' && candidate.itemIds.length > 0) return { kind: 'ready', candidate };
  if (
    candidate?.readinessStatus === 'incomplete'
    && candidate.foundationItemIds.length > 0
    && candidate.missingEssentials.length === 1
  ) {
    return { kind: 'incomplete', candidate, gap: candidate.missingEssentials[0] };
  }
  if (candidate?.readinessStatus === 'priority' && candidate.missingEssentials.length >= 2) {
    return { kind: 'priority', candidate, gap: candidate.missingEssentials[0] };
  }

  const fallback = response?.fallbackOutfitId == null
    ? undefined
    : fallbackOutfits.find((entry) => entry.outfit.id === response.fallbackOutfitId);
  if (fallback) return { kind: 'owned', outfit: fallback.outfit, reason: fallback.reason, source: 'fallback' };
  if (fetching && !response) return { kind: 'loading' };
  return { kind: 'empty' };
}

type ContextRevisionInput = {
  items: Item[];
  outfits: Outfit[];
  events: Event[];
  weather?: TodayWeather;
  location?: { source?: 'current' | 'home' | 'destination' | 'conversation'; label?: string; lat?: number; lon?: number };
};

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildDailyLookContextRevision({ items, outfits, events, weather, location }: ContextRevisionInput): string {
  const payload = {
    items: [...items]
      .sort((a, b) => a.id - b.id)
      .map((item) => [
        item.id,
        item.category,
        item.condition,
        item.isArchived,
        item.warmthRating,
        item.colorNormalized,
        item.style,
        item.fit,
        item.material,
        item.sleeveLength,
        item.isFavorite,
        item.wearCount,
        item.lastWornAt,
        [...item.seasons].sort(),
        [...item.occasions].sort(),
      ]),
    outfits: [...outfits]
      .sort((a, b) => a.id - b.id)
      .map((outfit) => [
        outfit.id,
        outfit.isDraft,
        outfit.isFavorite,
        outfit.wearCount,
        outfit.lastWornAt,
        outfit.event,
        [...outfit.tags].sort(),
        [...outfit.itemIds].sort((a, b) => a.id - b.id).map((entry) => [entry.id, entry.category]),
      ]),
    events: [...events]
      .sort((a, b) => a.id - b.id)
      .map((event) => [event.id, event.date, event.title, event.occasion, event.location, event.outfitId]),
    weather: weather ? [
      weather.current.condition,
      Math.round(weather.current.temperatureC / 3) * 3,
    ] : null,
    location: location ? [
      location.source,
      location.label,
      location.lat == null ? null : Math.round(location.lat * 100) / 100,
      location.lon == null ? null : Math.round(location.lon * 100) / 100,
    ] : null,
  };
  return stableHash(JSON.stringify(payload));
}

type ResolveInputBuilder = ContextRevisionInput & {
  decision: DailyLookGenerationDecision;
  localDate: string;
  timezone: string;
  history: DailyPickHistoryEntry[];
  rankedOutfitIds: number[];
  currentOutfitId?: number | null;
};

export function buildDailyLookResolveInput({
  decision,
  localDate,
  timezone,
  location,
  weather,
  history,
  rankedOutfitIds,
  currentOutfitId,
  items,
  outfits,
  events,
}: ResolveInputBuilder): DailyLookResolveInput | null {
  if (!decision.shouldResolve || !decision.trigger) return null;
  return {
    localDate,
    timezone,
    location,
    weather: weather ? {
      condition: weather.current.condition,
      temperatureC: weather.current.temperatureC,
      summary: weather.current.summary,
    } : undefined,
    trigger: decision.trigger,
    eventId: decision.eventId,
    recentOutfitIds: history
      .filter((entry) => entry.date !== localDate)
      .slice(0, 7)
      .map((entry) => entry.outfitId),
    fallbackOutfitIds: rankedOutfitIds.slice(0, 30),
    clientContextRevision: buildDailyLookContextRevision({ items, outfits, events, weather, location }),
    currentOutfitId: currentOutfitId ?? null,
  };
}

type ShoppingGapInput = Pick<DailyLookMissingEssential, 'label' | 'category' | 'reason' | 'context' | 'priority'>
  & Partial<Pick<DailyLookMissingEssential, 'unlocks' | 'anchorItemIds' | 'formality' | 'silhouette' | 'material' | 'preferredColors'>>;

export function shoppingPriorityFromDailyLookGap(gap: ShoppingGapInput): ShoppingBriefPriority {
  const supportedReasons = new Set<ShoppingBriefReason>(['weather', 'occasion', 'wardrobe_gap', 'ratio_imbalance']);
  return {
    label: gap.label,
    category: gap.category,
    reason: supportedReasons.has(gap.reason as ShoppingBriefReason)
      ? gap.reason as ShoppingBriefReason
      : 'wardrobe_gap',
    context: gap.context,
    priority: gap.priority,
    unlocks: gap.unlocks ?? [],
    anchorItemIds: gap.anchorItemIds,
    formality: gap.formality,
    silhouette: gap.silhouette,
    material: gap.material,
    preferredColors: gap.preferredColors,
  };
}

export type SavedDailyLookContext = {
  sourceRevision: string;
  targetRevision: string;
  targetObserved: boolean;
};

export function reconcileSavedDailyLookContext(
  savedContext: SavedDailyLookContext,
  currentRevision: string,
): 'keep' | 'observe_target' | 'clear' {
  if (currentRevision === savedContext.targetRevision) {
    return savedContext.targetObserved ? 'keep' : 'observe_target';
  }
  if (!savedContext.targetObserved && currentRevision === savedContext.sourceRevision) return 'keep';
  return 'clear';
}
