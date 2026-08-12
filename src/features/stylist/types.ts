import type { ShopOutfit } from '../../types/shop';

export type StylistRole = 'user' | 'assistant';

export type StylistMode = 'from_closet' | 'event_plan' | 'shop_new' | 'shop_piece' | 'shop_list' | 'advice' | 'trip' | 'wardrobe_audit';

export type StylistRenderType =
  | 'text'
  | 'closet_outfit'
  | 'shopping_outfit'
  | 'advice'
  | 'trip_plan'
  | 'wardrobe_audit';

export type StylistOccasionHint =
  | 'formal'
  | 'business'
  | 'smart_casual'
  | 'casual'
  | 'athletic';

export type StylistMissingEssential = {
  label: string;
  category: string;
  reason: string;
  context: string;
  priority: number;
  unlocks?: string[];
};

export type StylistComposerAttachment = {
  type: 'photo' | 'item';
  label: string;
  uri?: string | null;
  itemId?: number;
};

export type StylistTripOutfit = {
  label: string;
  note: string;
  itemIds: number[];
};

export type StylistTripPlanData = {
  intro: string;
  outfits: StylistTripOutfit[];
  packingList: string[];
  kind?: 'trip' | 'board_capsule';
  pending?: boolean;
};

export type StylistWardrobeAuditData = {
  summary: string;
  strengths: string[];
  wearDataStatus: 'sufficient' | 'limited' | 'none';
  workhorses: Array<{
    itemId: number;
    wearCount: number;
    lastWornAt?: string | null;
  }>;
  underused: Array<{
    itemId: number;
    action: 'remix' | 'repair' | 'let_go';
    reason: string;
  }>;
  investments: StylistMissingEssential[];
};

export type StylistWorkflow =
  | {
      kind: 'occasion';
      plan: string;
      dressCode?: string;
      feeling?: string;
      notes?: string;
    }
  | {
      kind: 'style_piece';
      itemId: number;
      occasion?: string;
      direction?: string;
      notes?: string;
    }
  | {
      kind: 'trip';
      destination: string;
      startDate: string;
      endDate: string;
      plans?: string;
      luggage?: 'carry_on' | 'checked' | 'not_sure';
      notes?: string;
    }
  | { kind: 'wardrobe_audit' }
  | {
      kind: 'wardrobe_build';
      lifestyle: string[];
      styleDirection?: string[];
      budget?: string[];
      notes?: string;
    };

export type StylistEventPlanData = {
  candidateId: string;
  outfitName: string;
  stylistNotes: string | null;
  itemIds: number[];
  missingEssentials: StylistMissingEssential[];
  recommendationId: number | null;
};

export type StylistBaseMessage = {
  id: string;
  role: StylistRole;
  kind: StylistRole;
  renderType: StylistRenderType;
  text: string;
  isStreaming?: boolean;
  transcript?: string;
  createdAt?: number;
};

export type StylistUserMessage = StylistBaseMessage & {
  role: 'user';
  kind: 'user';
  renderType: 'text';
  attachment?: StylistComposerAttachment;
};

export type StylistAssistantMessage = StylistBaseMessage & {
  role: 'assistant';
  kind: 'assistant';
  mode?: StylistMode;
  shopOutfit?: ShopOutfit;
  suggestedItemIds?: number[];
  lookName?: string;
  missingEssentials?: StylistMissingEssential[];
  tripPlan?: StylistTripPlanData;
  wardrobeAudit?: StylistWardrobeAuditData;
  eventPlan?: StylistEventPlanData;
  recId?: number;
  boardAction?: 'outfit' | 'complete' | 'capsule' | 'theme';
};

export type StylistMessage = StylistUserMessage | StylistAssistantMessage;

export type StylistHistoryMessage = {
  role: StylistRole;
  content: string;
};

export type StylistEntryContext =
  | {
      kind: 'event';
      eventId: number;
      title: string;
      date?: string;
      location?: string | null;
      occasion?: string | null;
      environment?: string | null;
      weatherSummary?: string | null;
      itemIds?: number[];
    }
  | {
      kind: 'item';
      itemId: number;
      itemName?: string;
      category?: string | null;
      brand?: string | null;
      color?: string | null;
    }
  | {
      kind: 'outfit';
      outfitId: number;
      name?: string;
      itemIds?: number[];
    }
  | {
      kind: 'closet_selection';
      itemIds: number[];
      label?: string;
      instruction?: string;
    }
  | {
      kind: 'board';
      boardId: number;
      name?: string;
      itemIds?: number[];
      /** A server-resolved board action; item membership is never trusted from the client. */
      action?: 'outfit' | 'complete' | 'capsule' | 'theme';
    }
  | {
      kind: 'shopping_find';
      captureGroupId: string;
      storeName?: string | null;
      price?: number | null;
      category?: string | null;
      color?: string | null;
      material?: string | null;
      notes?: string | null;
    };

