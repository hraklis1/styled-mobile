/**
 * The garment attribute vocabularies — the single source of truth.
 *
 * ─── Why this file exists ───────────────────────────────────────────────────
 *
 * These lists used to live in up to five places that had already drifted apart:
 * the mobile client (`src/types/item.ts`), a mobile UI *component*
 * (`EditItemModal.tsx` owned the entire `fit` vocabulary), a set of ALLOWED_*
 * consts in the backend scan sanitizer, a fourth copy written out in prose
 * inside the scan prompt, and the web client's `wardrobeOptions.ts`.
 *
 * The drift was not hypothetical. The scan prompt asked the model for
 * "Checkered" while the app's picker only knows "Checked", so a correctly
 * perceived shirt was stored as a value no UI could display and no filter could
 * match — and migration 0031 fixed the row rather than the prompt. `seasons`
 * reached four different vocabularies at once, including a default of the
 * literal "all", which migration 0013 had removed years earlier.
 *
 * ─── Rules ──────────────────────────────────────────────────────────────────
 *
 * 1. ZERO IMPORTS. This file is mirrored byte-for-byte into the mobile repo at
 *    `src/lib/attributes.ts`, and `scripts/check-vocab-drift.ts` fails the build
 *    if the two diverge. Anything imported here would have to exist in both
 *    repos under the same specifier. Keeping it dependency-free is what makes
 *    the copy safe.
 *
 * 2. Values are what gets STORED. Labels are what gets DISPLAYED. Never store a
 *    label.
 *
 * 3. The scan prompt is GENERATED from these lists (see `scanPrompt.ts`), never
 *    written out by hand again. A prompt that restates a vocabulary is a fifth
 *    copy waiting to drift, and it is the copy the model actually obeys.
 *
 * These are the ORTHOGONAL FACETS of a garment. Its identity — what kind of
 * thing it is — lives in the three-level tree in `taxonomy.ts`. A value that
 * names a garment you would buy belongs there; a value that names a property of
 * a garment belongs here.
 */

// ── Identity: category (level 1 of the taxonomy, repeated here so the facets
// can be keyed by it without importing the tree) ─────────────────────────────

export const ITEM_CATEGORIES = [
  "top", "bottom", "full_body", "shoes", "outerwear", "accessory", "valuables",
] as const;
export type ItemCategory = typeof ITEM_CATEGORIES[number];

/**
 * Which categories can carry a neckline, a sleeve length, and a fit.
 *
 * This rule previously existed in four places that disagreed: `necklineAllowed`
 * in the scan sanitizer, `NECKLINE_OPTIONS_BY_CATEGORY` on mobile,
 * `SLEEVED_CATEGORIES` in polishPrompt.ts, and a startup `UPDATE items SET
 * neckline = NULL` in server/index.ts. The startup sweep was the one missing
 * `full_body`, so it deleted every dress neckline on every boot.
 */
export const NECKLINE_CATEGORIES = ["top", "outerwear", "full_body"] as const;
export const SLEEVE_CATEGORIES = ["top", "outerwear", "full_body"] as const;
export const FIT_CATEGORIES = ["top", "bottom", "full_body", "outerwear", "shoes"] as const;

// ── Seasons ─────────────────────────────────────────────────────────────────

/**
 * Four discrete seasons.
 *
 * NOT `spring_fall`, and NOT `all`. Both existed in live data: `spring_fall` is
 * migration 0013's collapsed form, still declared in the scan response contract
 * in `shared/routes.ts` long after the server stopped emitting it, and `all` was
 * a sanitizer default that matched nothing anywhere. An item tagged
 * `spring_fall` was invisible to every spring or fall query in the stylist's
 * retrieval filter.
 */
export const SEASON_OPTIONS = ["spring", "summer", "fall", "winter"] as const;
export type Season = typeof SEASON_OPTIONS[number];
export const SEASON_LABELS: Record<Season, string> = {
  spring: "Spring",
  summer: "Summer",
  fall:   "Fall",
  winter: "Winter",
};

