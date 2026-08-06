import {
  buildShopConsultationPrompt,
  buildShopStylistLaunch,
  latestShoppingSummary,
  parseShoppingBrief,
  selectActiveShoppingFinds,
  type ShoppingBrief,
} from '../shopDecisionWorkspace';
import type { ShoppingEditItem } from '../shoppingGallery';

function item(id: string, patch: Partial<ShoppingEditItem> = {}): ShoppingEditItem {
  const snap = {
    id: `${id}-snap`, imageUri: 'file://photo.jpg', storagePath: null, storeName: 'COS', storeLocationId: null,
    shoppingSessionId: 'session-1', captureGroupId: id, captureRole: 'garment' as const, captureSequence: 0,
    branchLabel: null, latitude: null, longitude: null, locationAccuracyMeters: null, locality: 'Toronto', region: 'Ontario',
    countryCode: 'CA', locationSource: null, extractedPrice: 100, rawOcrText: '', capturedAt: '2026-08-05T12:00:00.000Z',
    syncStatus: 'synced' as const, category: 'top', sizeLabel: null, colorLabel: null, materialLabel: null, notes: null,
    isFavorite: false, catalogStatus: 'considering' as const,
  };
  return {
    id, captureGroupId: id, snaps: [snap], primarySnap: snap, tagSnaps: [], photoCount: 1,
    storeName: 'COS', storeLocationId: null, branchLabel: null, locality: 'Toronto', region: 'Ontario', extractedPrice: 100,
    capturedAt: snap.capturedAt, syncStatus: 'synced', needsReview: false, reviewReasons: [], category: 'top', sizeLabel: null,
    colorLabel: null, materialLabel: null, notes: null, isFavorite: false, catalogStatus: 'considering', ...patch,
  };
}

describe('shop decision workspace', () => {
  const brief: ShoppingBrief = {
    status: 'ready',
    headline: 'Strengthen winter and formal coverage',
    summary: 'A few targeted additions would improve occasion coverage.',
    generatedAt: '2026-08-05T12:00:00.000Z',
    source: 'model',
    priorities: [
      { label: 'formal shoes', category: 'shoes', reason: 'occasion', context: 'Limited formal options', priority: 1, unlocks: ['formal'] },
      { label: 'winter tops', category: 'tops', reason: 'weather', context: 'Limited cold-weather options', priority: 2, unlocks: ['winter'] },
    ],
  };

  it('builds deliberate consultation prompts and leaves non-AI routes prompt-free', () => {
    expect(buildShopConsultationPrompt('next_purchase')).toContain('single purchase');
    expect(buildShopConsultationPrompt('focused_list')).toContain('no more than five additions');
    expect(buildShopConsultationPrompt('review_find')).toBeUndefined();
    expect(buildShopConsultationPrompt('custom')).toBeUndefined();
  });

  it('grounds a Shopping Brief review in the current brief', () => {
    expect(buildShopConsultationPrompt('brief_review', brief)).toBe(
      'Review my current Shopping Brief. It says: "Strengthen winter and formal coverage" A few targeted additions would improve occasion coverage. Priorities: formal shoes, winter tops. Pressure-test these priorities, remove anything unnecessary, and tell me what to address first.',
    );
  });

  it('uses a wardrobe-based fallback when the Shopping Brief is unavailable', () => {
    expect(buildShopConsultationPrompt('brief_review')).toBe(
      'Review my current wardrobe and pressure-test my shopping priorities. Remove anything unnecessary and tell me what, if anything, to address first.',
    );
  });

  it('marks decision advice explicitly while preserving deliberate new-outfit shopping', () => {
    expect(buildShopStylistLaunch('Should I buy this?')).toEqual({
      initialQuery: 'Should I buy this?',
      initialMode: 'advice',
      source: 'shop',
    });
    expect(buildShopStylistLaunch('Shop for a new outfit', 'shop_new').initialMode).toBe('shop_new');
  });
  it('keeps active finds and prioritizes favorites, shortlist status, then recency', () => {
    const result = selectActiveShoppingFinds([
      item('passed', { catalogStatus: 'passed' }),
      item('new', { capturedAt: '2026-08-05T15:00:00.000Z' }),
      item('wish', { catalogStatus: 'wishlist' }),
      item('favorite', { isFavorite: true }),
    ]);
    expect(result.map((entry) => entry.id)).toEqual(['favorite', 'wish', 'new']);
  });

  it('summarizes the latest session and known spend', () => {
    const summary = latestShoppingSummary([item('one'), item('two', { extractedPrice: 60 })]);
    expect(summary).toMatchObject({ storeName: 'COS', itemCount: 2, knownSpend: 160 });
  });

  it('returns null without shopping history', () => {
    expect(latestShoppingSummary([])).toBeNull();
  });

  it('rejects a malformed brief instead of exposing missing fields to the screen', () => {
    expect(() => parseShoppingBrief({ status: 'ready', headline: 'Incomplete' })).toThrow('Invalid Shopping Brief');
  });
});
