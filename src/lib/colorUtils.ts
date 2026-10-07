import type { NormalizedColor } from '../types/item';

// ─── Color hex lookup map ─────────────────────────────────────────────────────

/**
 * Colour names as fabric, not as UI: muted, slightly warm values that read
 * like dyed cloth on a cream page, rather than saturated screen primaries
 * (a "brown" jumper is a deep brown, not saddle orange).
 */
export const COLOR_HEX_MAP: Record<string, string> = {
  black: '#1C1C1C',
  white: '#F7F6F2',
  ivory: '#F6F1E3',
  cream: '#F1E8D2',
  'off white': '#EEE9DF',
  'off-white': '#EEE9DF',
  ecru: '#E6DCC6',
  oatmeal: '#D8CDB8',
  stone: '#B9B0A3',
  red: '#B3261E',
  crimson: '#A51C30',
  scarlet: '#C8281E',
  burgundy: '#6D1A2A',
  maroon: '#5E1A1D',
  wine: '#5B2333',
  plum: '#5E2F4E',
  pink: '#E8A5B5',
  blush: '#E9C6C0',
  rose: '#C96A7A',
  coral: '#E57F6C',
  salmon: '#E79A84',
  rust: '#A4502C',
  terracotta: '#B85F3C',
  orange: '#D9692A',
  amber: '#D39A2C',
  ochre: '#C08A2B',
  yellow: '#E5C547',
  mustard: '#C99A2E',
  gold: '#C7A04A',
  lime: '#A3B84A',
  green: '#3F7D4E',
  emerald: '#2F7A57',
  olive: '#6E6B3A',
  'olive green': '#6E6B3A',
  'army green': '#4E5333',
  'forest green': '#2F5233',
  'hunter green': '#2F4A36',
  'dark green': '#24402F',
  sage: '#A7B29A',
  moss: '#7A7F4E',
  mint: '#A8D5C2',
  teal: '#2E6F6E',
  aqua: '#6FC3C9',
  cyan: '#4FB3C4',
  blue: '#3A5DA8',
  cobalt: '#2F4FA3',
  navy: '#1F2A44',
  'navy blue': '#1F2A44',
  denim: '#4A6A8E',
  'light wash': '#8EA9C6',
  'dark wash': '#2F3E57',
  sky: '#9CC3E4',
  'light blue': '#A9C6E2',
  'light-blue': '#A9C6E2',
  'baby blue': '#C8DCEF',
  indigo: '#3B3F7A',
  purple: '#6A4C93',
  violet: '#7B5BA6',
  lavender: '#C3B6DA',
  lilac: '#CDB5D8',
  mauve: '#B08A9E',
  brown: '#5D4030',
  chocolate: '#4A2E22',
  espresso: '#3B2A22',
  cognac: '#9A4E25',
  chestnut: '#6E3B22',
  tortoiseshell: '#6B4226',
  gum: '#B5813F',
  tan: '#C4A47E',
  khaki: '#B8A984',
  camel: '#B88B5A',
  sand: '#CDB998',
  beige: '#D9C8AD',
  taupe: '#8E7F72',
  grey: '#8A8A88',
  gray: '#8A8A88',
  'heather grey': '#A8A7A3',
  'heather gray': '#A8A7A3',
  'light grey': '#C9C8C4',
  'light gray': '#C9C8C4',
  'dark grey': '#4A4A48',
  'dark gray': '#4A4A48',
  charcoal: '#3A3A3A',
  silver: '#BDBDBD',
};

const PATTERN_KEYWORDS = ['multi', 'pattern', 'floral', 'stripe', 'plaid', 'check', 'print', 'camo'];

export function resolveHex(lower: string): string {
  if (COLOR_HEX_MAP[lower]) return COLOR_HEX_MAP[lower];
  // Longest name wins: "olive green" is olive, not green.
  let best: string | null = null;
  for (const key of Object.keys(COLOR_HEX_MAP)) {
    if ((lower.includes(key) || key.includes(lower)) && (!best || key.length > best.length)) best = key;
  }
  if (!best) return '#9CA3AF';
  const hex = COLOR_HEX_MAP[best];
  // "Light"/"dark" on a name without its own entry ("light pink", "deep
  // red") shifts the tone; a colour that is already that light or dark
  // ("dark navy") stays as it is.
  if (best.includes('light') || best.includes('dark')) return hex;
  const luminance = relativeLuminance(hex);
  if (/\b(light|pale|soft)\b/.test(lower) && luminance < 0.75) return mixHex(hex, '#FFFFFF', 0.45);
  if (/\b(dark|deep)\b/.test(lower) && luminance > 0.25) return mixHex(hex, '#000000', 0.35);
  return hex;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function mixHex(hex: string, toward: string, amount: number): string {
  const channel = (value: string, i: number) => parseInt(value.slice(i, i + 2), 16);
  return '#' + [1, 3, 5].map(i => Math.round(channel(hex, i) + (channel(toward, i) - channel(hex, i)) * amount)
    .toString(16).padStart(2, '0')).join('').toUpperCase();
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

const NORMALIZED_SYNONYMS: Record<string, NormalizedColor> = {
  gray: 'grey', charcoal: 'grey', 'light blue': 'light-blue', 'baby blue': 'light-blue', sky: 'light-blue',
  'navy blue': 'navy', 'olive green': 'olive', 'army green': 'olive', sage: 'olive', moss: 'olive',
  ivory: 'cream', 'off white': 'cream', 'off-white': 'cream', ecru: 'cream', oatmeal: 'beige', stone: 'beige',
  sand: 'beige', camel: 'tan', chocolate: 'brown', maroon: 'burgundy', wine: 'burgundy', lilac: 'lavender',
};

/**
 * Free-text colour ("olive green", "Light Grey") to a palette key, or null
 * when it doesn't map cleanly. Longest match wins, so "olive green" is olive.
 */
export function toNormalizedColor(raw: string | null | undefined): NormalizedColor | null {
  const lower = raw?.toLowerCase().trim().replace(/\s+/g, ' ');
  if (!lower) return null;
  if (lower.includes('/') || PATTERN_KEYWORDS.some((kw) => lower.includes(kw))) return 'multi';
  const keys = [...Object.keys(NORMALIZED_SYNONYMS), ...Object.keys(NORMALIZED_COLOR_HEX)];
  let best: string | null = null;
  for (const key of keys) {
    const k = key.replace('-', ' ');
    if (new RegExp(`\\b${k}\\b`).test(lower) && (!best || k.length > best.replace('-', ' ').length)) best = key;
  }
  if (!best) return null;
  return NORMALIZED_SYNONYMS[best] ?? (best as NormalizedColor);
}

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