// ── Occasion ────────────────────────────────────────────────────────────────

/**
 * One formality axis, ordered least to most formal.
 *
 * There used to be two, filled by the same scan and both read by the stylist:
 * `occasions` (casual, smart_casual, business, formal, party, workout) and
 * `formalityStyles` (Athleisure, Lounge, Casual, Smart Casual, Business Casual,
 * Professional, Night Out, Formal). They answered the same question in
 * different words, and the live data showed `formalityStyles` was usually the
 * richer of the two — one item carried `occasions: ["business"]` against
 * `formalityStyles: [Professional, Business Casual, Night Out, Smart Casual,
 * Formal]`.
 *
 * The merged vocabulary is the finer one, in the snake_case the surviving
 * `occasions` column already stores. `occasions` survives because it is the
 * column with `NOT NULL DEFAULT '{}'`, the closet filters, the retrieval boost
 * and the wardrobe gap analysis behind it.
 *
 * The ordering is load-bearing: `OCCASION_RANK` below turns it into a formality
 * floor.
 */
export const OCCASION_OPTIONS = [
  "athleisure", "lounge", "casual", "smart_casual",
  "business_casual", "professional", "night_out", "formal",
] as const;
export type Occasion = typeof OCCASION_OPTIONS[number];
export const OCCASION_LABELS: Record<Occasion, string> = {
  athleisure:      "Athleisure",
  lounge:          "Lounge",
  casual:          "Casual",
  smart_casual:    "Smart Casual",
  business_casual: "Business Casual",
  professional:    "Professional",
  night_out:       "Night Out",
  formal:          "Formal",
};

/** Position on the formality scale. Higher is dressier. */
export const OCCASION_RANK: Record<Occasion, number> =
  Object.fromEntries(OCCASION_OPTIONS.map((o, i) => [o, i])) as Record<Occasion, number>;

/**
 * Retired vocabularies, mapped onto the merged one.
 *
 * Kept in the shared module rather than buried in a migration because model
 * output, legacy rows and any client that has not shipped yet all keep
 * producing the old words. Used by the migration AND by `normalizeOccasion`.
 */
const LEGACY_OCCASION_ALIASES: Record<string, Occasion> = {
  // The old `occasions` vocabulary.
  workout: "athleisure",
  business: "professional",
  party: "night_out",
  // The old `formalityStyles` vocabulary, lowercased.
  "smart casual": "smart_casual",
  "business casual": "business_casual",
  "night out": "night_out",
  // Words a model reaches for that were never in either list.
  gym: "athleisure",
  athletic: "athleisure",
  sport: "athleisure",
  loungewear: "lounge",
  work: "professional",
  office: "professional",
  evening: "night_out",
  cocktail: "night_out",
  "black tie": "formal",
};

/**
 * The profile questionnaire's occasion vocabulary, mapped onto the formality axis.
 *
 * NOT legacy — these are current and user-facing. `users.occasions` is filled by
 * the onboarding questionnaire, which asks the question in the words a person
 * actually uses ("date night", "wedding / guest", "interview") rather than in
 * the formality words `items.occasions` is tagged with. Both columns feed
 * `normalizeOccasion`, and until this map existed 11 of the 13 questionnaire
 * answers normalized to null and were silently dropped from the retrieval
 * re-rank — only `smart_casual` and `night_out` happened to collide with the
 * canonical set.
 *
 * The collapse is deliberately lossy in one direction only: `travel`, `vacation`
 * and `wedding_guest` carry context beyond formality, but formality is all this
 * axis models. The full labels still reach the model verbatim as the
 * "Dresses for:" line, so nothing is lost from the prompt — only from the
 * numeric boost, which has nowhere finer to put them.
 */
const PROFILE_OCCASION_ALIASES: Record<string, Occasion> = {
  everyday: "casual",
  casual_weekend: "casual",
  travel: "casual",
  vacation: "casual",
  school: "casual",
  work_office: "professional",
  interview: "professional",
  date_night: "night_out",
  formal_events: "formal",
  wedding_guest: "formal",
  athletic_active: "athleisure",
};

