import {
  buildDailyLookContextRevision,
  buildDailyLookResolveInput,
  reconcileSavedDailyLookContext,
  resolveDailyLookPresentation,
  shoppingPriorityFromDailyLookGap,
} from '../dailyLookPresentation';
import type { DailyLookCandidate } from '../../hooks/useDailyLook';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';

const ownedOutfit: Outfit = {
  id: 10,
  userId: 1,
  name: 'Owned look',
  description: null,
  event: null,
  itemIds: [{ id: 1, category: 'top' }, { id: 2, category: 'bottom' }, { id: 3, category: 'shoes' }],
  tags: [],
  notes: null,
  isDraft: false,
  isFavorite: false,
  aiGeneratedImageUrl: null,
  wearCount: 0,
  lastWornAt: null,
  createdAt: '2026-08-18T12:00:00.000Z',
};

function candidate(readinessStatus: DailyLookCandidate['readinessStatus']): DailyLookCandidate {
  const gaps = readinessStatus === 'ready' ? [] : [
    {
      label: 'Loafers',
      category: 'shoes',
      reason: 'wardrobe_gap',
      context: 'Completes the look',
      priority: 1,
      unlocks: ['work outfits'],
      anchorItemIds: [1, 2],
    },
    ...(readinessStatus === 'priority' ? [{
      label: 'Shirt', category: 'top', reason: 'wardrobe_gap', context: 'Builds the core', priority: 2, unlocks: [], anchorItemIds: [2],
    }] : []),
  ];
  return {
    id: 7,
    userId: 1,
    localDate: '2026-08-18',
    status: 'active',
    readinessStatus,
    trigger: 'event_gap',
    eventId: null,
    name: 'Client-ready foundation',
    reason: 'For the client dinner',
    stylistNotes: null,
    itemIds: readinessStatus === 'ready' ? ownedOutfit.itemIds : [],
    foundationItemIds: readinessStatus === 'ready' ? [] : ownedOutfit.itemIds.slice(0, 2),
    missingEssentials: gaps,
    contextHash: 'context',
    aiGeneratedImageUrl: null,
    compositionHash: null,
    recommendationId: null,
    savedOutfitId: null,
    imageAttempts: 0,
    createdAt: '2026-08-18T12:00:00.000Z',
    updatedAt: '2026-08-18T12:00:00.000Z',
  };
}

const base = {
  premium: true,
  shouldResolve: true,
  fetching: false,
  rankedOutfit: ownedOutfit,
  rankedReason: 'Ranked reason',
  fallbackOutfits: [{ outfit: ownedOutfit, reason: 'Approved fallback' }],
};

describe('daily look presentation', () => {
  it.each(['ready', 'incomplete', 'priority'] as const)('presents a valid %s candidate', (readinessStatus) => {
    const presentation = resolveDailyLookPresentation({
      ...base,
      response: { outcome: 'candidate', candidate: candidate(readinessStatus) },
    });
    expect(presentation.kind).toBe(readinessStatus);
  });

  it('uses only the server-approved fallback after a failed resolution', () => {
    expect(resolveDailyLookPresentation({
      ...base,
      response: { outcome: 'failed', candidate: null, fallbackOutfitId: ownedOutfit.id },
    })).toMatchObject({ kind: 'owned', source: 'fallback', outfit: ownedOutfit });
    expect(resolveDailyLookPresentation({
      ...base,
      response: { outcome: 'failed', candidate: null },
    }).kind).toBe('empty');
  });

  it('uses a validated fallback for a dismissed recommendation', () => {
    expect(resolveDailyLookPresentation({
      ...base,
      response: { outcome: 'dismissed', candidate: null, fallbackOutfitId: ownedOutfit.id },
    })).toMatchObject({ kind: 'owned', source: 'fallback' });
  });

  it('shows loading before a resolution arrives and empty afterward without a candidate', () => {
    expect(resolveDailyLookPresentation({ ...base, fetching: true }).kind).toBe('loading');
    expect(resolveDailyLookPresentation({
      ...base,
      response: { outcome: 'none', candidate: null },
    }).kind).toBe('empty');
  });

  it('keeps a newly saved ready outfit authoritative', () => {
    expect(resolveDailyLookPresentation({
      ...base,
      savedOutfit: ownedOutfit,
      response: { outcome: 'candidate', candidate: candidate('ready') },
    })).toMatchObject({ kind: 'owned', source: 'saved' });
  });

  it('restores a previously saved candidate as an owned outfit', () => {
    const savedCandidate = candidate('ready');
    savedCandidate.status = 'saved';
    savedCandidate.savedOutfitId = ownedOutfit.id;
    expect(resolveDailyLookPresentation({
      ...base,
      response: { outcome: 'candidate', candidate: savedCandidate },
    })).toMatchObject({ kind: 'owned', source: 'saved', outfit: ownedOutfit });
  });

  it('preserves the ranked owned-outfit experience for free users', () => {
    expect(resolveDailyLookPresentation({ ...base, premium: false }).kind).toBe('owned');
  });

  it('does not let premium users bypass server validation with a client-ranked outfit', () => {
    expect(resolveDailyLookPresentation({
      ...base,
      response: { outcome: 'none', candidate: null },
    }).kind).toBe('empty');
  });

  it('rejects malformed incomplete and priority candidates', () => {
    const malformed = candidate('incomplete');
    malformed.foundationItemIds = [];
    expect(resolveDailyLookPresentation({ ...base, response: { outcome: 'candidate', candidate: malformed } }).kind).toBe('empty');

    const malformedReady = candidate('ready');
    malformedReady.itemIds = [];
    expect(resolveDailyLookPresentation({ ...base, response: { outcome: 'candidate', candidate: malformedReady } }).kind).toBe('empty');
  });
});

