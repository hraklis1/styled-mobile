import type { ShopOutfit } from '../../types/shop';

export type StylistRole = 'user' | 'assistant';

export type StylistMode = 'from_closet' | 'shop_new' | 'advice' | 'trip';

export type StylistRenderType =
  | 'text'
  | 'closet_outfit'
  | 'shopping_outfit'
  | 'advice'
  | 'trip_plan';

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
  pending?: boolean;
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
  recId?: number;
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
  audio?: string;
  text?: string;
  history?: StylistHistoryMessage[];
  mode?: StylistMode;
  autoVoice?: boolean;
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
  mode?: StylistMode;
  recId?: number | null;
  conversationId?: number | null;
};

export type StylistTtsReadyEvent = {
  audioReply: string;
};

export type StylistSendOptions = {
  text?: string;
  displayText?: string;
  audio?: string;
  photoData?: string;
  attachment?: StylistComposerAttachment;
  context?: StylistEntryContext;
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
  shouldFetchTtsFallback?: boolean;
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
  onTtsReady?: (assistantMessageId: string, event: StylistTtsReadyEvent) => void;
  onTtsFallbackNeeded?: (assistantMessageId: string, text: string) => void;
  onConversationResolved?: (conversationId: number) => void;
  onError?: (error: StylistTransportError) => void;
};