/** Map any spelling — current, retired, or near-miss — onto the merged axis. */
export function normalizeOccasion(raw: unknown): Occasion | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase().replace(/[-]+/g, " ").replace(/\s+/g, " ");
  if (!v) return null;
  const direct = OCCASION_OPTIONS.find((o) => o === v || o.replace(/_/g, " ") === v);
  if (direct) return direct;
  return PROFILE_OCCASION_ALIASES[v] ?? LEGACY_OCCASION_ALIASES[v] ?? null;
}

/**
 * Every value the profile questionnaire can produce.
 *
 * Exported so `scripts/check-vocab-drift.ts` can assert each one still
 * normalizes — adding an option to the mobile picker without adding it here is
 * exactly the drift that made this map necessary in the first place.
 */
export const PROFILE_OCCASION_VALUES = [
  "everyday", "work_office", "casual_weekend", "date_night", "formal_events",
  "athletic_active", "travel", "smart_casual", "night_out", "vacation",
  "wedding_guest", "interview", "school",
] as const;

// ── Condition ───────────────────────────────────────────────────────────────

export const CONDITION_OPTIONS = ["new", "good", "worn", "needs_repair", "donate"] as const;
export type ItemCondition = typeof CONDITION_OPTIONS[number];
export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new:          "New",
  good:         "Good",
  worn:         "Worn",
  needs_repair: "Needs Repair",
  donate:       "Donate",
};

// ── Colour ──────────────────────────────────────────────────────────────────

export const NORMALIZED_COLORS = [
  "black", "white", "grey", "navy", "blue", "light-blue",
  "green", "olive", "khaki", "red", "burgundy", "pink",
  "orange", "yellow", "brown", "tan", "beige", "cream",
  "purple", "lavender", "gold", "silver", "multi",
] as const;
export type NormalizedColor = typeof NORMALIZED_COLORS[number];

export const COLOR_TEMPERATURE_OPTIONS = ["warm", "cool", "neutral"] as const;
export type ColorTemperature = typeof COLOR_TEMPERATURE_OPTIONS[number];
export const COLOR_TEMPERATURE_LABELS: Record<ColorTemperature, string> = {
  warm: "Warm", cool: "Cool", neutral: "Neutral",
};

/** Fallback when the model names a colour but not its temperature. */
export const COLOR_TEMPERATURE_MAP: Record<NormalizedColor, ColorTemperature> = {
  red: "warm", orange: "warm", yellow: "warm", brown: "warm", tan: "warm",
  beige: "warm", cream: "warm", olive: "warm", khaki: "warm", gold: "warm",
  burgundy: "warm",
  blue: "cool", navy: "cool", "light-blue": "cool", green: "cool",
  purple: "cool", lavender: "cool", silver: "cool", grey: "cool", pink: "cool",
  black: "neutral", white: "neutral", multi: "neutral",
};

// ── Warmth ──────────────────────────────────────────────────────────────────

export const WARMTH_RATINGS = [1, 2, 3, 4, 5] as const;
export type WarmthRating = typeof WARMTH_RATINGS[number];
export const WARMTH_LABELS: Record<number, string> = {
  1: "Very Light", 2: "Light", 3: "Medium", 4: "Warm", 5: "Very Warm",
};

// ── Sleeve length ───────────────────────────────────────────────────────────

/**
 * The elbow is the boundary and exactly one rule may own it. The scan prompt
 * used to claim it twice — "short = at or above the elbow" alongside "long =
 * treat elbow-length as long" — which is a coin flip dressed as an instruction.
 */
export const SLEEVE_LENGTH_OPTIONS = ["short", "long", "sleeveless"] as const;
export type SleeveLength = typeof SLEEVE_LENGTH_OPTIONS[number];
export const SLEEVE_LENGTH_LABELS: Record<SleeveLength, string> = {
  short:      "Short Sleeve",
  long:       "Long Sleeve",
  sleeveless: "Sleeveless",
};

// ── Pattern ─────────────────────────────────────────────────────────────────

