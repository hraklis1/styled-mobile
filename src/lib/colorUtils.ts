import type { NormalizedColor } from '../types/item';

// ─── Color hex lookup map ─────────────────────────────────────────────────────

export const COLOR_HEX_MAP: Record<string, string> = {
  black: '#1A1A1A',
  white: '#F5F5F5',
  ivory: '#FFFFF0',
  cream: '#FFF8E7',
  'off white': '#F5F0E8',
  'off-white': '#F5F0E8',
  red: '#DC2626',
  crimson: '#DC143C',
  scarlet: '#FF2400',
  burgundy: '#800020',
  maroon: '#800000',
  wine: '#722F37',
  pink: '#F472B6',
  blush: '#FFBCBB',
  rose: '#F43F5E',
  coral: '#FF6B6B',
  salmon: '#FA8072',
  orange: '#EA580C',
  amber: '#F59E0B',
  yellow: '#EAB308',
  mustard: '#D4900A',
  gold: '#D4AF37',
  lime: '#84CC16',
  green: '#16A34A',
  olive: '#6B7C23',
  sage: '#B2C29C',
  mint: '#3EB489',
  teal: '#0D9488',
  aqua: '#00BCD4',
  cyan: '#06B6D4',
  blue: '#2563EB',
  cobalt: '#0047AB',
  navy: '#1B2A4A',
  'navy blue': '#1B2A4A',
  sky: '#7DD3FC',
  'light blue': '#93C5FD',
  'baby blue': '#BFDBFE',
  indigo: '#4338CA',
  purple: '#7C3AED',
  violet: '#7C3AED',
  lavender: '#C4B5FD',
  lilac: '#D8B4FE',
  mauve: '#E0B0FF',
  brown: '#92400E',
  tan: '#D2B48C',
  khaki: '#C3B091',
  camel: '#C19A6B',
  sand: '#C2B280',
  beige: '#D4C5A9',
  taupe: '#9E8E7E',
  grey: '#6B7280',
  gray: '#6B7280',
  'light-blue': '#93C5FD',
  'light grey': '#D1D5DB',
  'light gray': '#D1D5DB',
  'dark grey': '#374151',
  'dark gray': '#374151',
  charcoal: '#374151',
  silver: '#C0C0C0',
};

const PATTERN_KEYWORDS = ['multi', 'pattern', 'floral', 'stripe', 'plaid', 'check', 'print', 'camo'];

export function resolveHex(lower: string): string {
  if (COLOR_HEX_MAP[lower]) return COLOR_HEX_MAP[lower];
  for (const [key, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return hex;
  }
  return '#9CA3AF';
}

export function getSwatchColor(name: string): { primary: string; secondary?: string } {
  const lower = name.toLowerCase().trim();
  if (lower.includes('/')) {
    const [a, b] = lower.split('/').map(s => s.trim());
    return { primary: resolveHex(a), secondary: resolveHex(b ?? '') };
  }
  if (PATTERN_KEYWORDS.some(kw => lower.includes(kw))) {
    return { primary: '#C8B9A8', secondary: '#7D7168' };
  }
  return { primary: resolveHex(lower) };
}

export function isColorLight(hex: string): boolean {
  if (!hex.startsWith('#') || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// ─── Normalized color hex map (for the 23 NormalizedColor enum values) ────────

export const NORMALIZED_COLOR_HEX: Record<NormalizedColor, string> = {
  black:      '#1A1A1A',
  white:      '#F5F5F5',
  grey:       '#6B7280',
  navy:       '#1B2A4A',
  blue:       '#2563EB',
  'light-blue': '#93C5FD',
  green:      '#16A34A',
  olive:      '#6B7C23',
  khaki:      '#C3B091',
  red:        '#DC2626',
  burgundy:   '#800020',
  pink:       '#F472B6',
  orange:     '#EA580C',
  yellow:     '#EAB308',
  brown:      '#92400E',
  tan:        '#D2B48C',
  beige:      '#D4C5A9',
  cream:      '#FFF8E7',
  purple:     '#7C3AED',
  lavender:   '#C4B5FD',
  gold:       '#D4AF37',
  silver:     '#C0C0C0',
  multi:      '#C8B9A8',
};

export function normalizedColorDisplayName(color: NormalizedColor): string {
  return color.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Material parser ──────────────────────────────────────────────────────────

const KNOWN_MATERIALS_LOWER = [
  'cotton', 'polyester', 'spandex', 'elastane', 'nylon', 'wool', 'cashmere',
  'silk', 'linen', 'rayon', 'viscose', 'modal', 'lyocell', 'tencel', 'bamboo',
  'leather', 'suede', 'velvet', 'denim', 'fleece', 'acrylic', 'latex',
  'rubber', 'neoprene', 'mesh', 'organza', 'chiffon', 'satin', 'tweed',
  'corduroy', 'flannel', 'hemp', 'polyamide',
];

export function parseMaterialString(raw: string): string[] {
  if (!raw || raw.toLowerCase() === 'null') return [];
  const lower = raw.toLowerCase();
  const found: string[] = [];
  for (const m of KNOWN_MATERIALS_LOWER) {
    if (lower.includes(m) && !found.includes(m))
      found.push(m.charAt(0).toUpperCase() + m.slice(1));
  }
  return found;
}
