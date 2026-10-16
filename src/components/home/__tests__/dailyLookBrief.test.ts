import { resolveCandidateBrief, candidatePieceIds } from '../dailyLookCopy';
import type { DailyLookBrief, DailyLookCandidate } from '../../../hooks/useDailyLook';

const base = {
  id: 1, userId: 1, localDate: '2026-10-15', status: 'active', trigger: 'weather_gap', eventId: null,
  name: 'One Piece Away', reason: 'A polished layer for today’s rain', stylistNotes: null,
  itemIds: [], readinessStatus: 'incomplete',
  foundationItemIds: [{ id: 1, category: 'top' }, { id: 2, category: 'bottom' }, { id: 3, category: 'shoes' }],
  missingEssentials: [], contextHash: null, aiGeneratedImageUrl: null, compositionHash: null,
  recommendationId: null, savedOutfitId: null, imageAttempts: 0, createdAt: '', updatedAt: '',
} as DailyLookCandidate;
const gap = { label: 'weatherproof_layer', category: 'outerwear', reason: 'weather', context: 'for today’s rain', priority: 1, unlocks: [], anchorItemIds: [] };

test('an incomplete look counts its owned foundation, never zero', () => {
  expect(candidatePieceIds(base)).toEqual([1, 2, 3]);
});

test('the server brief wins verbatim', () => {
  const server: DailyLookBrief = { mode: 'soft_gap', basis: 'Rain · low of 7°C', headline: 'White shirt, grey trousers and black derbies', line: 'Add a weatherproof layer — you don’t own one yet', pieceIds: [1, 2, 3], gap: { label: 'Weatherproof layer', category: 'outerwear', severity: 'soft' } };
  expect(resolveCandidateBrief(base, server, gap)).toBe(server);
});

test('older servers still get a coherent fallback', () => {
  const brief = resolveCandidateBrief(base, undefined, gap);
  expect(brief.mode).toBe('soft_gap');
  expect(brief.headline).toBe('Weatherproof layer');
  expect(brief.pieceIds).toEqual([1, 2, 3]);
});
