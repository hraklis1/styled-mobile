/**
 * Item types, and the app-facing surface for the shared attribute vocabularies.
 *
 * The vocabularies themselves live in `src/lib/attributes.ts`, a byte-for-byte
 * mirror of `../Styled/shared/attributes.ts`. DO NOT EDIT THE MIRROR HERE —
 * edit the backend copy and re-run `npm run check:vocab` there, which fails
 * when the two drift apart. That check is the entire price of keeping the two
 * repos decoupled, and drift is not hypothetical: `seasons` once reached four
 * different vocabularies at the same time.
 *
 * They are re-exported through this module because ~50 files already import
 * them from here.
 */
export {
  ITEM_CATEGORIES,
  type ItemCategory,
  NECKLINE_CATEGORIES,
  SLEEVE_CATEGORIES,
  FIT_CATEGORIES,
  SEASON_OPTIONS,
  SEASON_LABELS,
  type Season,
  OCCASION_OPTIONS,
  OCCASION_LABELS,
  type Occasion,
  CONDITION_OPTIONS,
  CONDITION_LABELS,
  type ItemCondition,
  NORMALIZED_COLORS,
  type NormalizedColor,
  COLOR_TEMPERATURE_OPTIONS,
  COLOR_TEMPERATURE_LABELS,
  type ColorTemperature,
  WARMTH_RATINGS,
  WARMTH_LABELS,
  SLEEVE_LENGTH_OPTIONS,
  SLEEVE_LENGTH_LABELS,
  type SleeveLength,
  PATTERN_OPTIONS,
  type Pattern,
  NECKLINE_OPTIONS_BY_CATEGORY,
  FIT_OPTIONS_BY_CATEGORY,
  FIT_OPTIONS_DEFAULT,
  MATERIAL_OPTIONS,
  type Material,
  CARE_OPTIONS,
} from '../lib/attributes';

import { ITEM_CATEGORIES, type ItemCategory, type SleeveLength } from '../lib/attributes';

export const COVER_IMAGE_VARIANTS = ['original', 'cutout', 'polished'] as const;
export type CoverImageVariant = typeof COVER_IMAGE_VARIANTS[number];

/**
 * Display labels are deliberately NOT shared with the backend.
 *
 * `CATEGORY_DISPLAY_NAMES` there says "Footwear" and "Full Body"; the app says
 * "Shoes" and "Dresses & Sets". That is product copy for two different
 * surfaces, not a vocabulary — the STORED values are what has to agree, and
 * those are shared.
 */
export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  top:        'Tops',
  bottom:     'Bottoms',
  full_body:  'Dresses & Sets',
  shoes:      'Shoes',
  outerwear:  'Outerwear',
  accessory:  'Accessories',
  valuables:  'Valuables',
};

export const CATEGORY_ORDER: ItemCategory[] = [...ITEM_CATEGORIES];


export type ScanResult = {
  name: string;
  brand: string | null;
  category: ItemCategory | null;
  color: string | null;
  tags: string[];
  subcategory: string | null;
  style: string | null;
  seasons: string[];
  occasions: string[];
  pattern: string | null;
  fit: string | null;
  neckline: string | null;
  sleeveLength: SleeveLength | null;
  material: string | null;
  care: string | null;
  notableDetails: string[];
  colorPalette: string[];
  colorNormalized: string | null;
  colorTemperature: string | null;
  warmthRating: number | null;
};

export type Item = {
  id: number;
  name: string;
  userId: number;
  imageUrl: string | null;
  /**
   * Background-removed thumbnail (transparent WebP). Retained independently
   * for processing and as an optional user-selected cover. Null when the item
   * predates cutouts, segmentation was unavailable, or generation failed.
   */
  cutoutUrl: string | null;
  /**
   * Generative "Polish" result — an idealised catalog shot. Kept separate so
   * the faithful cutout and original photo both survive cover changes.
   */
  polishedUrl: string | null;
  /**
   * Small WebP list/grid thumbnail derived from imageUrl, generated
   * server-side. Null for items predating the thumbnail system or when
   * generation failed — callers fall back to imageUrl in that case. Only
   * ever backs the 'original' cover variant; cutout/polished are already
   * small enough to render directly.
   */
  thumbUrl: string | null;
  /**
   * The asset selected to represent this item across the app. This preference
   * never owns or deletes any image; imageUrl, cutoutUrl, and polishedUrl stay
   * available independently.
   */
  coverImageVariant: CoverImageVariant;
  color: string | null;
  colorPalette: string[];
  colorNormalized: string | null;
  colorTemperature: string | null;
  category: ItemCategory | null;
  subcategory: string | null;
  brand: string | null;
  style: string | null;
  seasons: string[];
  occasions: string[];
  material: string | null;
  fit: string | null;
  pattern: string | null;
  neckline: string | null;
  sleeveLength: SleeveLength | null;
  tags: string[];
  notableDetails: string[];
  notes: string | null;
  care: string | null;
  condition: string | null;
  warmthRating: number | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  purchaseLocation?: string | null;
  wearCount: number;
  lastWornAt: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
};
