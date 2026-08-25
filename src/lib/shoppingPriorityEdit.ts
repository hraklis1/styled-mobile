import { parseProductOffers, type ProductOffer } from '../types/commerce';
import {
  parseShoppingBrief,
  type ShoppingBrief,
  type ShoppingBriefPriority,
} from './shopDecisionWorkspace';

/**
 * One complete look the target unlocks, built from pieces the user already
 * owns. Mirrors ShoppingPriorityOutfitIdea in ../Styled/server/shoppingPriorityEdit.ts.
 */
export type ShoppingPriorityOutfitIdea = {
  /** Short editorial name for the look, e.g. "With tailoring". */
  label: string;
  /** 2-4 owned item ids that complete this look alongside the target. */
  itemIds: number[];
};

export type ShoppingPriorityTarget = {
  key: string;
  title: string;
  category: string;
  color: string;
  material: string;
  silhouette: string;
  priceRange: string;
  retailerExamples: string[];
  rationale: string;
  unlocks: string[];
  outfitIdeas: ShoppingPriorityOutfitIdea[];
  /**
   * Flat pairing list this replaced. Still read when rendering an edit that
   * predates the grouped shape — saved wishlist entries persist whole targets,
   * so an old one can reach the card long after the server stopped emitting it.
   * @deprecated Read `outfitIdeas`; use targetOutfitIdeas() to normalize.
   */
  pairsWithItemIds?: number[];
  // Commerce seam — populated by server/commerce once a product source is
  // configured. Real, buyable results for this target, best first; an empty
  // list is the normal resting state, never an error.
  offers?: ProductOffer[];
  // Flat projection of offers[0], kept because ShoppingPriorityTargetCard
  // reads these directly today. Field names match ShopOutfitItem in
  // src/types/shop.ts.
  // @deprecated Read `offers` instead; these go away with the offer carousel.
  imageUrl?: string;
  productUrl?: string;
  merchant?: string;
  price?: string;
};

export type ShoppingPriorityEdit = {
  status: 'ready' | 'no_buy';
  headline: string;
  summary: string;
  generatedAt: string;
  priority: ShoppingBriefPriority;
  targets: ShoppingPriorityTarget[];
  noBuyReason: string | null;
  briefUpdated?: boolean;
  updatedBrief?: ShoppingBrief;
};

function normalizeEditorialCopy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Humanizes snake_case tokens embedded in otherwise-normal prose, e.g.
 * "smart_casual and date_night outfits" → "Smart Casual and Date Night
 * outfits". Leaves everything else — hyphenated words, normal sentences —
 * untouched. Same failure mode and fix as `humanizeGeneratedCopy` in
 * components/stylist/GapCard.tsx, which handles a whole label rather than a
 * token embedded mid-sentence.
 */
