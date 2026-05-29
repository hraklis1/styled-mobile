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

export type ScanResult = {
  name: string;
  brand: string | null;
  category: ItemCategory | null;
  color: string | null;
  tags: string[];
  subcategory: string | null;
  style: string | null;
  season: string | null;
  occasion: string | null;
  pattern: string | null;
  fit: string | null;
  neckline: string | null;
  material: string | null;
  care: string | null;
  formalityStyles: string[];
  notableDetails: string[];
  colorPalette: string[];
};

export type Item = {
  id: number;
  name: string;
  userId: number;
  imageUrl: string | null;
  color: string | null;
  colorPalette: string[];
  category: ItemCategory | null;
  subcategory: string | null;
  brand: string | null;
  style: string | null;
  occasion: string | null;
  season: string | null;
  material: string | null;
  fit: string | null;
  pattern: string | null;
  neckline: string | null;
  tags: string[];
  formalityStyles: string[];
  notableDetails: string[];
  notes: string | null;
  care: string | null;
  wearCount: number;
  lastWornAt: string | null;
  isFavorite: boolean;
  createdAt: string;
};