describe('daily look context revision', () => {
  const item = {
    id: 1,
    category: 'top',
    condition: 'good',
    isArchived: false,
    warmthRating: 2,
    seasons: ['summer'],
    occasions: ['casual'],
  } as Item;

  it('is stable across collection order', () => {
    const first = buildDailyLookContextRevision({ items: [item], outfits: [ownedOutfit], events: [] });
    const second = buildDailyLookContextRevision({ items: [item], outfits: [ownedOutfit], events: [] });
    expect(first).toBe(second);
  });

  it('changes when wardrobe wearability changes', () => {
    const active = buildDailyLookContextRevision({ items: [item], outfits: [ownedOutfit], events: [] });
    const archived = buildDailyLookContextRevision({ items: [{ ...item, isArchived: true }], outfits: [ownedOutfit], events: [] });
    expect(active).not.toBe(archived);
  });

  it('keeps upcoming-event and weather context when no-saved-look trigger wins', () => {
    const weather = {
      current: { condition: 'rainy' as const, temperatureC: 8, temperatureF: 46, summary: 'Cold rain' },
      forecast: { condition: 'rainy' as const, tempMaxC: 9, tempMinC: 5, tempMaxF: 48, tempMinF: 41 },
    };
    const input = buildDailyLookResolveInput({
      decision: { shouldGenerate: true, shouldResolve: true, trigger: 'no_saved_looks', eventId: 44 },
      localDate: '2026-08-18',
      timezone: 'America/Toronto',
      items: [item],
      outfits: [],
      events: [],
      weather,
      history: [],
      rankedOutfitIds: [],
      currentOutfitId: null,
    });

    expect(input).toMatchObject({
      trigger: 'no_saved_looks',
      eventId: 44,
      weather: { condition: 'rainy', temperatureC: 8, summary: 'Cold rain' },
    });
  });
});

describe('daily look shopping handoff', () => {
  it('preserves weather reason and every structured gap field', () => {
    const gap = {
      label: 'Raincoat',
      category: 'outerwear',
      reason: 'weather',
      context: 'For today’s rain',
      priority: 1,
      unlocks: ['Rainy workdays'],
      anchorItemIds: [1, 2],
      formality: 'smart casual',
      silhouette: 'streamlined',
      material: 'water resistant cotton',
      preferredColors: ['navy', 'stone'],
    };

    expect(shoppingPriorityFromDailyLookGap(gap)).toEqual(gap);
  });

  it('normalizes unsupported model reasons without dropping optional fields', () => {
    expect(shoppingPriorityFromDailyLookGap({
      label: 'Loafers',
      category: 'shoes',
      reason: 'unknown_reason',
      context: 'Completes the core',
      priority: 1,
      anchorItemIds: [2],
    })).toMatchObject({ reason: 'wardrobe_gap', anchorItemIds: [2] });
  });
});

describe('saved daily look context', () => {
  const pending = {
    sourceRevision: 'before-save',
    targetRevision: 'after-save',
    targetObserved: false,
  };

  it('allows only the expected save transition before locking to its target context', () => {
    expect(reconcileSavedDailyLookContext(pending, 'before-save')).toBe('keep');
    expect(reconcileSavedDailyLookContext(pending, 'after-save')).toBe('observe_target');
    expect(reconcileSavedDailyLookContext({ ...pending, targetObserved: true }, 'after-save')).toBe('keep');
  });

  it('clears the override for later wardrobe, event, weather, or location revisions', () => {
    expect(reconcileSavedDailyLookContext(pending, 'unrelated-change')).toBe('clear');
    expect(reconcileSavedDailyLookContext({ ...pending, targetObserved: true }, 'before-save')).toBe('clear');
  });
});
