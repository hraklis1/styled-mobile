import type { StyleProfileDetails } from '../types/profile';

export type ProfileOption = {
  value: string;
  label: string;
  description?: string;
};

export type PaletteOption = ProfileOption & {
  colors: string[];
};

export const STYLE_OPTIONS: ProfileOption[] = [
  { value: 'minimalist', label: 'Minimalist', description: 'Clean lines, restraint, negative space' },
  { value: 'classic', label: 'Classic', description: 'Timeless staples and polished structure' },
  { value: 'casual', label: 'Casual', description: 'Easy everyday pieces with intention' },
  { value: 'trend_forward', label: 'Trend-forward', description: 'Current shapes, styling, and details' },
  { value: 'bohemian', label: 'Bohemian', description: 'Relaxed texture, print, and movement' },
  { value: 'edgy', label: 'Edgy', description: 'Sharper lines, contrast, statement pieces' },
  { value: 'streetwear', label: 'Streetwear', description: 'Relaxed proportions and urban codes' },
  { value: 'athleisure', label: 'Athleisure', description: 'Performance ease with polished styling' },
  { value: 'smart_casual', label: 'Smart casual', description: 'Refined but not formal' },
  { value: 'preppy', label: 'Preppy', description: 'Tailored collegiate polish' },
  { value: 'vintage', label: 'Vintage', description: 'Retro references and timeless finds' },
];

export const PALETTE_OPTIONS: PaletteOption[] = [
  { value: 'neutral', label: 'Neutral', colors: ['#F5F0E8', '#C8BAA8', '#9E8E7E', '#6B5B4E', '#2C2420'] },
  { value: 'earthy', label: 'Earthy', colors: ['#8B5E3C', '#C47A45', '#D4A853', '#7A8C50', '#5C4A3A'] },
  { value: 'monochrome', label: 'Monochrome', colors: ['#FFFFFF', '#D1D1D1', '#888888', '#444444', '#111111'] },
  { value: 'pastels', label: 'Pastels', colors: ['#F9D4D8', '#D5C5F0', '#C5E8D0', '#FAD7B5', '#B5D5F0'] },
  { value: 'jewel', label: 'Jewel', colors: ['#15803D', '#1D4ED8', '#B91C1C', '#7E22CE', '#D97706'] },
  { value: 'bright', label: 'Bright', colors: ['#EF4444', '#EAB308', '#3B82F6', '#F97316', '#22C55E'] },
];

export const BUDGET_OPTIONS: ProfileOption[] = [
  { value: 'value_thrift', label: 'Value / thrift ($)' },
  { value: 'contemporary_mid', label: 'Contemporary ($$)' },
  { value: 'premium', label: 'Premium ($$$)' },
  { value: 'luxury_high_end', label: 'Luxury ($$$$)' },
];

export const BODY_TYPE_OPTIONS: ProfileOption[] = [
  { value: 'broad_shoulders', label: 'Broad shoulders', description: 'Upper body is the widest point' },
  { value: 'straight_frame', label: 'Straight frame', description: 'Shoulders and hips are similar' },
  { value: 'wider_lower_body', label: 'Wider lower body', description: 'Hips or thighs are fuller' },
  { value: 'balanced', label: 'Balanced', description: 'Proportions feel even overall' },
  { value: 'fuller_midsection', label: 'Fuller midsection', description: 'Comfort through the torso matters' },
  { value: 'petite', label: 'Petite', description: 'Shorter stature or compact scale' },
  { value: 'tall', label: 'Tall', description: 'Length and proportion need extra attention' },
  { value: 'long_torso', label: 'Long torso', description: 'Rise and top length are key' },
  { value: 'long_legs', label: 'Long legs', description: 'Inseam and balance are key' },
];

export const FIT_PREFERENCE_OPTIONS: ProfileOption[] = [
  { value: 'masculine_cut', label: "Men's / masc." },
  { value: 'feminine_cut', label: "Women's / fem." },
  { value: 'neutral_fluid', label: 'Unisex / fluid' },
];

export const FIT_SILHOUETTE_OPTIONS: ProfileOption[] = [
  { value: 'relaxed', label: 'Relaxed', description: 'Roomy and easy' },
  { value: 'classic', label: 'Classic', description: 'True to size' },
  { value: 'tailored', label: 'Tailored', description: 'Clean and shaped' },
  { value: 'oversized', label: 'Oversized', description: 'Intentionally generous' },
  { value: 'fitted', label: 'Fitted', description: 'Close to the body' },
];

