jest.mock('../useProfile', () => ({
  useProfile: jest.fn(),
  useUpdateProfile: jest.fn(),
}));

jest.mock('../../lib/analytics', () => ({
  track: jest.fn(),
}));

import { createEmptyStyleProfileDetails } from '../../lib/profileOptions';
import type { Profile } from '../../types/profile';
import {
  buildMeasurementHeight,
  buildProfileUpdatePayload,
  getFitPreferenceResetAction,
  getSizingRegionResetAction,
  parseLoadedProfileForm,
  type ProfileFormSnapshot,
} from '../useProfileForm';

const baseSnapshot: ProfileFormSnapshot = {
  photoPreview: null,
  displayName: 'Alex',
  stylePreference: [],
  colorPalette: [],
  budgetRange: '',
  bodyType: '',
  fitPreference: '',
  fitSilhouette: '',
  styleProfileDetails: createEmptyStyleProfileDetails(),
  sizingRegion: 'US',
  location: '',
  retailers: [],
  stylistVoice: 'shimmer',
  tempUnit: 'auto',
  occasions: [],
  fitNotes: '',
  sizeTop: '',
  sizeBottomWaist: '',
  sizeBottomInseam: '',
  sizeDress: '',
  sizeShoe: '',
  sizeJacket: '',
  sizeJacketLength: '',
  measurementChest: '',
  measurementWaistM: '',
  measurementHips: '',
  measurementHeight: '',
  measurementHeightFt: '',
  measurementHeightIn: '',
};

const baseProfile: Profile = {
  id: 1,
  userId: 1,
  onboardingComplete: true,
  displayName: 'Alex',
  photoUrl: null,
  stylePreference: null,
  colorPalette: null,
  budgetRange: null,
  bodyType: null,
  fitPreference: null,
  fitSilhouette: null,
  styleProfileDetails: null,
  sizingRegion: 'US',
  location: null,
  favoriteRetailers: null,
  stylistVoice: null,
  tempUnit: null,
  occasions: null,
  fitNotes: null,
  sizeTop: null,
  sizeBottom: null,
  sizeDress: null,
  sizeShoe: null,
  suitJacket: null,
  measurementChest: null,
  measurementWaist: null,
  measurementHips: null,
  measurementInseam: null,
  measurementHeight: null,
};

describe('useProfileForm helpers', () => {
  it('preserves inseam in measurementInseam even when waist is blank', () => {
    const payload = buildProfileUpdatePayload({
      ...baseSnapshot,
      sizeBottomInseam: '30',
    });

    expect(payload.sizeBottom).toBeNull();
    expect(payload.measurementInseam).toBe('30 in');
  });

  it('stores feet-only imperial height with a unit', () => {
    expect(buildMeasurementHeight({
      sizingRegion: 'US',
      measurementHeight: '',
      measurementHeightFt: '5',
      measurementHeightIn: '',
    })).toBe('5 ft');
  });

  it('does not request a reset when tapping the current sizing region', () => {
    expect(getSizingRegionResetAction('US', 'US', {
      ...baseSnapshot,
      sizeShoe: 'US 8',
    })).toBe('noop');
  });

  it('asks before clearing dependent cut sizing when preferred cut changes', () => {
    expect(getFitPreferenceResetAction('feminine_cut', 'neutral_fluid', {
      sizeDress: 'US 6',
      sizeShoe: '',
    })).toBe('confirm-reset');
  });

  it('migrates legacy fitPreference silhouette values on load', () => {
    const loaded = parseLoadedProfileForm({
      ...baseProfile,
      fitPreference: 'fitted',
      stylePreference: ['trendy'],
      budgetRange: 'luxury',
    });

    expect(loaded.fitPreference).toBe('');
    expect(loaded.fitSilhouette).toBe('fitted');
    expect(loaded.stylePreference).toEqual(['trend_forward']);
    expect(loaded.budgetRange).toBe('luxury_high_end');
  });

  it('normalizes conflicted style details when building the save payload', () => {
    const payload = buildProfileUpdatePayload({
      ...baseSnapshot,
      styleProfileDetails: {
        ...createEmptyStyleProfileDetails(),
        materialLikes: ['cotton', 'linen'],
        materialAvoids: ['linen'],
        patternLikes: ['solid', 'stripe'],
        patternAvoids: ['stripe'],
      },
    });

    expect(payload.styleProfileDetails).toMatchObject({
      materialLikes: ['cotton'],
      materialAvoids: ['linen'],
      patternLikes: ['solid'],
      patternAvoids: ['stripe'],
    });
  });
});
