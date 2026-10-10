import type { StylistAssistantMessage, StylistResponseBlock } from './types';

/** Each child gets its own state and action identity; parent text is not repeated. */
export function messageForResponseBlock(parent: StylistAssistantMessage, block: StylistResponseBlock, index: number): StylistAssistantMessage {
  const base = { id: `${parent.id}:block:${index}`, role: 'assistant' as const, kind: 'assistant' as const, text: block.text, isStreaming: false, recId: parent.recId };
  if (block.type === 'text') return { ...base, mode: 'advice', renderType: 'advice' };
  const p = block.payload;
  return {
    ...base, ...p, text: block.text,
    recId: p.recId ?? parent.recId,
    lookName: p.lookName ?? undefined,
    suggestedItemIds: p.itemIds,
    renderType: p.tripPlan ? 'trip_plan' : p.wardrobeAudit ? 'wardrobe_audit' : p.shopOutfit ? 'shopping_outfit' : p.mode === 'from_closet' || p.mode === 'event_plan' ? 'closet_outfit' : 'advice',
    tripPlan: p.tripPlan ? { ...p.tripPlan, pending: false } : undefined,
    eventPlan: p.eventPlan ?? undefined,
    shopOutfit: p.shopOutfit ?? undefined,
    wardrobeAudit: p.wardrobeAudit ?? undefined,
    critique: p.critique ?? undefined,
  };
}

export function isResponseBlock(value: unknown): value is StylistResponseBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Partial<StylistResponseBlock>;
  return typeof block.text === 'string' && (block.type === 'text' || (block.type === 'card' && !!block.payload && typeof block.payload === 'object'));
}

export function responseBlockItemIds(blocks?: StylistResponseBlock[]): number[] {
  return [...new Set((blocks ?? []).flatMap(block => block.type === 'card' ? [
    ...(block.payload.itemIds ?? []),
    ...(block.payload.foundationItemIds ?? []),
    ...(block.payload.tripPlan?.outfits.flatMap(look => look.itemIds) ?? []),
    ...(block.payload.wardrobeAudit?.workhorses.map(item => item.itemId) ?? []),
    ...(block.payload.wardrobeAudit?.underused.map(item => item.itemId) ?? []),
  ] : []))];
}