export type StylistLocationContext = {
  source: 'current' | 'home' | 'conversation';
  label?: string;
  coords?: {
    lat: number;
    lon: number;
  };
};

export type StylistSwapContext = {
  itemName: string;
  category: string;
  brand?: string;
  priceRange?: string;
};

export type StylistAskRequest = {
  text?: string;
  history?: StylistHistoryMessage[];
  mode?: StylistMode;
  continuationMode?: StylistMode;
  continuationItemIds?: number[];
  workflow?: StylistWorkflow;
  userTimeZone?: string;
  userUtcOffsetMinutes?: number;
  /** Resolved display unit so server-generated Shop copy matches the app. */
  tempUnit?: 'C' | 'F';
  locationContext?: StylistLocationContext;
  currentLocation?: string;
  liveLocation?: {
    lat: number;
    lon: number;
  };
  weatherSummary?: string;
  swapContext?: StylistSwapContext;
  photoData?: string;
  occasionHint?: StylistOccasionHint;
  recId?: number;
  conversationId?: number;
  source?: string;
  context?: StylistEntryContext;
  _stream?: true;
};

export type StylistAskDoneEvent = {
  transcript: string;
  responseText: string;
  itemIds?: number[];
  lookName?: string | null;
  missingEssentials?: StylistMissingEssential[];
  missingEssential?: {
    label: string;
    category: string;
    reason: string;
  } | null;
  shopOutfit?: ShopOutfit | null;
  tripPlan?: StylistTripPlanData | null;
  wardrobeAudit?: StylistWardrobeAuditData | null;
  eventPlan?: StylistEventPlanData | null;
  mode?: StylistMode;
  recId?: number | null;
  conversationId?: number | null;
  boardAction?: 'outfit' | 'complete' | 'capsule' | 'theme';
};

export type StylistSendOptions = {
  text?: string;
  displayText?: string;
  photoData?: string;
  attachment?: StylistComposerAttachment;
  context?: StylistEntryContext;
  mode?: StylistMode;
  workflow?: StylistWorkflow;
};

export type StylistFeedbackRating = 'up' | 'down';

export type StylistPositiveSignal =
  | 'up'
  | 'saved'
  | 'accepted_for_event'
  | 'worn_later';

export type StylistNegativeReason =
  | 'too_formal'
  | 'too_casual'
  | 'wrong_colors'
  | 'wrong_weather'
  | 'not_my_style'
  | 'item_mismatch'
  | 'not_my_fit'
  | 'just_not_it';

export const STYLIST_NEGATIVE_REASON_CHIPS: Array<{
  label: string;
  value: StylistNegativeReason;
}> = [
  { label: 'Too formal', value: 'too_formal' },
  { label: 'Too casual', value: 'too_casual' },
  { label: 'Wrong colors', value: 'wrong_colors' },
  { label: 'Wrong weather', value: 'wrong_weather' },
  { label: 'Not my style', value: 'not_my_style' },
  { label: 'Item mismatch', value: 'item_mismatch' },
  { label: 'Not my fit', value: 'not_my_fit' },
];

export type StylistFeedbackMetadata = {
  itemIds: number[];
  rating?: StylistFeedbackRating;
  signal?: StylistPositiveSignal;
  reason?: StylistNegativeReason;
  reasonLabel?: string;
  recId?: number;
  source?: string;
  eventId?: number;
  messageId?: string;
};

export type StylistTransportSendInput = {
  request: StylistAskRequest;
  assistantMessageId: string;
  userMessageId?: string;
  originalOptions?: StylistSendOptions;
};

export type StylistTransportError = {
  message: string;
  request: StylistTransportSendInput;
  error: unknown;
};

export type StylistTransportCallbacks = {
  onAssistantStart?: (assistantMessageId: string) => void;
  onAssistantToken?: (assistantMessageId: string, token: string) => void;
  onAssistantDone?: (assistantMessageId: string, event: StylistAskDoneEvent) => void;
  onTripOutfit?: (assistantMessageId: string, outfit: StylistTripOutfit) => void;
  onConversationResolved?: (conversationId: number) => void;
  onError?: (error: StylistTransportError) => void;
};
