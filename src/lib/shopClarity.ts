import type { ShoppingBriefPriority } from './shopDecisionWorkspace';
import type { Item } from '../types/item';

/** Closet pieces a suggestion can point at: archived, repair-bound and
 *  donate-pile items are owned but not worn, so they never anchor one. */
export function wearableWardrobe(items: readonly Item[]): ReadonlyMap<number, Item> {
  return new Map(items
    .filter((item) => !item.isArchived && item.condition !== 'needs_repair' && item.condition !== 'donate')
    .map((item) => [item.id, item]));
}

/**
 * The owned pieces a priority was found against, in the order the server
 * ranked them, skipping any no longer in the wearable closet. This is what
 * the Shop surfaces show instead of `impactScore`: a raw combination count
 * ("80 potential outfits") is combinatorics nobody can picture, while
 * "works with your navy blazer" is evidence you can check against your
 * closet. The count still orders the brief server-side.
 *
 * Pieces with a cutout or polished cover lead: at swatch size a product-style
 * frame reads as the garment, while a full-length photo of the wearer reads
 * as noise. Server order is kept within each group.
 */
export function priorityAnchorPieces(priority: ShoppingBriefPriority, wardrobe?: ReadonlyMap<number, Item>): Item[] {
  if (!wardrobe) return [];
  const pieces = (priority.anchorItemIds ?? [])
    .map((id) => wardrobe.get(id))
    .filter((item): item is Item => Boolean(item));
  const catalogStyle = (item: Item) => Boolean(item.cutoutUrl || item.polishedUrl);
  return [...pieces.filter(catalogStyle), ...pieces.filter((item) => !catalogStyle(item))];
}

/** "Works with your Navy Blazer, Grey Chinos +2". Names at most `named`
 *  distinct pieces; two pairs of chino shorts are named once, and the "+N"
 *  counts only pieces the sentence has not already named. */
export function worksWithLabel(pieces: readonly Item[], named = 2, lead = 'Works with your'): string | null {
  const names = pieces.map((item) => item.name?.trim()).filter((name): name is string => Boolean(name));
  if (names.length === 0) return null;
  // Names are the user's own, brands and capitals included, so they are
  // shown as written rather than case-folded into the sentence.
  const shown = [...new Set(names)].slice(0, named);
  const rest = names.filter((name) => !shown.includes(name)).length;
  return `${lead} ${shown.join(', ')}${rest > 0 ? ` +${rest}` : ''}`;
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

/**
 * Drops the computed count from stylist prose while keeping the sentence:
 * "would create 80 new outfits from pieces you already own" → "would create
 * new outfits from pieces you already own". The brief text is generated
 * around `impactScore`, and a number removed from the UI should not survive
 * inside the copy.
 */
export function withoutOutfitCount(text: string, count?: number): string {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return text;
  return text.replace(new RegExp(`\\b${count}\\s+(new\\s+outfits?)\\b`, 'gi'), (_match, phrase: string) => /s$/i.test(phrase) ? phrase : `${phrase}s`);
}

/**
 * True when a sentence, once its count is removed, says nothing but "would
 * create new outfits from pieces you already own" — filler beside a
 * works-with strip that names those pieces.
 */
export function isGenericOutfitClaim(text: string): boolean {
  return /^(?:would\s+)?(?:create|add|unlock|open up|give you)\s+new\s+outfits?\s+from\s+(?:the\s+)?pieces\s+you\s+already\s+own\.?$/i.test(text.trim());
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
