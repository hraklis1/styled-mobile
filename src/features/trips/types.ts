/**
 * Trip planner v2 — mirrors ../Styled/shared/trips.ts (docs/trip-planner.md).
 * Every v2 field is optional on the chat payload so v1 plans keep rendering.
 */

export const TRIP_TYPES = ['city', 'beach', 'business', 'wedding', 'outdoors', 'ski'] as const;
export type TripType = typeof TRIP_TYPES[number];

export type TripWeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy';
export type TripDayWeather = { highC: number; lowC: number; condition: TripWeatherCondition; source: 'forecast' | 'typical' };

export type TripPlanDay = {
  date: string;
  title: string;
  note: string;
  lookIndexes: number[];
  weather?: TripDayWeather | null;
};

export type TripLuggageFit = 'comfortable' | 'tight' | 'over';

export type TripPlanStats = {
  looks: number;
  days: number;
  pieces: number;
  packedPieces: number;
  shoes: number;
  wearsPerPiece: number;
  luggageFit: TripLuggageFit | null;
};

export type TripGap = { label: string; category: string; reason: string; context: string; priority: number; unlocks?: string[] };

export type TripPlanV2Fields = {
  version?: 2;
  tripId?: number;
  destination?: string;
  place?: string | null;
  startDate?: string;
  endDate?: string;
  luggage?: 'carry_on' | 'checked' | 'not_sure';
  days?: TripPlanDay[];
  capsule?: Array<{ itemId: number; uses: number }>;
  packingItemIds?: number[];
  travelLookIndex?: number | null;
  gaps?: TripGap[];
  stats?: TripPlanStats;
};

export type TripBrief = {
  destination: string;
  startDate: string;
  endDate: string;
  luggage?: 'carry_on' | 'checked' | 'not_sure';
  plans?: string;
  notes?: string;
  tripTypes?: TripType[];
  dressyEvenings?: number;
  laundry?: boolean;
};

export type TripOutfitData = {
  label: string;
  note: string;
  itemIds: number[];
  status?: 'ready' | 'incomplete';
  foundationItemIds?: number[];
  missingEssentials?: TripGap[];
};

export type TripPlanV2 = TripPlanV2Fields & {
  intro: string;
  outfits: TripOutfitData[];
  packingList: string[];
  kind?: 'trip';
};

export type Trip = {
  id: number;
  conversationId: number | null;
  destination: string;
  startDate: string;
  endDate: string;
  brief: TripBrief;
  plan: TripPlanV2;
  packedItemIds: number[];
  packedExtras: string[];
  eventId?: number | null;
  eventDatesChanged?: boolean;
};

export type TripSummary = {
  id: number;
  destination: string;
  place: string | null;
  startDate: string;
  endDate: string;
  conversationId: number | null;
  looks: number;
  pieces: number;
  packed: number;
  packable: number;
  coverItemIds: number[];
  /** The calendar event this trip follows, if linked. */
  eventId?: number | null;
  /** A calendar sync moved the event's dates since the plan was made. */
  eventDatesChanged?: boolean;
};

export function isTripPlanV2(plan: { version?: number; days?: unknown } | null | undefined): plan is TripPlanV2 {
  return plan?.version === 2 && Array.isArray(plan.days);
}
