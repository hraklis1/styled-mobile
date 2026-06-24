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
  weight: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
  },
  lineHeight: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.75,
  },
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