/**
 * Canonical spellings. The scan prompt used to offer "Checkered", "Plaid" and
 * "Tie-dye", none of which are members — "Checked", "Plaid / Tartan" and
 * "Tie-Dye" are. Generating the prompt from this list is what stops that
 * recurring.
 */
export const PATTERN_OPTIONS = [
  "Solid", "Striped", "Plaid / Tartan", "Checked", "Houndstooth",
  "Floral", "Geometric", "Abstract", "Animal Print", "Camouflage",
  "Tie-Dye", "Ombré", "Graphic / Print", "Textured",
] as const;
export type Pattern = typeof PATTERN_OPTIONS[number];

// ── Neckline ────────────────────────────────────────────────────────────────

export const NECKLINE_OPTIONS_BY_CATEGORY: Partial<Record<ItemCategory, readonly string[]>> = {
  top: [
    "Crew Neck", "V-Neck", "Scoop Neck", "Square Neck", "Boat Neck / Bateau",
    "Turtleneck", "Mock Neck", "Cowl Neck", "Off-Shoulder", "One-Shoulder",
    "Halter", "Strapless", "Keyhole", "Henley", "Collared", "Polo", "Wrap", "Sweetheart",
  ],
  outerwear: [
    "Collared", "Lapel / Notch", "Peaked Lapel", "Shawl Collar", "Stand Collar",
    "Hood", "Funnel Neck", "Turtleneck", "Crew Neck", "V-Neck",
  ],
  full_body: [
    "Crew Neck", "V-Neck", "Scoop Neck", "Square Neck", "Boat Neck / Bateau",
    "Off-Shoulder", "One-Shoulder", "Halter", "Strapless", "Sweetheart", "Wrap", "Cowl Neck",
  ],
};

/** Every neckline value, across categories — for validation, not for pickers. */
export const ALL_NECKLINES: readonly string[] = [
  ...new Set(Object.values(NECKLINE_OPTIONS_BY_CATEGORY).flat()),
];

// ── Fit ─────────────────────────────────────────────────────────────────────

/**
 * The `fit` vocabulary previously existed ONLY inside `EditItemModal.tsx`, so
 * the server accepted arbitrary strings for it and the scan review sheet took
 * it as free text. Live data held "Fitted", "Relaxed", "Slim Fit", "Regular",
 * "Wide Leg" and one row containing the literal string "null".
 */
export const FIT_OPTIONS_BY_CATEGORY: Partial<Record<ItemCategory, readonly string[]>> = {
  top: [
    "Slim Fit", "Regular Fit", "Relaxed Fit", "Oversized",
    "Fitted", "Tailored", "Athletic Fit", "Compression",
    "Boxy", "Cropped", "Longline",
  ],
  bottom: [
    "Slim Fit", "Regular Fit", "Relaxed Fit",
    "Skinny", "Straight Leg", "Tapered", "Wide Leg", "Bootcut", "Flared",
    "Cropped", "Athletic Fit", "Compression",
  ],
  full_body: [
    "Slim Fit", "Regular Fit", "Relaxed Fit", "Oversized",
    "Fitted", "Tailored", "Bodycon", "A-Line", "Wrap",
    "Boxy", "Cropped", "Longline",
  ],
  outerwear: [
    "Slim Fit", "Regular Fit", "Relaxed Fit", "Oversized",
    "Fitted", "Tailored", "Athletic Fit", "Boxy", "Cropped", "Longline",
  ],
  shoes: ["Regular Width", "Wide Width", "Narrow Width", "Slim", "Regular"],
  accessory: [],
  valuables: [],
};

export const FIT_OPTIONS_DEFAULT: readonly string[] = [
  "Slim Fit", "Regular Fit", "Relaxed Fit", "Oversized", "Fitted", "Tailored",
  "Athletic Fit", "Compression", "Boxy", "Cropped", "Longline",
  "Skinny", "Straight Leg", "Tapered", "Wide Leg", "Bootcut", "Flared",
  "A-Line", "Bodycon", "Wrap",
];

