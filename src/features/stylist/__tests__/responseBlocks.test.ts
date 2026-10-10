import { isResponseBlock, messageForResponseBlock } from '../responseBlocks';
import type { StylistAssistantMessage, StylistResponseBlock } from '../types';

const parent: StylistAssistantMessage = { id: 'turn', role: 'assistant', kind: 'assistant', renderType: 'text', text: 'Whole reply', recId: 7 };

test('mixed blocks keep independent identities and existing card actions', () => {
  const blocks: StylistResponseBlock[] = [
    { type: 'text', text: 'Compare these first.' },
    { type: 'card', text: 'The blue piece wins.', payload: { mode: 'advice', itemIds: [10, 11] } },
    { type: 'card', text: 'A complete look.', payload: { mode: 'from_closet', itemIds: [10, 12, 13], readinessStatus: 'ready', lookName: 'Blue hour', eventPlan: { candidateId: 'candidate', outfitName: 'Blue hour', stylistNotes: '', itemIds: [10, 12, 13], missingEssentials: [], recommendationId: 7 } } },
    { type: 'text', text: 'Finish with a rolled cuff.' },
  ];
  const mapped = blocks.map((block, index) => messageForResponseBlock(parent, block, index));
  expect(mapped.map(m => m.text)).toEqual(blocks.map(b => b.text));
  expect(new Set(mapped.map(m => m.id)).size).toBe(4);
  expect(mapped[1].suggestedItemIds).toEqual([10, 11]);
  expect(mapped[2].eventPlan?.candidateId).toBe('candidate');
  expect(mapped[2].recId).toBe(7);
  expect(mapped.every(m => !m.blocks)).toBe(true);
  const restored = JSON.parse(JSON.stringify({ responseVersion: 2, blocks }));
  expect(restored.blocks.map((block: StylistResponseBlock, index: number) => messageForResponseBlock(parent, block, index))).toEqual(mapped);
});

test('pending trip becomes a completed independent card and nullable legacy fields normalize', () => {
  const mapped = messageForResponseBlock(parent, { type: 'card', text: 'Pack light', payload: { mode: 'trip', lookName: null, recId: null, tripPlan: { intro: '', outfits: [], packingList: ['coat'], pending: true } } }, 0);
  expect(mapped.tripPlan?.pending).toBe(false);
  expect(mapped.lookName).toBeUndefined();
  expect(mapped.recId).toBe(7);
});

test('transport accepts supported blocks and rejects malformed events', () => {
  expect(isResponseBlock({ type: 'text', text: 'Hello' })).toBe(true);
  expect(isResponseBlock({ type: 'card', text: '', payload: { mode: 'advice' } })).toBe(true);
  expect(isResponseBlock({ type: 'unknown', text: '' })).toBe(false);
  expect(isResponseBlock({ type: 'card', text: '' })).toBe(false);
  expect(isResponseBlock(null)).toBe(false);
});
