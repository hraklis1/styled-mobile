import type { ImageSourcePropType } from 'react-native';

/**
 * Onboarding photography, keyed by choice value.
 *
 * Every bundled file must have a row in assets/onboarding/ATTRIBUTION.md
 * before it lands here. A missing entry is fine: the card falls back to a
 * typographic treatment (label set large over the choice's palette), so a
 * category with no good photograph ships without one rather than with a
 * weak one.
 */
export const WELCOME_IMAGE: ImageSourcePropType = require('../../../assets/onboarding/welcome-wardrobe.jpg');

export const CUT_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  masculine_cut: require('../../../assets/onboarding/cut-mens.jpg'),
  feminine_cut: require('../../../assets/onboarding/cut-womens.jpg'),
  neutral_fluid: require('../../../assets/onboarding/cut-fluid.jpg'),
};

export const AESTHETIC_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  minimalist: require('../../../assets/onboarding/aesthetic-minimalist.jpg'),
  classic: require('../../../assets/onboarding/aesthetic-classic.jpg'),
  casual: require('../../../assets/onboarding/aesthetic-relaxed.jpg'),
  smart_casual: require('../../../assets/onboarding/aesthetic-tailored.jpg'),
  streetwear: require('../../../assets/onboarding/aesthetic-street.jpg'),
  bohemian: require('../../../assets/onboarding/aesthetic-romantic.jpg'),
  edgy: require('../../../assets/onboarding/aesthetic-edgy.jpg'),
  vintage: require('../../../assets/onboarding/aesthetic-vintage.jpg'),
};

/**
 * Fallback tones for the typographic cards — two stops per aesthetic, drawn
 * from the palette each one implies, kept low-contrast so ink type sits on
 * them legibly.
 */
export const AESTHETIC_TONES: Record<string, [string, string]> = {
  minimalist: ['#F4F2EE', '#E4E0D8'],
  classic: ['#ECE6DC', '#D6CCBC'],
  casual: ['#EFE9E0', '#DCD2C2'],
  smart_casual: ['#E6E2DC', '#C9C3BA'],
  streetwear: ['#E3E3E1', '#C4C4C0'],
  bohemian: ['#F1E4D8', '#DDC3AA'],
  edgy: ['#DCDAD7', '#B4B1AD'],
  vintage: ['#EEE2CF', '#D7BF9B'],
};

export const CUT_TONES: Record<string, [string, string]> = {
  masculine_cut: ['#E6E2DC', '#CFC8BE'],
  feminine_cut: ['#F1E8E1', '#DDCBBE'],
  neutral_fluid: ['#ECEAE5', '#D6D2CA'],
};
