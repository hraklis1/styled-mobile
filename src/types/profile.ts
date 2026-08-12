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