/** Every fit value, across categories — for validation, not for pickers. */
export const ALL_FITS: readonly string[] = [
  ...new Set([...Object.values(FIT_OPTIONS_BY_CATEGORY).flat(), ...FIT_OPTIONS_DEFAULT]),
];

// ── Material ────────────────────────────────────────────────────────────────

/**
 * Title Case is canonical. The scan prompt asked for "a single lowercase word",
 * so every stored value was lowercase and no equality filter against this list
 * ever matched.
 *
 * The list was garment-fabric only, which left whole taxonomy branches
 * undescribable: a watch case, a pair of sunglasses, a straw sun hat and a
 * canvas tote have materials, and none of them is a textile. The attribute
 * bench surfaced this as the only non-zero off-vocabulary rate, on two
 * consecutive runs with different values each time ("Resin", then "Canvas"
 * twice) — a structural gap rather than a one-off, and "Canvas Belt" is
 * literally a style in the accessory branch.
 */
export const MATERIAL_OPTIONS = [
  "Acetate", "Acrylic", "Bamboo", "Canvas", "Cashmere", "Chiffon",
  "Cork", "Corduroy", "Cotton", "Denim", "Down", "Elastane",
  "Faux Leather", "Flannel", "Fleece", "Hemp", "Latex", "Leather",
  "Linen", "Lyocell", "Mesh", "Modal", "Neoprene", "Nylon",
  "Organza", "Polyamide", "Polyester", "Rayon", "Resin", "Rubber",
  "Satin", "Shearling", "Silk", "Spandex", "Stainless Steel", "Straw",
  "Suede", "Tencel", "Tweed", "Velvet", "Viscose", "Wool",
] as const;
export type Material = typeof MATERIAL_OPTIONS[number];

// ── Care ────────────────────────────────────────────────────────────────────

/** Never inferred from a photo — only ever read off a care label. */
export const CARE_OPTIONS = [
  "Machine Wash Cold", "Machine Wash Warm", "Hand Wash Only", "Dry Clean Only",
  "Tumble Dry Low", "Tumble Dry Medium", "No Tumble Dry", "Hang Dry",
  "Lay Flat to Dry", "Iron Low Heat", "Iron Medium Heat", "Do Not Iron",
  "Dry Clean or Hand Wash", "Spot Clean Only",
] as const;

// ── Placeholders ────────────────────────────────────────────────────────────

/**
 * Values a model emits when it means "I don't know". Two live rows store the
 * literal string "null" — one in `fit`, one in `material` — which then reached
 * prompt builders as "null fit".
 */
export const PLACEHOLDER_VALUES: readonly string[] = [
  "null", "undefined", "nil", "nan", "none", "n/a", "na",
  "unknown", "unspecified", "-", "--", "?", "",
];

export function isPlaceholder(value: unknown): boolean {
  return typeof value !== "string" || PLACEHOLDER_VALUES.includes(value.trim().toLowerCase());
}

// ── Fuzzy matching ──────────────────────────────────────────────────────────
//
// These live here rather than in taxonomy.ts because BOTH files need them:
// the tree snaps subcategories and styles, and the vocabularies below snap
// pattern, fit, neckline and material. taxonomy.ts imports them from here, so
// there is one matcher and one set of lessons about it, not two.

/**
 * Substring matching on a single word is only meaningful once the word is long
 * enough to be distinctive. Below this, "sun" matches "sunglasses" and a sun
 * visor gets filed under eyewear.
 */
export const MIN_FUZZY_WORD = 4;

/**
 * Strip a plural "s" so "tie" matches "Ties" and "short" matches "Shorts".
 *
 * Needed because the length floor above is measured in characters, and several
 * of the commonest garment words — tie, cap, hat, bag — are three letters. They
 * could never fuzzy-match their own plural group name, so "Silk Tie" landed in
 * accessory/Other rather than anywhere near Ties.
 *
 * Words ending "ss" keep it: "dress" must not become "dres".
 */