export const SIZING_REGION_OPTIONS: ProfileOption[] = [
  { value: 'US', label: 'US' },
  { value: 'UK', label: 'UK' },
  { value: 'EU', label: 'EU' },
];

export const TOP_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export const OCCASION_OPTIONS: ProfileOption[] = [
  { value: 'everyday', label: 'Everyday' },
  { value: 'work_office', label: 'Work / office' },
  { value: 'casual_weekend', label: 'Casual / weekend' },
  { value: 'date_night', label: 'Date night' },
  { value: 'formal_events', label: 'Formal / events' },
  { value: 'athletic_active', label: 'Athletic / active' },
  { value: 'travel', label: 'Travel' },
  { value: 'smart_casual', label: 'Smart casual' },
  { value: 'night_out', label: 'Nights out' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'wedding_guest', label: 'Wedding / guest' },
  { value: 'interview', label: 'Interview' },
  { value: 'school', label: 'School' },
];

export const COLOR_UNDERTONE_OPTIONS: ProfileOption[] = [
  { value: 'warm', label: 'Warm' },
  { value: 'cool', label: 'Cool' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'olive', label: 'Olive' },
  { value: 'unsure', label: 'Unsure' },
];

export const COLOR_CONTRAST_OPTIONS: ProfileOption[] = [
  { value: 'low', label: 'Low contrast' },
  { value: 'medium', label: 'Medium contrast' },
  { value: 'high', label: 'High contrast' },
  { value: 'unsure', label: 'Unsure' },
];

export const METAL_OPTIONS: ProfileOption[] = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'rose_gold', label: 'Rose gold' },
  { value: 'mixed', label: 'Mixed metals' },
];

export const MATERIAL_OPTIONS: ProfileOption[] = [
  { value: 'cotton', label: 'Cotton' },
  { value: 'linen', label: 'Linen' },
  { value: 'silk', label: 'Silk' },
  { value: 'wool', label: 'Wool' },
  { value: 'cashmere', label: 'Cashmere' },
  { value: 'knit', label: 'Knit' },
  { value: 'leather', label: 'Leather' },
  { value: 'denim', label: 'Denim' },
  { value: 'sueded_textured', label: 'Sueded / textured' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'sheer', label: 'Sheer' },
  { value: 'heavyweight', label: 'Heavyweight' },
  { value: 'lightweight', label: 'Lightweight' },
  { value: 'technical', label: 'Technical fabrics' },
  { value: 'synthetics', label: 'Synthetics' },
];

export const PATTERN_OPTIONS: ProfileOption[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'plaid', label: 'Plaid' },
  { value: 'floral', label: 'Floral' },
  { value: 'animal', label: 'Animal' },
  { value: 'polka_dot', label: 'Polka dot' },
  { value: 'geometric', label: 'Geometric' },
  { value: 'paisley', label: 'Paisley' },
  { value: 'textured', label: 'Textured' },
  { value: 'novelty', label: 'Novelty' },
  { value: 'graphic', label: 'Graphic' },
  { value: 'logo', label: 'Logo' },
  { value: 'abstract', label: 'Abstract' },
];

export const SHOPPING_PRIORITY_OPTIONS: ProfileOption[] = [
  { value: 'quality_fabrics', label: 'Quality fabrics' },
  { value: 'tailoring', label: 'Tailoring' },
  { value: 'comfort', label: 'Comfort' },
  { value: 'investment_pieces', label: 'Investment pieces' },
  { value: 'sustainable', label: 'Sustainable choices' },
  { value: 'easy_returns', label: 'Easy returns' },
  { value: 'inclusive_sizing', label: 'Inclusive sizing' },
  { value: 'sale_value', label: 'Sale value' },
];

export const CARE_CONSTRAINT_OPTIONS: ProfileOption[] = [
  { value: 'machine_wash', label: 'Machine washable' },
  { value: 'no_dry_clean', label: 'Avoid dry clean only' },
  { value: 'low_maintenance', label: 'Low maintenance' },
  { value: 'travel_friendly', label: 'Travel friendly' },
  { value: 'pet_friendly', label: 'Pet friendly fabrics' },
  { value: 'commute_ready', label: 'Commute ready' },
];

export const CATEGORY_BUDGET_KEYS = [
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'shoes',
  'bags',
  'accessories',
] as const;

