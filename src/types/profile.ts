export type CategoryBudgetKey = 'tops' | 'bottoms' | 'dresses' | 'outerwear' | 'shoes' | 'bags' | 'accessories';

export type StyleProfileDetails = {
  version: 1;
  customOccasionCategories?: Record<string, string>;
  styleAvoids: string[];
  favoriteColors: string[];
  avoidedColors: string[];
  /** Where `colorPalette` came from; 'derived' = onboarding guessed it from aesthetics. */
  paletteSource?: 'user' | 'derived';
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

export type ProfilePromptKey = 'budget' | 'sizes' | 'retailers' | 'fit' | 'avoids';
export type ProfilePromptState = {
  shownAt: string | null;
  dismissedAt: string | null;
  dismissCount: number;
  answeredAt: string | null;
};
export type ProfilePrompts = Partial<Record<ProfilePromptKey, ProfilePromptState>>;

export type PlanTier = 'free' | 'premium' | 'beta';

export type CreditBalances = {
  /** Monthly subscription grant. Resets on creditsRefillAt; does NOT roll over. */
  included: number;
  /** One-time onboarding grant. Never expires. */
  onboarding: number;
  /** Purchased top-up packs. Never expire. */
  purchased: number;
  total: number;
};

export type FreeUsage = {
  stylistMessagesUsed: number;
  stylistMessagesLimit: number;
  itemsLimit: number;
  eventsLimit: number;
};

export type Profile = {
  id: number;
  userId: number;
  onboardingComplete: boolean;
  /** Which questionnaire the user went through (backend migration 0066). Absent = 1. */
  onboardingVersion?: number | null;
  onboardingCompletedAt?: string | null;
  /** Deferred profile-question ledger. */
  profilePrompts?: ProfilePrompts | null;
  // ── Entitlements (server-authoritative) ──────────────────────────────────
  // Absent on a response captured before the credits system existed, or if the
  // server omitted them — always optional-check before reading.
  planTier?: PlanTier | null;
  credits?: CreditBalances | null;
  monthlyGrant?: number | null;
  /**
   * When the `included` bucket resets. NOT the subscription renewal date —
   * an annual subscriber refills credits every 30 days but renews once a
   * year, so these are genuinely different clocks. Render this as "Credits
   * reset", never as "Renews".
   */
  creditsRefillAt?: string | null;
  /** Per-action credit prices, keyed by meter name, so the client never hardcodes them. */
  meterCosts?: Record<string, number> | null;
  freeUsage?: FreeUsage | null;
  displayName: string | null;
  photoUrl: string | null;
  stylePreference: string[] | null;
  colorPalette: string[] | null;
  budgetRange: string[] | null;
  bodyType: string[] | null;
  fitPreference: string | null;
  fitSilhouette: string | null;
  styleProfileDetails: StyleProfileDetails | null;
  sizingRegion: string | null;
  location: string | null;
  favoriteRetailers: string[] | null;
  stylistVoice: string | null;
  tempUnit: string | null;
  appPreferences?: AppPreferences | null;
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

/** Mirrors appPreferencesSchema in ../Styled/shared/schema.ts. */
export type StylistTone = 'concise' | 'balanced' | 'detailed';
export type StylistAdventurousness = 'classic' | 'balanced' | 'experimental';
export type AppPreferences = {
  haptics: boolean;
  reduceMotion: boolean;
  currency: string | null;
  stylistTone: StylistTone;
  adventurousness: StylistAdventurousness;
  shoppingLinksInAnswers: boolean;
  analyticsOptOut: boolean;
  /** Last choice of the add-to-closet "Polish photos" switch. */
  polishOnImport: boolean;
  notifications: {
    dailyLook: { enabled: boolean; time: string };
    wearLog: boolean;
    events: boolean;
    /** Morning of a lent item's back-by date. */
    loans: boolean;
  };
};