export function depluralize(word: string): string {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/**
 * An exact word match scores its own LENGTH, not a flat 2.
 *
 * A long word is more distinctive evidence than a short one. "baseball hat"
 * should reach "Baseball Cap" on the strength of "baseball" (8) rather than
 * tying with "Bucket Hat" and "Sun Hat", which only share the generic "hat"
 * (3). Flat scoring made those three indistinguishable and let list position
 * decide — the original Bucket Hat bug.
 */
export function wordScore(rawWord: string, candWord: string): number {
  if (rawWord === candWord) return rawWord.length;
  // Singular/plural is an exact match, not a fuzzy one — it does not reopen the
  // "sun" -> "sunglasses" hole, which is a substring problem and still gated by
  // MIN_FUZZY_WORD below.
  if (depluralize(rawWord) === depluralize(candWord)) return depluralize(rawWord).length;
  const shorter = rawWord.length <= candWord.length ? rawWord : candWord;
  if (shorter.length >= MIN_FUZZY_WORD && (candWord.includes(rawWord) || rawWord.includes(candWord))) {
    return 1;
  }
  return 0;
}

/**
 * Exact or whole-phrase containment only — no per-word fuzz.
 *
 * Returns null when several candidates contain the value equally well. "Tie" is
 * inside Necktie, Bow Tie, Skinny Tie, Knit Tie and Bolo Tie; "Boot" is inside
 * five of the Boots styles. Picking the longest is picking by list position,
 * which is exactly how every unrecognised "... Hat" became "Bucket Hat".
 * A generic word is genuine ambiguity and the caller should fall back to the
 * group with no style.
 */
export function strictMatch(candidates: string[], raw: string): string | null {
  const lc = raw.trim().toLowerCase();
  if (!lc) return null;
  const exact = candidates.find((s) => s.toLowerCase() === lc);
  if (exact) return exact;
  const contained = candidates.filter((s) => {
    const c = s.toLowerCase();
    return lc.includes(c) || c.includes(lc);
  });
  if (contained.length !== 1) return null;
  return contained[0];
}

/**
 * Map a free-text value onto the closest taxonomy entry.
 *
 * Scores every candidate and takes the best rather than returning the first
 * with any word in common. First-match-wins meant a shared generic word decided
 * the answer by list position: every unrecognised "... Hat" collapsed to
 * "Bucket Hat" purely because it sits above "Sun Hat" in the list.
 */
export function bestMatch(candidates: string[], raw: string): string | null {
  const lc = raw.trim().toLowerCase();
  if (!lc) return null;

  const strict = strictMatch(candidates, lc);
  if (strict) return strict;

  const words = lc.split(/[\s,/-]+/).filter(Boolean);
  let best: string | null = null;
  let bestScore = 0;
  let tiedAtBest = 0;
  for (const cand of candidates) {
    const cWords = cand.toLowerCase().split(/[\s,/-]+/).filter(Boolean);
    let score = 0;
    for (const w of words) {
      score += Math.max(0, ...cWords.map((cw) => wordScore(w, cw)));
    }
    if (score > bestScore) {
      bestScore = score;
      best = cand;
      tiedAtBest = 1;
    } else if (score === bestScore && score > 0) {
      tiedAtBest++;
    }
  }
  // A tie means the evidence does not distinguish the candidates — "Silk Tie"
  // matches Bow Tie, Skinny Tie, Knit Tie and Bolo Tie equally, all on the word
  // "tie". Returning the first is returning whichever happens to sit highest in
  // the list. Say nothing instead and let the caller fall back to the group.
  if (tiedAtBest > 1) return null;
  return best;
}
// ── Enforcement ─────────────────────────────────────────────────────────────

/**
 * Snap one free-text value onto a vocabulary, or return null.
 *
 * Strict first, then scored — the same order `snapToTaxonomy` uses, and for the
 * same reason: a whole-phrase match is real evidence, a per-word one is a guess
 * that must not beat it.
 */
export function snapToVocabulary(
  value: unknown,
  vocabulary: readonly string[],
): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || isPlaceholder(raw)) return null;
  return strictMatch([...vocabulary], raw) ?? bestMatch([...vocabulary], raw);
}

