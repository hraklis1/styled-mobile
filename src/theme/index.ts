// Translated from the web app's HSL CSS variables (index.css)
export const colors = {
  background:          '#FAF8F5', // HSL 30 20% 98% — warm off-white
  foreground:          '#28231F', // HSL 25 15% 15% — deep charcoal brown
  card:                '#F4EFE9', // HSL 30 25% 96% — warm creamy beige
  primary:             '#956D51', // HSL 25 30% 45% — clay/earth brown
  primaryForeground:   '#FAF8F5',
  secondary:           '#EDE7DC', // HSL 35 25% 90% — soft taupe/sand
  secondaryForeground: '#5C4A3A',
  muted:               '#EAE5DF', // HSL 35 15% 92%
  mutedForeground:     '#7D7168', // HSL 25 10% 45%
  accent:              '#F0E6DE', // HSL 20 30% 92% — soft terracotta/blush
  border:              '#DDD6CD', // HSL 30 15% 85%
  error:               '#BF4040', // HSL 0  50% 50%
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
  md:   10,
  lg:   16,
  xl:   24,
  full: 9999,
} as const;

// iOS uses shadowColor/shadowOffset/shadowOpacity/shadowRadius.
// Android uses elevation only — colored shadows are not supported on Android;
// elevation always casts a black shadow regardless of shadowColor.
export const shadows = {
  xs: {
    shadowColor:   '#28231F',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius:  2,
    elevation: 1,
  },
  sm: {
    shadowColor:   '#28231F',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius:  6,
    elevation: 2,
  },
  md: {
    shadowColor:   '#28231F',
    shadowOffset:  { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius:  10,
    elevation: 3,
  },
  warm: {
    shadowColor:   '#956D51',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius:  8,
    elevation: 3,
  },
} as const;
