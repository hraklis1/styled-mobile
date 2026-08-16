import { Platform } from 'react-native';

// Translated from the web app's HSL CSS variables (index.css)
export const colors = {
  background:          '#FBFAF7', // Warm ivory
  foreground:          '#1D1B18', // Soft fashion black
  card:                '#F3F0EA',
  surfaceElevated:     '#FFFFFF',
  surfaceSubtle:       '#F5F3EE',
  surfaceSelected:     '#ECE6DA',
  primary:             '#6F5948', // Disciplined atelier taupe
  primaryForeground:   '#FFFCF7',
  secondary:           '#EDEAE3',
  secondaryForeground: '#403A33',
  muted:               '#EEECE6',
  mutedForeground:     '#746E66',
  accent:              '#E8DED1',
  // Muted terracotta, reserved for interactive *text* (links, inline actions) so
  // a tappable phrase is distinguishable from the taupe used for brand
  // structure and status. Not for filled buttons — those stay `primary`.
  action:              '#9A5B42',
  border:              '#E1DCD3',
  hairline:            '#EEEAE3',
  inkSubtle:           '#4E4841',
  error:               '#B94242',
  destructive:         '#BF4040', // Alias for error
  success:             '#4A7D59',
  white:               '#FFFFFF',
} as const;

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  xxxl: 48,
} as const;

const weight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
};

export const typography = {
  family: {
    display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  size: {
    xs:   12,
    sm:   13,
    md:   15,
    lg:   17,
    xl:   20,
    xxl:  28,
    xxxl: 40,
  },
  /**
   * The serif editorial face's own scale — mastheads, hero headlines, and the
   * titles of pages that are read rather than operated. Sizes only: callers
   * still apply `family.display` and a colour, because a display line set over
   * photography needs different colour handling than one on the page ground.
   *
   * `lg` is a page masthead, `md` a section or card hero, `sm` a compact header
   * title. Anything smaller belongs in `size`, set in the system face.
   */
  display: {
    lg: { fontSize: 34, lineHeight: 39 },
    md: { fontSize: 28, lineHeight: 33 },
    sm: { fontSize: 22, lineHeight: 26 },
  },
  weight,
  /**
   * The small letterspaced label above a title. Two sizes only — `eyebrow` sits
   * over card and section titles, `eyebrowLarge` over a page masthead, where
   * the wider tracking has room to read.
   *
   * Complete style objects rather than tokens: an eyebrow is always all four of
   * these properties together, and the drift they replaced (four different
   * letter-spacings across the app) came from setting them one at a time.
   */
  eyebrow: {
    fontSize: 10,
    fontWeight: weight.bold,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  eyebrowLarge: {
    fontSize: 11,
    fontWeight: weight.bold,
    letterSpacing: 2.1,
    textTransform: 'uppercase' as const,
  },
  lineHeight: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.75,
  },
  /**
   * Line height for a single-line `TextInput`.
   *
   * On iOS (RN 0.85) a TextInput draws its *placeholder* using the font's
   * default line metrics rather than the box it lays out typed text in. The
   * placeholder ends up ~7pt lower than the caret and hangs out of the bottom
   * of the field, which reads as a vertically mis-aligned search bar. Setting
   * an explicit lineHeight pins the placeholder to the same box as typed text.
   *
   * Pair it with an explicit `height` so the input still fills — and is
   * tappable across — the whole search pill.
   */
  inputLineHeight: (fontSize: number) => Math.round(fontSize * 1.25),
} as const;

export const radii = {
  sm:   6,
  md:   8,
  lg:   12,
  xl:   18,
  full: 9999,
} as const;

export const editorial = {
  garmentAspectRatio: 3 / 4,
  outfitAspectRatio: 4 / 5,
  lifestyleAspectRatio: 16 / 11,
  imageFit: {
    garment: 'contain' as const,
    editorial: 'cover' as const,
  },
} as const;

// ── Cutout presentation ──────────────────────────────────────────────────────
//
// Cutouts are trimmed to the garment's own bounds server-side, so without any
// inset every item would run edge-to-edge in its card — a crowded look, and one
// where a sock reads as visually equal to a coat. The inset gives each garment
// air; the per-category scale restores the size relationship a catalog would
// show, so small goods sit smaller in the frame than outerwear.
//
// Values are the fraction of the frame the garment is allowed to occupy.
export const cutout = {
  defaultScale: 0.80,
  scaleByCategory: {
    outerwear: 0.88,
    full_body: 0.88,
    top:       0.82,
    bottom:    0.82,
    shoes:     0.72,
    accessory: 0.62,
    valuables: 0.58,
  } as Record<string, number>,
} as const;

/** Fraction of a card a cutout garment should occupy, by item category. */
export function cutoutScaleFor(category: string | null | undefined): number {
  if (!category) return cutout.defaultScale;
  return cutout.scaleByCategory[category] ?? cutout.defaultScale;
}

// Cross-platform shadow tokens.
//
// iOS:     full warm shadow API (shadowColor + offset + opacity + radius)
// Android: shadowColor/offset/opacity/radius are silently ignored by the
//          native renderer. We use a modest elevation (for natural depth and
//          correct z-order) combined with a warm hairline border so cards
//          feel distinct without the harsh black Material shadows.
//
// "lg" is intentionally border-free on Android — it's reserved for floating
// elements (FABs, modals) where borders would look incorrect and elevation
// alone is needed for proper layer stacking.
export const shadows = {
  xs: Platform.select({
    ios: {
      shadowColor:   '#28231F',
      shadowOffset:  { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius:  2,
    },
    android: {
      elevation:   1,
      borderWidth: 1,
      borderColor: '#DDD6CD',
    },
    default: {},
  }),
  sm: Platform.select({
    ios: {
      shadowColor:   '#28231F',
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius:  6,
    },
    android: {
      elevation:   2,
      borderWidth: 1,
      borderColor: '#DDD6CD',
    },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor:   '#28231F',
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.09,
      shadowRadius:  12,
    },
    android: {
      elevation:   3,
      borderWidth: 1,
      borderColor: '#DDD6CD',
    },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor:   '#28231F',
      shadowOffset:  { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius:  20,
    },
    android: {
      elevation: 5,
    },
    default: {},
  }),
  warm: Platform.select({
    ios: {
      shadowColor:   '#956D51',
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius:  8,
    },
    android: {
      elevation:   3,
      borderWidth: 1,
      borderColor: '#956D5133', // primary @ ~20% opacity
    },
    default: {},
  }),
};