/**
 * Words the matcher cannot reach on its own.
 *
 * "Checkered" is not a variant of "Checked" — different word, no shared prefix
 * or suffix — so no amount of fuzz gets there. It needs naming, and it earns
 * the entry: the scan prompt asked for it by name for months and one live row
 * still holds it. The rest are the other spellings that prompt used, plus the
 * abbreviations a model reaches for.
 */
const PATTERN_ALIASES: Record<string, string> = {
  "checkered": "Checked",
  "checker": "Checked",
  "checks": "Checked",
  "check": "Checked",
  "gingham": "Checked",
  "tartan": "Plaid / Tartan",
  "stripe": "Striped",
  "stripes": "Striped",
  "pinstripe": "Striped",
  "pinstriped": "Striped",
  "print": "Graphic / Print",
  "printed": "Graphic / Print",
  "logo": "Graphic / Print",
  "camo": "Camouflage",
  "animal": "Animal Print",
  "leopard": "Animal Print",
  "zebra": "Animal Print",
  "ombre": "Ombré",
  "texture": "Textured",
  "solid colour": "Solid",
  "solid color": "Solid",
  "plain": "Solid",
};

export function snapPattern(value: unknown): string | null {
  if (typeof value === "string") {
    const alias = PATTERN_ALIASES[value.trim().toLowerCase()];
    if (alias) return alias;
  }
  return snapToVocabulary(value, PATTERN_OPTIONS);
}

export function snapMaterial(value: unknown): string | null {
  return snapToVocabulary(value, MATERIAL_OPTIONS);
}

export function snapFit(category: unknown, value: unknown): string | null {
  const cat = typeof category === "string" ? (category as ItemCategory) : undefined;
  if (cat && !(FIT_CATEGORIES as readonly string[]).includes(cat)) return null;
  const vocab = (cat && FIT_OPTIONS_BY_CATEGORY[cat]) || ALL_FITS;
  return snapToVocabulary(value, vocab);
}

export function snapNeckline(category: unknown, value: unknown): string | null {
  const cat = typeof category === "string" ? (category as ItemCategory) : undefined;
  if (!cat || !(NECKLINE_CATEGORIES as readonly string[]).includes(cat)) return null;
  return snapToVocabulary(value, NECKLINE_OPTIONS_BY_CATEGORY[cat] ?? ALL_NECKLINES);
}

/**
 * Sleeve length, from whatever the source called it.
 *
 * The model answers "Short", "short sleeve", "Short-Sleeved", "3/4". A bare
 * whitelist turned every one of those into null, and a null here is not inert —
 * it reached the polish prompt as "sleeves neatly at the sides", which drew
 * long sleeves on a short-sleeved shirt.
 */
const SLEEVE_ALIASES: Record<string, SleeveLength> = {
  "short": "short", "short sleeve": "short", "short sleeves": "short",
  "short sleeved": "short", "cap": "short", "cap sleeve": "short",
  "cap sleeves": "short",
  "long": "long", "long sleeve": "long", "long sleeves": "long",
  "long sleeved": "long", "full": "long", "full length": "long",
  "3/4": "long", "3/4 length": "long", "three quarter": "long",
  "three quarter length": "long", "wrist": "long", "wrist length": "long",
  "rolled": "long", "rolled up": "long",
  "sleeveless": "sleeveless", "no sleeves": "sleeveless", "none": "sleeveless",
  "tank": "sleeveless", "strapless": "sleeveless", "spaghetti strap": "sleeveless",
};

export function snapSleeveLength(category: unknown, value: unknown): SleeveLength | null {
  const cat = typeof category === "string" ? category : "";
  if (cat && !(SLEEVE_CATEGORIES as readonly string[]).includes(cat)) return null;
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  if (!v || isPlaceholder(v)) return null;
  return SLEEVE_ALIASES[v] ?? null;
}

