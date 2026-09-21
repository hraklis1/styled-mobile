import type { ShoppingBriefPriority } from './shopDecisionWorkspace';

export const OUTFIT_ESTIMATE_EXPLANATION = 'Estimated additional combinations with your current wardrobe. Individual pieces may work differently.';

export function potentialOutfitCount(count?: number): string | null {
  return typeof count === 'number' && Number.isFinite(count) && count > 0
    ? `${count.toLocaleString()} potential outfit combination${count === 1 ? '' : 's'}`
    : null;
}

export function priorityOccasionLabel(priority: ShoppingBriefPriority): string | null {
  if (priority.eventTitle?.trim()) return `For ${priority.eventTitle.trim()}`;
  if (priority.scope === 'event' || priority.kind === 'occasion') return 'For your upcoming occasion';
  return priority.unlocks.map((value) => {
    const label = value.trim().replace(/^meet the (.+) dress code[.!]?$/i, '$1 occasions');
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
  }).filter(Boolean).join(' · ') || null;
}

export function shoppingGuideIntro(count: number): string {
  const number = ['Zero', 'One', 'Two', 'Three'][count] ?? String(count);
  return `${number} style${count === 1 ? '' : 's'} to look for, with suggested budgets and outfit ideas.`;
}

export function shoppingPriorityRoute(priority: ShoppingBriefPriority, generatedAt: string) {
  return { priority, origin: 'shopping_brief' as const, briefGeneratedAt: generatedAt };
}

/** Clarify computed counts in existing prose without rewriting unrelated model text. */
export function clarifyOutfitClaims(text: string, count?: number): string {
  const label = potentialOutfitCount(count);
  if (!label) return text;
  return text.replace(new RegExp(`\\b${count}\\s+new\\s+outfits?\\b`, 'gi'), label);
}

const STOP_WORDS = new Set(['everyday', 'formal', 'casual', 'versatile', 'smart', 'evening', 'or', 'and', 'the', 'a', 'an', 'for', 'with', 'of']);

/** Crude singular for matching: "sneakers" ~ "sneaker", "dresses" ~ "dress". */
function stem(word: string): string {
  return word.replace(/(ies|es|s)$/u, (suffix) => (suffix === 'ies' ? 'y' : ''));
}

/**
 * The brief priority a shortlist find most plausibly fills, or null. Both
 * sides are free text — the priority's category is the server's coarse noun
 * ("shoes"), its label is the stylist's phrase ("everyday leather sneakers"),
 * and the find's category/name are whatever the user or classifier wrote —
 * so this is a word-overlap match on the garment nouns, deliberately loose:
 * a wrong "fills your brief" chip costs a glance, a missing one costs the
 * connection between the two halves of Shop.
 */
export function matchShoppingPriority(
  find: { category?: string | null; productName?: string | null; notes?: string | null },
  priorities: ShoppingBriefPriority[],
): ShoppingBriefPriority | null {
  const haystack = [find.category, find.productName, find.notes]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLocaleLowerCase();
  if (!haystack.trim()) return null;
  const findWords = new Set(haystack.split(/[^a-z]+/u).filter(Boolean).map(stem));
  for (const priority of priorities) {
    const nouns = [priority.category, ...priority.label.split(/[^a-zA-Z]+/u)]
      .map((word) => word.toLocaleLowerCase())
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
      .map(stem);
    if (nouns.some((noun) => findWords.has(noun))) return priority;
  }
  return null;
}
