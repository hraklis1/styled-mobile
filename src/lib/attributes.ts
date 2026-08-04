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

export const OCCASION_OPTIONS = [
  "casual", "smart_casual", "business", "formal", "party", "workout",
] as const;
export type Occasion = typeof OCCASION_OPTIONS[number];
export const OCCASION_LABELS: Record<Occasion, string> = {
  casual:       "Casual",
  smart_casual: "Smart Casual",
  business:     "Business",
  formal:       "Formal",
  party:        "Party",
  workout:      "Workout",
};

/**
 * The finer formality tags, stored alongside `occasions`.
 *
 * Two vocabularies for one axis, both filled by the same scan and both read by
 * the stylist. They are merged in a later phase; until then this is the
 * canonical spelling and `shared/schema.ts` re-exports it.
 */
export const FORMALITY_STYLE_TAGS = [
  "Athleisure", "Lounge", "Casual", "Smart Casual",
  "Business Casual", "Professional", "Night Out", "Formal",
] as const;
export type FormalityStyleTag = typeof FORMALITY_STYLE_TAGS[number];

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
 */
export const MATERIAL_OPTIONS = [
  "Acrylic", "Bamboo", "Cashmere", "Chiffon", "Corduroy", "Cotton",
  "Denim", "Elastane", "Flannel", "Fleece", "Hemp", "Latex",
  "Leather", "Linen", "Lyocell", "Mesh", "Modal", "Neoprene",
  "Nylon", "Organza", "Polyamide", "Polyester", "Rayon", "Rubber",
  "Satin", "Silk", "Spandex", "Suede", "Tencel", "Tweed",
  "Velvet", "Viscose", "Wool",
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