/** Seasons, deduped and in calendar order. Handles the retired `spring_fall`/`all`. */
export function snapSeasons(value: unknown): Season[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const out = new Set<Season>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const v = entry.trim().toLowerCase().replace(/[-\s]+/g, "_");
    // Retired collapsed forms. `spring_fall` is migration 0013's shape and
    // `all` was a sanitizer default that matched no filter anywhere; both
    // expand rather than being dropped, because they carry real intent.
    if (v === "spring_fall" || v === "fall_spring") { out.add("spring"); out.add("fall"); continue; }
    if (v === "all" || v === "all_season" || v === "all_year") {
      for (const s of SEASON_OPTIONS) out.add(s);
      continue;
    }
    const hit = SEASON_OPTIONS.find((s) => s === v);
    if (hit) out.add(hit);
  }
  return SEASON_OPTIONS.filter((s) => out.has(s));
}

/** Occasions, deduped and ordered least to most formal. */
export function snapOccasions(value: unknown): Occasion[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const out = new Set<Occasion>();
  for (const entry of raw) {
    const hit = normalizeOccasion(entry);
    if (hit) out.add(hit);
  }
  return OCCASION_OPTIONS.filter((o) => out.has(o));
}

/** The subset of item fields this module owns. */
export interface NormalizableItem {
  category?: string | null;
  pattern?: string | null;
  fit?: string | null;
  neckline?: string | null;
  material?: string | null;
  sleeveLength?: string | null;
  colorNormalized?: string | null;
  colorTemperature?: string | null;
  condition?: string | null;
  warmthRating?: number | null;
  seasons?: string[] | null;
  occasions?: string[] | null;
}

/**
 * Force every attribute on an item-shaped object onto its vocabulary.
 *
 * Called at the STORAGE boundary, not in a route handler, so no write path can
 * skip it. `snapToTaxonomy` was called in exactly one place — the scan
 * sanitizer — which meant `POST /api/items`, the update route, wishlist
 * promotion and outfit-log matches all wrote whatever they were handed. That is
 * how one row came to hold the literal string "null" in `fit`.
 *
 * ONLY KEYS PRESENT ON THE INPUT ARE TOUCHED. A partial update must not
 * resurrect a field the caller never mentioned, so `"pattern" in input` gates
 * every branch rather than `input.pattern != null`.
 *
 * An unrecognised value becomes null rather than being passed through. That is
 * a deliberate trade: a null reads as "unknown" everywhere and can be filled in
 * later, whereas a value outside the vocabulary renders as no selection in the
 * picker, matches no filter, and — as "Checkered" did — reaches an image model
 * as an instruction.
 */
export function normalizeItemAttributes<T extends NormalizableItem>(input: T): T {
  const out: any = { ...input };
  const category = input.category ?? undefined;

  if ("pattern" in input) out.pattern = snapPattern(input.pattern);
  if ("material" in input) out.material = snapMaterial(input.material);
  if ("fit" in input) out.fit = snapFit(category, input.fit);
  if ("neckline" in input) out.neckline = snapNeckline(category, input.neckline);
  if ("sleeveLength" in input) out.sleeveLength = snapSleeveLength(category, input.sleeveLength);
  if ("seasons" in input) out.seasons = snapSeasons(input.seasons);
  if ("occasions" in input) out.occasions = snapOccasions(input.occasions);
  if ("colorNormalized" in input) {
    out.colorNormalized = snapToVocabulary(input.colorNormalized, NORMALIZED_COLORS);
  }
  if ("colorTemperature" in input) {
    out.colorTemperature =
      snapToVocabulary(input.colorTemperature, COLOR_TEMPERATURE_OPTIONS) ??
      (out.colorNormalized
        ? COLOR_TEMPERATURE_MAP[out.colorNormalized as NormalizedColor] ?? null
        : null);
  }
  if ("condition" in input) {
    out.condition = snapToVocabulary(input.condition, CONDITION_OPTIONS);
  }
  if ("warmthRating" in input) {
    const n = typeof input.warmthRating === "number" ? Math.round(input.warmthRating) : NaN;
    out.warmthRating = Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
  }
  return out as T;
}
