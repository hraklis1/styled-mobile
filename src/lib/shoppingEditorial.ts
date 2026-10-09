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

/** A style title mid-sentence: Title Case words are lowercased, acronyms (UK, OCBD) are kept. */
export function styleName(target: ShoppingPriorityTarget): string {
  const title = (target.title || target.color || 'this style').trim();
  return title.split(/(\s+)/).map(word => /^[A-Z][a-z]/.test(word) ? word.toLowerCase() : word).join('');
}

/** Questions asked from inside one style's chapter; each names the style so it reads on its own in chat. */
export function styleAskQuestions(target: ShoppingPriorityTarget): string[] {
  const name = styleName(target);
  return [`Is there a cheaper take on the ${name}?`, `What else could I wear the ${name} with?`];
}

/**
 * A guide question that wants products rather than styling advice. Mirrors the
 * server's guide listing predicate; the client only uses it to leave such
 * questions unmoded so the server can route them to a shop list.
 */
export function isGuideListingQuestion(text: string): boolean {
  return /\b(cheaper|less expensive|more affordable|budget (take|version|option)s?|listings?|alternatives?|options|show me|where (can|do|could|should) i (buy|get|find)|links?)\b/i.test(text);
}

/** Questions across the whole guide; only meaningful when there is more than one style to weigh. */
export function compareAskQuestions(targets: ShoppingPriorityTarget[]): string[] {
  if (targets.length < 2) return [];
  const which = targets.length === 2
    ? `The ${styleName(targets[0])} or the ${styleName(targets[1])} — which suits me better?`
    : `Which of these ${targets.length} styles suits me best?`;
  return [which, 'Which one works with more of my closet?'];
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
