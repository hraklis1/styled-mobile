import { Platform, type TextStyle } from 'react-native';

// Translated from the web app's HSL CSS variables (index.css)
export const colors = {
  background:          '#FBFAF7', // Warm ivory
  foreground:          '#1D1B18', // Soft fashion black
  card:                '#F3F0EA',
  surfaceElevated:     '#FDFCF9',
  surfaceSubtle:       '#F5F3EE',
  surfaceSelected:     '#E8E5DE',
  primary:             '#292723', // Primary action ink
  primaryForeground:   '#FFFCF7',
  secondary:           '#EDEAE3',
  secondaryForeground: '#403A33',
  muted:               '#EEECE6',
  mutedForeground:     '#6F6A62',
  accent:              '#E8DED1',
  // Quiet action text; pair with an underline or directional icon.
  action:              '#514B43',
  border:              '#DDD9D1',
  hairline:            '#E7E3DC',
  inkSubtle:           '#4E4841',
  error:               '#B94242',
  destructive:         '#BF4040', // Alias for error
  success:             '#4A7D59',
  white:               '#FFFFFF',
} as const;

/** Original image/placeholder colors stay independent of control styling. */
export const imageColors = {
  primary: '#6F5948',
  surfaceSelected: '#ECE6DA',
  surfaceElevated: '#FFFFFF',
  mutedForeground: '#746E66',
  border: '#E1DCD3',
  hairline: '#EEEAE3',
} as const;

/**
 * Camera surfaces keep the full-bleed capture experience dark while carrying
 * the same warm, quiet contrast as the rest of the app. Keep these values in
 * the theme so the camera screen and its rails don't grow a second palette.
 */
export const cameraColors = {
  backdrop: '#1D1B18',
  backdropDeep: '#12100F',
  overlay: 'rgba(29, 27, 24, 0.34)',
  overlayStrong: 'rgba(29, 27, 24, 0.86)',
  control: 'rgba(29, 27, 24, 0.76)',
  controlSubtle: 'rgba(255, 252, 247, 0.08)',
  onCamera: colors.primaryForeground,
  onCameraMuted: 'rgba(255, 252, 247, 0.68)',
  selection: colors.primaryForeground,
  selectionSubtle: 'rgba(255, 252, 247, 0.12)',
  destructive: colors.destructive,
  ctaBackground: colors.primaryForeground,
  ctaForeground: colors.foreground,
} as const;

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  xxxl: 48,
  page: 24,
  grid: 12,
  gridRow: 24,
  section: 32,
} as const;

const weight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
};

const editorialFamily = {
  editorialRegular: 'Newsreader_400Regular',
  editorialMedium: 'Newsreader_500Medium',
} as const;

const tracking = {
  none: 0,
  whisper: 0.1,
  tight: 0.2,
  subtle: 0.3,
  compact: 0.4,
  meta: 0.5,
  label: 0.6,
  relaxed: 0.7,
  wide: 0.8,
  spacious: 0.9,
  unit: 1,
  eyebrow: 1.1,
  eyebrowLarge: 1.6,
} as const;