export function humanizeInlineTokens(value: string): string {
  return value.replace(/\b[a-z]+(?:_[a-z]+)+\b/g, (token) =>
    token.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '));
}

export function shoppingPriorityGapStatement(label: string, context: string): string {
  const normalizedLabel = normalizeEditorialCopy(label);
  const normalizedContext = normalizeEditorialCopy(context);
  const sentenceCasedLabel = normalizedLabel
    ? normalizedLabel.charAt(0).toUpperCase() + normalizedLabel.slice(1)
    : '';

  if (!normalizedContext) return sentenceCasedLabel;
  if (!sentenceCasedLabel) {
    return normalizedContext.charAt(0).toUpperCase() + normalizedContext.slice(1);
  }
  const contextRemainder = normalizedContext.slice(normalizedLabel.length);
  if (
    normalizedLabel
    && normalizedContext.toLocaleLowerCase().startsWith(normalizedLabel.toLocaleLowerCase())
    && (contextRemainder.length === 0 || /^[\s.,:;!?—-]/.test(contextRemainder))
  ) {
    return normalizedContext;
  }
  if (/^[a-z]/.test(normalizedContext)) {
    return `${sentenceCasedLabel} ${normalizedContext}`;
  }

  const separator = /[.!?]$/.test(sentenceCasedLabel) ? ' ' : '. ';
  return `${sentenceCasedLabel}${separator}${normalizedContext}`;
}

export type ShoppingPriorityGapNarrative = {
  /**
   * The gap in the stylist's own voice, whole and unrewritten. Never a bare
   * noun phrase when there is a real sentence to show instead.
   */
  voice: string;
  /** Present only on `occasion_ladder` candidates, which are the only kind
   *  whose context carries a step. */
  step: { current: number; total: number } | null;
};

/** Trailing ladder bookkeeping, e.g. "Step 1 of 2: tailored dress trousers."
 *  Archetype labels never contain a period, so the tail is unambiguous. */
const LADDER_STEP_TAIL = /\s*\bStep\s+(\d+)\s+of\s+(\d+)\s*:[^.]*\.\s*$/i;

/**
 * Drops a trailing clause that only restates a figure already on screen as its
 * own statistic.
 *
 * The server builds several context shapes that end by spelling out
 * `impactScore` in prose — "… — sleek evening shoes would add 9 new outfits."
 * or "…, creating 9 new outfits that don't exist yet." Rendered under a 34pt
 * "9 new outfits" stat, the sentence stutters.
 *
 * Only tails that can be severed and still leave a complete sentence are
 * removed. The multiplier shape — "Sleek evening shoes would create 9 new
 * outfits from pieces you already own." — is left alone: the figure *is* the
 * sentence there, and cutting it would leave nothing to say.
 */
function dropRestatedImpact(context: string, impactScore?: number): string {
  if (typeof impactScore !== 'number' || impactScore <= 0 || !context) return context;
  const count = `${impactScore} new outfits?`;
  const severableTails = [
    // "… — sleek evening shoes would add 9 new outfits."
    new RegExp(`\\s*[—–-]\\s*[^—–]*?\\b${count}\\b[^.]*\\.?\\s*$`),
    // "…, creating 9 new outfits that don't exist yet."
    new RegExp(`\\s*,\\s*creating\\s+${count}\\b[^.]*\\.?\\s*$`),
  ];
  for (const tail of severableTails) {
    if (!tail.test(context)) continue;
    const remainder = context.replace(tail, '').trim();
    // A stub like "Your wardrobe is thin" is worse than the repetition.
    if (remainder.split(' ').length < 5) continue;
    return /[.!?]$/.test(remainder) ? remainder : `${remainder}.`;
  }
  return context;
}

/**
 * Separates the gap blurb into the parts that deserve their own compartment.
 *
 * `context` arrives from the server as one string that welds together up to
 * three different kinds of content: the stylist's actual sentence, a bare noun
 * phrase repeating `label`, and — on occasion-ladder candidates only —
 * "Step N of M: <label>" bookkeeping. Rendered as one paragraph they read as
 * an over-long slab that repeats the category three times; separated, the
 * sentence stands on its own and each fact is stated once.
 *
 * The composition itself is still `shoppingPriorityGapStatement` — the label is
 * only dropped in the one branch where it was *prepended* to an already
 * complete sentence, so a fragment context ("to meet the formal dress code.")
 * still keeps the label that makes it a sentence at all.
 */
export function shoppingPriorityGapNarrative(
  label: string,
  context: string,
  options?: { impactScore?: number },
): ShoppingPriorityGapNarrative {
  const normalizedContext = dropRestatedImpact(normalizeEditorialCopy(context), options?.impactScore);
  const stepMatch = LADDER_STEP_TAIL.exec(normalizedContext);
  const current = stepMatch ? Number(stepMatch[1]) : 0;
  const total = stepMatch ? Number(stepMatch[2]) : 0;
  const step = stepMatch && current >= 1 && total >= current ? { current, total } : null;

  // Only drop the tail when it parsed into a step worth showing — a malformed
  // one stays in the prose rather than vanishing from the screen entirely.
  const body = step ? normalizedContext.replace(LADDER_STEP_TAIL, '') : normalizedContext;
  const voice = shoppingPriorityGapStatement(label, body);

  const normalizedLabel = normalizeEditorialCopy(label);
  if (!normalizedLabel) return { voice, step };

  const sentenceCasedLabel = normalizedLabel.charAt(0).toUpperCase() + normalizedLabel.slice(1);
  const trimmedBody = normalizeEditorialCopy(body);
  // Mirrors the final branch of shoppingPriorityGapStatement: a capitalized
  // context that does not already open with the label gets the label glued on
  // in front. That prefix — and only that prefix — is the redundant one.
  const prependedLabel = /^[A-Z]/.test(trimmedBody)
    && !trimmedBody.toLocaleLowerCase().startsWith(normalizedLabel.toLocaleLowerCase());
  if (!prependedLabel) return { voice, step };

  const preamble = `${sentenceCasedLabel}${/[.!?]$/.test(sentenceCasedLabel) ? ' ' : '. '}`;
  if (!voice.startsWith(preamble)) return { voice, step };
  const remainder = voice.slice(preamble.length).trim();
  return { voice: remainder || voice, step };
}

/**
 * The direction title with a category noun the page already states removed.
 *
 * Three directions named "Charcoal Tapered Trousers", "Mid-Grey Slim Trousers"
 * and "Deep Navy Trousers" all end in the same word, so the eye has to travel
 * back to the front of each line to find what actually differs. The category is
 * already the page headline; repeating it per card costs scannability and buys
 * nothing.
 *
 * Conservative by design: it only removes a trailing word or two-word phrase
 * that literally appears in `categoryLabel`, never strips a title below two
 * words, and falls back to the original whenever it cannot do both.
 */
export function shoppingPriorityTargetDisplayTitle(title: string, categoryLabel: string): string {
  const normalizedTitle = normalizeEditorialCopy(title);
  const haystack = ` ${normalizeEditorialCopy(categoryLabel).toLocaleLowerCase()} `;
  if (!normalizedTitle || haystack.trim().length === 0) return normalizedTitle;

  const words = normalizedTitle.split(' ');
  // Longest match first, then fall back — "Everyday Leather Sneakers" against
  // "everyday leather sneakers" must not strip two words and leave "Everyday".
  for (const size of [2, 1]) {
    if (words.length - size < 2) continue;
    const tail = words.slice(-size).join(' ').toLocaleLowerCase();
    if (haystack.includes(` ${tail} `)) return words.slice(0, -size).join(' ');
  }
  return normalizedTitle;
}

export function shoppingPriorityEditDisplayHeadline(headline: string, priorityLabel: string): string {
  const candidate = normalizeEditorialCopy(headline);
  const wordCount = candidate ? candidate.split(' ').length : 0;
  if (candidate.length <= 42 && wordCount <= 5) return candidate;

  const fallback = normalizeEditorialCopy(priorityLabel);
  if (!fallback) return candidate;
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

/**
 * Splits a model-generated price range into a compact form and its currency.
 *
 * "$180–$350 CAD" → { compact: "$180–350", currency: "CAD" }. The currency is
 * stated once per screen rather than on every direction card, and the second
 * symbol is redundant inside a single range. The field is model-generated and
 * not guaranteed to match any shape, so anything unrecognised passes through
 * untouched.
 */
export function splitPriceRange(priceRange: string): { compact: string; currency: string | null } {
  const normalized = normalizeEditorialCopy(priceRange);
  if (!normalized) return { compact: normalized, currency: null };

  const currencyMatch = /\s([A-Z]{3})$/.exec(normalized);
  const currency = currencyMatch ? currencyMatch[1] : null;
  const withoutCurrency = currency ? normalized.slice(0, -currency.length).trim() : normalized;
  const compact = withoutCurrency.replace(/^(\D*\d[\d.,]*\s*[–—-]\s*)\D*(\d)/, '$1$2');

  return { compact: compact || normalized, currency };
}

/**
 * The looks to render for a target, tolerant of both target shapes.
 *
 * Targets are persisted whole inside saved wishlist entries, so a target
 * written before the grouped shape existed can still reach the card. Those
 * carry only the flat `pairsWithItemIds`, which was never really one outfit —
 * it is surfaced as a single unlabelled group rather than invented into looks
 * the model never actually proposed.
 */
export function targetOutfitIdeas(target: ShoppingPriorityTarget): ShoppingPriorityOutfitIdea[] {
  if (Array.isArray(target.outfitIdeas) && target.outfitIdeas.length > 0) return target.outfitIdeas;
  const legacy = target.pairsWithItemIds ?? [];
  return legacy.length > 0 ? [{ label: '', itemIds: legacy }] : [];
}

export function parseShoppingPriorityEdit(value: unknown): ShoppingPriorityEdit {
  if (!value || typeof value !== 'object') throw new Error('Invalid Shopping Edit response');
  const edit = value as Partial<ShoppingPriorityEdit>;
  if (
    !['ready', 'no_buy'].includes(edit.status ?? '')
    || typeof edit.headline !== 'string'
    || typeof edit.summary !== 'string'
    || typeof edit.generatedAt !== 'string'
    || !edit.priority || typeof edit.priority !== 'object'
    || !Array.isArray(edit.targets)
    || (edit.noBuyReason != null && typeof edit.noBuyReason !== 'string')
    || (edit.briefUpdated != null && typeof edit.briefUpdated !== 'boolean')
  ) throw new Error('Invalid Shopping Edit response');
  // Widened from an exact 3 to a range — matches the backend relaxation in
  // server/shoppingPriorityEdit.ts, done ahead of real product results making
  // a fixed count impossible. Still always 3 today.
  if (edit.status === 'ready' && (edit.targets.length < 1 || edit.targets.length > 5)) throw new Error('Invalid Shopping Edit response');
  if (edit.status === 'no_buy' && edit.targets.length !== 0) throw new Error('Invalid Shopping Edit response');
  const updatedBrief = edit.updatedBrief == null ? undefined : parseShoppingBrief(edit.updatedBrief);
  if (edit.briefUpdated === true && (edit.status !== 'no_buy' || !updatedBrief)) {
    throw new Error('Invalid Shopping Edit response');
  }
  if (edit.briefUpdated !== true && updatedBrief) throw new Error('Invalid Shopping Edit response');
  // Offers are validated per-row and bad rows are dropped rather than failing
  // the edit — see parseProductOffers. A target with no offers still renders.
  const targets = (edit.targets as ShoppingPriorityTarget[]).map((target) => {
    const offers = parseProductOffers((target as { offers?: unknown }).offers);
    return offers.length > 0 ? { ...target, offers } : target;
  });

  return {
    ...edit,
    targets,
    noBuyReason: edit.noBuyReason ?? null,
    ...(updatedBrief ? { updatedBrief } : {}),
  } as ShoppingPriorityEdit;
}
