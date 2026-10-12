import type { Item } from '../../types/item';
import type { StylistAssistantMessage, StylistResponseBlock } from './types';

/** Each child gets its own state and action identity; parent text is not repeated. */
export function messageForResponseBlock(parent: StylistAssistantMessage, block: StylistResponseBlock, index: number): StylistAssistantMessage {
  const base = { id: block.blockId ?? `${parent.id}:block:${index}`, role: 'assistant' as const, responseVersion: parent.responseVersion ?? 2 as const, kind: 'assistant' as const, text: block.text, isStreaming: false, recId: parent.recId };
  if (block.type === 'text') return { ...base, mode: 'advice', renderType: 'advice', suggestedItemIds: block.ownedItemIds };
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
  const ids = (value: unknown) => Array.isArray(value) && value.every(id => Number.isInteger(id) && id > 0);
  if (typeof block.text !== 'string') return false;
  const editorial = block.editorial;
  if (editorial && (editorial.version !== 1 || !['prose', 'look', 'products', 'comparison', 'checklist'].includes(editorial.kind) || !['owned', 'shopping', 'conceptual'].includes(editorial.origin) || !Array.isArray(editorial.actions) || editorial.actions.length > 3 || !editorial.actions.every(action => action && typeof action.label === 'string' && action.label.length <= 80 && typeof action.prompt === 'string' && action.prompt.length <= 1000))) return false;
  if (block.wardrobeItems !== undefined && (!Array.isArray(block.wardrobeItems) || !block.wardrobeItems.every(item => item && Number.isInteger(item.id) && item.id > 0 && typeof item.name === 'string'))) return false;
  if (block.type === 'text') return block.ownedItemIds === undefined || ids(block.ownedItemIds);
  if (block.type !== 'card' || !block.payload || typeof block.payload !== 'object') return false;
  const p = block.payload;
  if (p.checklist && (typeof p.checklist.title !== 'string' || typeof p.checklist.intro !== 'string' || !Array.isArray(p.checklist.entries) || !p.checklist.entries.length || p.checklist.entries.length > 20 || !p.checklist.entries.every(entry => entry && typeof entry.label === 'string' && typeof entry.detail === 'string'))) return false;
  if (p.itemIds !== undefined && !ids(p.itemIds)) return false;
  if (p.insight && (typeof p.insight.label !== 'string' || typeof p.insight.explanation !== 'string' || !ids(p.insight.supportingItemIds))) return false;
  if (p.tagSuggestions && (typeof p.tagSuggestions.rationale !== 'string' || !Array.isArray(p.tagSuggestions.tags) || !p.tagSuggestions.tags.length || p.tagSuggestions.tags.length > 5 || !p.tagSuggestions.tags.every(tag => typeof tag === 'string' && tag.length <= 80))) return false;
  return true;
}

export function responseBlockItemIds(blocks?: StylistResponseBlock[]): number[] {
  return [...new Set((blocks ?? []).flatMap(block => block.type === 'card' ? [
    ...(block.payload.itemIds ?? []),
    ...(block.payload.foundationItemIds ?? []),
    ...(block.payload.tripPlan?.outfits.flatMap(look => look.itemIds) ?? []),
    ...(block.payload.wardrobeAudit?.workhorses.map(item => item.itemId) ?? []),
    ...(block.payload.wardrobeAudit?.underused.map(item => item.itemId) ?? []),
  ] : block.ownedItemIds ?? []))];
}

/** Group only consecutive outfit cards, preserving surrounding editorial order. */
export function groupResponseBlocks(blocks: StylistResponseBlock[]): Array<{ blocks: StylistResponseBlock[]; start: number; carousel: boolean }> {
  const groups: Array<{ blocks: StylistResponseBlock[]; start: number; carousel: boolean }> = [];
  blocks.forEach((block, index) => {
    const outfit = block?.type === 'card' && (block.payload.mode === 'from_closet' || block.payload.mode === 'event_plan');
    const previous = groups[groups.length - 1];
    if (outfit && previous?.carousel) previous.blocks.push(block);
    else groups.push({ blocks: [block], start: index, carousel: !!outfit });
  });
  return groups;
}

/** Server-selected snapshots hydrate newly added pieces and supersede stale local names/images. */
export function mergeWardrobeEvidence(items: Item[], evidence?: Item[]): Item[] {
  if (!evidence?.length) return items;
  return [...new Map([...items, ...evidence].map(item => [item.id, item])).values()];
}
