import type { Item } from '../types/item';
import type { ShoppingBriefPriority } from './shopDecisionWorkspace';

const garmentNouns: Record<string, string> = {
  jackets: 'jacket', blazers: 'blazer', shirts: 'shirt', 't shirts': 'T-shirt',
  't-shirts': 'T-shirt', sweaters: 'sweater', coats: 'coat', dresses: 'dress',
  jumpsuits: 'jumpsuit', skirts: 'skirt', tops: 'top', hoodies: 'hoodie',
};
const categoryNouns: Record<string, string> = {
  outerwear: 'jacket', top: 'top', bottom: 'trousers', full_body: 'one-piece', shoes: 'shoes',
};

/** Short editorial descriptions, independent of editable catalog names. */
export function homeGarmentDescription(item: Item): string {
  const raw = item.subcategory?.replace(/[_-]/g, ' ').trim().toLowerCase();
  const noun = raw ? garmentNouns[raw] ?? raw.replace(/\b(jackets|blazers|shirts|sweaters|coats|dresses|skirts|hoodies)\b/g, (word) => garmentNouns[word]) : categoryNouns[item.category ?? ''] ?? 'piece';
  const rawColor = item.color?.trim().toLowerCase() ?? '';
  const color = rawColor.split(/\s+with\s+/)[0];
  const striped = /strip(e|es|ed)/.test(rawColor) && !/strip/.test(noun);
  const descriptor = [color, striped ? 'striped' : '', noun].filter(Boolean).join(' ');
  return descriptor.length <= 65 ? descriptor : categoryNouns[item.category ?? ''] ?? 'piece';
}

export function homeShoppingExplanation(priority: ShoppingBriefPriority, items: Item[]): string {
  const anchors = (priority.anchorItemIds ?? [])
    .map((id) => items.find((item) => item.id === id && !item.isArchived && item.condition !== 'needs_repair' && item.condition !== 'donate'))
    .filter((item): item is Item => !!item);
  const descriptions = [...new Set(anchors.map(homeGarmentDescription))];
  if (descriptions.length) {
    const first = descriptions[0];
    const second = descriptions[1];
    const pairing = second && first.length + second.length < 80 ? `${first} or ${second}` : first;
    return `Style with your ${pairing}.`;
  }
  const firstSentence = priority.context.trim().match(/^.*?[.!?](?:\s|$)/)?.[0].trim();
  if (firstSentence && firstSentence.length <= 110 && !/proportion|silhouette|grounding|outfits|step \d/i.test(firstSentence)) return firstSentence;
  return 'Explore ways to wear this with your wardrobe.';
}

export function homePriorityTitle(label: string): string {
  const text = label.trim().replace(/\bchelsea\b/gi, 'Chelsea');
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function homeGarmentWithArticle(description: string): string {
  if (/\b(trousers|pants|jeans|shorts|shoes|boots|sneakers|sandals|loafers|trainers|heels|leggings|joggers)$/i.test(description)) return description;
  return `${/^[aeiou]/i.test(description) ? 'an' : 'a'} ${description}`;
}