export const CATEGORY_BUDGET_LABELS: Record<(typeof CATEGORY_BUDGET_KEYS)[number], string> = {
  tops: 'Tops',
  bottoms: 'Bottoms',
  dresses: 'Dresses',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  bags: 'Bags',
  accessories: 'Accessories',
};

export const SENSITIVE_PROPORTION_OPTIONS: ProfileOption[] = [
  { value: 'short_torso', label: 'Short torso' },
  { value: 'long_torso', label: 'Long torso' },
  { value: 'short_waist', label: 'Short waist' },
  { value: 'broad_shoulders', label: 'Broad shoulders' },
  { value: 'narrow_shoulders', label: 'Narrow shoulders' },
  { value: 'full_bust', label: 'Full bust' },
  { value: 'curvy_hips', label: 'Curvy hips' },
];

export const COVERAGE_OPTIONS: ProfileOption[] = [
  { value: 'higher_necklines', label: 'Higher necklines' },
  { value: 'lower_necklines', label: 'Lower necklines' },
  { value: 'sleeves', label: 'Sleeves' },
  { value: 'longer_hemlines', label: 'Longer hemlines' },
  { value: 'waist_definition', label: 'Waist definition' },
  { value: 'avoid_cling', label: 'Avoid cling' },
];

export const COMFORT_OPTIONS: ProfileOption[] = [
  { value: 'runs_warm', label: 'Runs warm' },
  { value: 'runs_cold', label: 'Runs cold' },
  { value: 'sensitive_skin', label: 'Sensitive skin' },
  { value: 'needs_stretch', label: 'Needs stretch' },
  { value: 'commute_shoes', label: 'Walkable shoes' },
  { value: 'desk_to_dinner', label: 'Desk to dinner' },
];

const STYLE_ALIASES: Record<string, string> = {
  trendy: 'trend_forward',
  'smart casual': 'smart_casual',
  grunge: 'edgy',
};

const BUDGET_ALIASES: Record<string, string> = {
  thrift: 'value_thrift',
  mid: 'contemporary_mid',
  luxury: 'luxury_high_end',
};

const BODY_ALIASES: Record<string, string> = {
  broad_shoulders: 'broad_shoulders',
  straight: 'straight_frame',
  wider_lower: 'wider_lower_body',
  petite: 'petite',
  slim_fit: 'straight_frame',
  athletic_tailored: 'balanced',
  regular_average: 'balanced',
  relaxed_broad: 'broad_shoulders',
};

const OCCASION_ALIASES: Record<string, string> = {
  casual: 'casual_weekend',
  work: 'work_office',
  nights_out: 'night_out',
  formal: 'formal_events',
  active: 'athletic_active',
};

const FIT_SILHOUETTE_ALIASES = new Set(['relaxed', 'classic', 'fitted']);

function normalizeOne(value: string, aliases: Record<string, string>): string {
  const trimmed = value.trim();
  return aliases[trimmed] ?? trimmed;
}

