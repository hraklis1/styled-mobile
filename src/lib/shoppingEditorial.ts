import type { ShoppingPriorityTarget } from './shoppingPriorityEdit';

/** Keep complete sentences; unusually long single sentences remain readable in full. */
export function stylistNotePreview(text: string): string {
  if (text.trim().split(/\s+/).length <= 70) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [];
  let preview = '';
  for (const sentence of sentences) {
    if ((preview + sentence).trim().split(/\s+/).length > 50) break;
    preview += sentence;
  }
  return preview.trim() || text;
}

export function shoppingGarmentTitle(value: string): string {
  const title = value
    .replace(/\s+gap\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function styleFollowupQuestions(targets: ShoppingPriorityTarget[]): string[] {
  const alternative = targets[1];
  return [
    alternative
      ? `Would ${alternative.color || alternative.title} work better for me?`
      : 'Could this feel more casual?',
    'Can we find a less expensive version?',
  ];
}

/** Compatibility for deterministic rationale templates stored in older daily briefs. */
export function legacyPriorityRationale(text: string): string {
  return text
    .replace(
      /Your wardrobe is thin for (.+?) occasions/gi,
      'You have fewer options for $1 occasions',
    )
    .replace(
      /You own (.+?) for (.+?) occasions but cannot build a complete .+? outfit yet\./gi,
      'I’d add this to wear with your $1 for $2 occasions.',
    );
}
