import {
  SHOPPING_VISIT_EXPIRY_MS,
  SHOPPING_VISIT_RESUME_PROMPT_MS,
  evaluateShoppingVisitResume,
} from '../shoppingVisit';
import type { ShoppingSessionContext } from '../../stores/useShoppingSessionStore';

const now = Date.parse('2026-08-07T16:00:00.000Z');

function visit(overrides: Partial<ShoppingSessionContext> = {}): ShoppingSessionContext {
  return {
    id: 'visit-a',
    storeLocationId: null,
    storeName: 'Aritzia',
    branchLabel: null,
    latitude: null,
    longitude: null,
    locationAccuracyMeters: null,
    locality: null,
    region: null,
    countryCode: null,
    locationHint: null,
    locationSource: 'unavailable',
    locationStatus: 'unavailable',
    locationCapturedAt: null,
    startedAt: now - 60_000,
    lastActivityAt: now - 60_000,
    pausedAt: now - 60_000,
    endedAt: null,
    lifecycleStatus: 'paused',
    ...overrides,
  };
}

describe('shopping visit resume lifecycle', () => {
  it('resumes quickly without prompting', () => {
    expect(evaluateShoppingVisitResume(visit(), 1, now)).toBe('resume');
  });

  it('prompts after fifteen minutes', () => {
    expect(evaluateShoppingVisitResume(visit({
      pausedAt: now - SHOPPING_VISIT_RESUME_PROMPT_MS,
    }), 1, now)).toBe('prompt');
  });

  it('expires after four hours even if an earlier prompt was unanswered', () => {
    const promptedVisit = visit({ pausedAt: now - 20 * 60_000 });
    expect(evaluateShoppingVisitResume(promptedVisit, 1, now)).toBe('prompt');
    expect(evaluateShoppingVisitResume(
      promptedVisit,
      1,
      now + SHOPPING_VISIT_EXPIRY_MS,
    )).toBe('expire');
  });

  it('discards empty storeless visits', () => {
    expect(evaluateShoppingVisitResume(visit({ storeName: null }), 0, now)).toBe('expire');
  });
});
