export type CategoryBudgetKey = 'tops' | 'bottoms' | 'dresses' | 'outerwear' | 'shoes' | 'bags' | 'accessories';

export type StyleProfileDetails = {
  version: 1;
  styleAvoids: string[];
  favoriteColors: string[];
  avoidedColors: string[];
  colorAnalysis: {
    undertone: string | null;
    contrast: string | null;
    metalPreference: string[];
  };
  materialLikes: string[];
  materialAvoids: string[];
  patternLikes: string[];
  patternAvoids: string[];
  brandAvoids: string[];
  shoppingPriorities: string[];
  careConstraints: string[];
  categoryBudgets: Partial<Record<CategoryBudgetKey, string | null>>;
  sizeExtras: {
    neck?: string | null;
    sleeve?: string | null;
    shoeWidth?: string | null;
    heelComfort?: string | null;
    braSize?: string | null;
    hat?: string | null;
    belt?: string | null;
    ring?: string | null;
    eyewear?: string | null;
    watch?: string | null;
  };
  sensitiveFit: {
    proportions: string[];
    coverage: string[];
    comfort: string[];
    notes: string | null;
  };
};

export type Profile = {
  id: number;
  userId: number;
  onboardingComplete: boolean;
  displayName: string | null;
  photoUrl: string | null;
  stylePreference: string[] | null;
  colorPalette: string[] | null;
  budgetRange: string | null;
  bodyType: string | null;
  fitPreference: string | null;
  fitSilhouette: string | null;
  styleProfileDetails: StyleProfileDetails | null;
  sizingRegion: string | null;
  location: string | null;
  favoriteRetailers: string[] | null;
  stylistVoice: string | null;
  tempUnit: string | null;
  occasions: string[] | null;
  fitNotes: string | null;
  sizeTop: string | null;
  sizeBottom: string | null;
  sizeDress: string | null;
  sizeShoe: string | null;
  suitJacket: string | null;
  measurementChest: string | null;
  measurementWaist: string | null;
  measurementHips: string | null;
  measurementInseam: string | null;
  measurementHeight: string | null;
};
