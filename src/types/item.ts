export type ItemCategory =
  | 'top'
  | 'bottom'
  | 'full_body'
  | 'shoes'
  | 'outerwear'
  | 'accessory'
  | 'valuables';

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  top:        'Tops',
  bottom:     'Bottoms',
  full_body:  'Dresses & Sets',
  shoes:      'Shoes',
  outerwear:  'Outerwear',
  accessory:  'Accessories',
  valuables:  'Valuables',
};

export const CATEGORY_ORDER: ItemCategory[] = [
  'top', 'bottom', 'full_body', 'shoes', 'outerwear', 'accessory', 'valuables',
];

export const SEASON_OPTIONS = ['spring', 'summer', 'fall', 'winter'] as const;
export type Season = typeof SEASON_OPTIONS[number];
export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall:   'Fall',
  winter: 'Winter',
};

export const OCCASION_OPTIONS = ['casual', 'smart_casual', 'business', 'formal', 'party', 'workout'] as const;
export type Occasion = typeof OCCASION_OPTIONS[number];
export const OCCASION_LABELS: Record<Occasion, string> = {
  casual:       'Casual',
  smart_casual: 'Smart Casual',
  business:     'Business',
  formal:       'Formal',
  party:        'Party',
  workout:      'Workout',
};

export const CONDITION_OPTIONS = ['new', 'good', 'worn', 'needs_repair', 'donate'] as const;
export type ItemCondition = typeof CONDITION_OPTIONS[number];
export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new:          'New',
  good:         'Good',
  worn:         'Worn',
  needs_repair: 'Needs Repair',
  donate:       'Donate',
};

export const NORMALIZED_COLORS = [
  'black', 'white', 'grey', 'navy', 'blue', 'light-blue',
  'green', 'olive', 'khaki', 'red', 'burgundy', 'pink',
  'orange', 'yellow', 'brown', 'tan', 'beige', 'cream',
  'purple', 'lavender', 'gold', 'silver', 'multi',
] as const;
export type NormalizedColor = typeof NORMALIZED_COLORS[number];

export const WARMTH_LABELS: Record<number, string> = {
  1: 'Very Light', 2: 'Light', 3: 'Medium', 4: 'Warm', 5: 'Very Warm',
};

export const SLEEVE_LENGTH_OPTIONS = ['short', 'long', 'sleeveless'] as const;
export type SleeveLength = typeof SLEEVE_LENGTH_OPTIONS[number];
export const SLEEVE_LENGTH_LABELS: Record<SleeveLength, string> = {
  short:      'Short Sleeve',
  long:       'Long Sleeve',
  sleeveless: 'Sleeveless',
};

export const PATTERN_OPTIONS = [
  'Solid', 'Striped', 'Plaid / Tartan', 'Checked', 'Houndstooth',
  'Floral', 'Geometric', 'Abstract', 'Animal Print', 'Camouflage',
  'Tie-Dye', 'Ombré', 'Graphic / Print', 'Textured',
] as const;
export type Pattern = typeof PATTERN_OPTIONS[number];

export const NECKLINE_OPTIONS_BY_CATEGORY: Partial<Record<ItemCategory, string[]>> = {
  top: [
    'Crew Neck', 'V-Neck', 'Scoop Neck', 'Square Neck', 'Boat Neck / Bateau',
    'Turtleneck', 'Mock Neck', 'Cowl Neck', 'Off-Shoulder', 'One-Shoulder',
    'Halter', 'Strapless', 'Keyhole', 'Henley', 'Collared', 'Polo', 'Wrap', 'Sweetheart',
  ],
  outerwear: [
    'Collared', 'Lapel / Notch', 'Peaked Lapel', 'Shawl Collar', 'Stand Collar',
    'Hood', 'Funnel Neck', 'Turtleneck', 'Crew Neck', 'V-Neck',
  ],
  full_body: [
    'Crew Neck', 'V-Neck', 'Scoop Neck', 'Square Neck', 'Boat Neck / Bateau',
    'Off-Shoulder', 'One-Shoulder', 'Halter', 'Strapless', 'Sweetheart', 'Wrap', 'Cowl Neck',
  ],
};

export const COLOR_TEMPERATURE_OPTIONS = [
  { value: 'warm', label: 'Warm' },
  { value: 'cool', label: 'Cool' },
  { value: 'neutral', label: 'Neutral' },
] as const;
export type ColorTemperature = typeof COLOR_TEMPERATURE_OPTIONS[number]['value'];

export const MATERIAL_OPTIONS = [
  'Acrylic', 'Bamboo', 'Cashmere', 'Chiffon', 'Corduroy', 'Cotton',
  'Denim', 'Elastane', 'Flannel', 'Fleece', 'Hemp', 'Latex',
  'Leather', 'Linen', 'Lyocell', 'Mesh', 'Modal', 'Neoprene',
  'Nylon', 'Organza', 'Polyamide', 'Polyester', 'Rayon', 'Rubber',
  'Satin', 'Silk', 'Spandex', 'Suede', 'Tencel', 'Tweed',
  'Velvet', 'Viscose', 'Wool',
] as const;

export const CARE_OPTIONS = [
  'Machine Wash Cold', 'Machine Wash Warm', 'Hand Wash Only', 'Dry Clean Only',
  'Tumble Dry Low', 'Tumble Dry Medium', 'No Tumble Dry', 'Hang Dry',
  'Lay Flat to Dry', 'Iron Low Heat', 'Iron Medium Heat', 'Do Not Iron',
  'Dry Clean or Hand Wash', 'Spot Clean Only',
] as const;

export const LAUNDRY_STATUS_OPTIONS = ['clean', 'in_wash', 'in_storage'] as const;
export type LaundryStatus = typeof LAUNDRY_STATUS_OPTIONS[number];
export const LAUNDRY_STATUS_LABELS: Record<LaundryStatus, string> = {
  clean:      'Clean',
  in_wash:    'In the Wash',
  in_storage: 'In Storage',
};

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
  formalityStyles: string[];
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
  formalityStyles: string[];
  notableDetails: string[];
  notes: string | null;
  care: string | null;
  condition: string | null;
  warmthRating: number | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  wearCount: number;
  lastWornAt: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  laundryStatus?: LaundryStatus | null;
  createdAt: string;
};