export const typography = {
  family: editorialFamily,
  weight,
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
  /** Named tracking values for exceptional labels and display treatments. */
  tracking,
  /**
   * Semantic text roles. Screens should choose a role rather than combining
   * a raw size, weight, tracking value, and family independently. Editorial
   * roles intentionally use a real static face for each weight; React Native
   * must not synthesize a weight for a bundled custom font.
   */
  text: {
    editorialHero: {
      fontFamily: editorialFamily.editorialRegular,
      fontSize: 34,
      lineHeight: 40,
      letterSpacing: -0.3,
    },
    editorialTitle: {
      fontFamily: editorialFamily.editorialRegular,
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.15,
    },
    editorialSection: {
      fontFamily: editorialFamily.editorialRegular,
      fontSize: 22,
      lineHeight: 28,
    },
    editorialCompact: {
      fontFamily: editorialFamily.editorialMedium,
      fontSize: 22,
      lineHeight: 28,
    },
    /**
     * Editorial prose — a whole sentence in the app's own voice, as opposed to
     * a headline. Deliberately the *regular* face: the medium weights above
     * read as display type and start to outweigh the headline they sit under
     * once the copy runs past a line or two.
     */
    editorialBody: {
      fontFamily: editorialFamily.editorialRegular,
      fontSize: 19,
      lineHeight: 28,
    },
    /**
     * A single number set as editorial type — the "80" that leads a deck.
     * Regular face and tabular figures so it sits with the hero above it
     * rather than competing as a second, sans, display size.
     */
    editorialFigure: {
      fontFamily: editorialFamily.editorialRegular,
      fontSize: 44,
      lineHeight: 48,
      fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    },
    /** Sequence numerals in a rail ("01", "02") beside editorial titles. */
    editorialNumeral: {
      fontFamily: editorialFamily.editorialRegular,
      fontSize: 17,
      lineHeight: 20,
      fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    },
    pageTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: weight.bold,
    },
    sheetTitle: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: weight.semibold,
    },
    sectionTitle: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: weight.semibold,
    },
    cardTitle: {
      fontSize: 14, lineHeight: 20, fontWeight: weight.medium,
    },
    body: {
      fontSize: 15,
      lineHeight: 23,
      fontWeight: weight.regular,
    },
    bodySmall: {
      fontSize: 13,
      lineHeight: 19,
      fontWeight: weight.regular,
    },
    label: {
      fontSize: 14, lineHeight: 20, fontWeight: weight.medium, letterSpacing: 0.2,
    },
    caption: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: weight.regular,
    },
    eyebrow: {
      fontSize: 11, lineHeight: 16, fontWeight: weight.medium, letterSpacing: 1.2, textTransform: 'uppercase' as const,
    },
    eyebrowLarge: {
      fontSize: 12, lineHeight: 17, fontWeight: weight.medium, letterSpacing: 1.2, textTransform: 'uppercase' as const,
    },
    /** Sentence-case supporting metadata; uppercase is reserved for eyebrows. */
    meta: {
      fontSize: 12, lineHeight: 17, fontWeight: weight.regular, letterSpacing: 0.2,
    },
    /** Maker and category captions beneath garment names. */
    metaSheet: {
      fontSize: 12, lineHeight: 17, fontWeight: weight.regular, letterSpacing: 0.2,
    },
    productName: { fontSize: 13, lineHeight: 18, fontWeight: weight.medium, letterSpacing: 0 },
    stylistLead: { fontFamily: editorialFamily.editorialRegular, fontSize: 20, lineHeight: 28 },
    editorialSheet: { fontFamily: editorialFamily.editorialRegular, fontSize: 24, lineHeight: 30 },
    data: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: weight.medium,
      fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    },
    dataLarge: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: weight.medium,
      fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    },
  } satisfies Record<string, TextStyle>,
} as const;

export const radii = {
  /**
   * Photographs are flat plates. Rounding is a property of controls — chips,
   * buttons, pills — so a garment image and the chip beside it never share a
   * corner treatment. Just enough to take the hard pixel off the corner.
   */
  photo: 2,
  action: 4,
  bubble: 8,
  sheet: 24,
  sm:   6,
  md:   8,
  lg:   12,
  xl:   18,
  full: 9999,
  /** Cards, sheets, look cards. */
  card: 18,
  /** Bubbles and inline panels inside a card. */
  panel: 12,
} as const;

/**
 * Named surfaces for the two places a colour is a *rule*, not a choice: the
 * plate every garment or outfit image sits on, and the user's own message in
 * the stylist thread. Both point at palette tokens so the palette stays the
 * single source of truth.
 */
export const surfaces = {
  plate:      colors.surfaceSubtle,
  userBubble: colors.surfaceSelected,
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

/** Selective depth for the Shopping Brief and Edit; other flows retain their palette. */
export const shoppingSurfaces = {
  canvas: '#F8F7F3',
  alabaster: '#FFFEFA',
  bone: '#F0EDE5',
  espresso: '#302B25',
  secondaryInk: '#625D54',
  olive: { accent: '#586047', wash: '#EEF0E7' },
  stone: { accent: '#716E65', wash: '#F0EEE8' },
  charcoal: { accent: '#454A47', wash: '#ECEEEB' },
  edge: 'rgba(48,43,37,0.08)',
  highlight: 'rgba(255,255,255,0.72)',
  panelGradient: ['#FFFEFA', '#F7F5EF', '#F0EDE5'],
  panelStops: [0, 0.58, 1],
  tileGradient: ['#F8F7F2', '#F0EDE5', '#ECE9E1'],
  tileStops: [0, 0.65, 1],
  panelShadow: '0 2px 4px rgba(48,43,37,0.025), 0 10px 28px rgba(48,43,37,0.045)',
  buttonShadow: '0 2px 5px rgba(48,43,37,0.10)',
} as const;