export function uniqueClean(values: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function withoutConflicts(values: readonly string[] | null | undefined, blockers: readonly string[] | null | undefined): string[] {
  const blocked = new Set(uniqueClean(blockers));
  return uniqueClean(values).filter((value) => !blocked.has(value));
}

export function normalizeStylePreference(values: readonly string[] | null | undefined): string[] {
  return uniqueClean(uniqueClean(values).map((value) => normalizeOne(value, STYLE_ALIASES)));
}

export function normalizeBudgetRange(value: string | null | undefined): string {
  return value ? normalizeOne(value, BUDGET_ALIASES) : '';
}

export function normalizeBodyType(value: string | null | undefined): string {
  return value ? normalizeOne(value, BODY_ALIASES) : '';
}

export function normalizeOccasions(values: readonly string[] | null | undefined): string[] {
  return uniqueClean(uniqueClean(values).map((value) => normalizeOne(value, OCCASION_ALIASES)));
}

export function normalizeFitFields(
  fitPreference: string | null | undefined,
  fitSilhouette: string | null | undefined,
): { fitPreference: string; fitSilhouette: string } {
  const fit = fitPreference?.trim() ?? '';
  const silhouette = fitSilhouette?.trim() ?? '';

  if (fit && FIT_SILHOUETTE_ALIASES.has(fit)) {
    return { fitPreference: '', fitSilhouette: silhouette || fit };
  }

  return { fitPreference: fit, fitSilhouette: silhouette };
}

export function createEmptyStyleProfileDetails(): StyleProfileDetails {
  return {
    version: 1,
    styleAvoids: [],
    favoriteColors: [],
    avoidedColors: [],
    colorAnalysis: { undertone: null, contrast: null, metalPreference: [] },
    materialLikes: [],
    materialAvoids: [],
    patternLikes: [],
    patternAvoids: [],
    brandAvoids: [],
    shoppingPriorities: [],
    careConstraints: [],
    categoryBudgets: {},
    sizeExtras: {},
    sensitiveFit: { proportions: [], coverage: [], comfort: [], notes: null },
  };
}

function cleanNullable(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanObjectStrings<T extends Record<string, string | null | undefined>>(value: T | undefined): T {
  const out = { ...(value ?? {}) } as T;
  for (const key of Object.keys(out) as Array<keyof T>) {
    out[key] = cleanNullable(out[key]) as T[keyof T];
  }
  return out;
}

export function normalizeStyleProfileDetails(raw: unknown): StyleProfileDetails {
  const base = createEmptyStyleProfileDetails();
  if (!raw || typeof raw !== 'object') return base;

  const details = raw as Partial<StyleProfileDetails>;
  const colorAnalysis = details.colorAnalysis ?? base.colorAnalysis;
  const sensitiveFit = details.sensitiveFit ?? base.sensitiveFit;
  const materialAvoids = uniqueClean(details.materialAvoids);
  const patternAvoids = uniqueClean(details.patternAvoids);

  return {
    version: 1,
    styleAvoids: uniqueClean(details.styleAvoids),
    favoriteColors: uniqueClean(details.favoriteColors),
    avoidedColors: uniqueClean(details.avoidedColors),
    colorAnalysis: {
      undertone: cleanNullable(colorAnalysis.undertone),
      contrast: cleanNullable(colorAnalysis.contrast),
      metalPreference: uniqueClean(colorAnalysis.metalPreference),
    },
    materialLikes: withoutConflicts(details.materialLikes, materialAvoids),
    materialAvoids,
    patternLikes: withoutConflicts(details.patternLikes, patternAvoids),
    patternAvoids,
    brandAvoids: uniqueClean(details.brandAvoids),
    shoppingPriorities: uniqueClean(details.shoppingPriorities),
    careConstraints: uniqueClean(details.careConstraints),
    categoryBudgets: cleanObjectStrings(details.categoryBudgets),
    sizeExtras: cleanObjectStrings(details.sizeExtras),
    sensitiveFit: {
      proportions: uniqueClean(sensitiveFit.proportions),
      coverage: uniqueClean(sensitiveFit.coverage),
      comfort: uniqueClean(sensitiveFit.comfort),
      notes: cleanNullable(sensitiveFit.notes),
    },
  };
}

export function hasStyleProfileDetailsValue(details: StyleProfileDetails): boolean {
  const normalized = normalizeStyleProfileDetails(details);
  return (
    normalized.styleAvoids.length > 0 ||
    normalized.favoriteColors.length > 0 ||
    normalized.avoidedColors.length > 0 ||
    !!normalized.colorAnalysis.undertone ||
    !!normalized.colorAnalysis.contrast ||
    normalized.colorAnalysis.metalPreference.length > 0 ||
    normalized.materialLikes.length > 0 ||
    normalized.materialAvoids.length > 0 ||
    normalized.patternLikes.length > 0 ||
    normalized.patternAvoids.length > 0 ||
    normalized.brandAvoids.length > 0 ||
    normalized.shoppingPriorities.length > 0 ||
    normalized.careConstraints.length > 0 ||
    Object.values(normalized.categoryBudgets).some(Boolean) ||
    Object.values(normalized.sizeExtras).some(Boolean) ||
    normalized.sensitiveFit.proportions.length > 0 ||
    normalized.sensitiveFit.coverage.length > 0 ||
    normalized.sensitiveFit.comfort.length > 0 ||
    !!normalized.sensitiveFit.notes
  );
}

export function optionLabel(options: readonly ProfileOption[], value: string | null | undefined): string {
  return options.find((option) => option.value === value)?.label ?? value ?? '';
}

export function optionLabels(options: readonly ProfileOption[], values: readonly string[]): string[] {
  return values.map((value) => optionLabel(options, value)).filter(Boolean);
}
