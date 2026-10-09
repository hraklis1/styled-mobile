import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { ItemCategory, ScanResult } from '../types/item';
import type { ShoppingBriefPriority } from '../lib/shopDecisionWorkspace';

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  App: NavigatorScreenParams<AppTabParamList> | undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string; token_hash?: string; type?: string };
};

export type AppTabParamList = {
  Home: undefined;
  Closet: NavigatorScreenParams<ClosetStackParamList> | undefined;
  Stylist: NavigatorScreenParams<StylistStackParamList> | undefined;
  Shop: NavigatorScreenParams<ShopStackParamList> | undefined;
  Calendar: {
    /** Open this event's detail sheet on arrival, and filter to its day. */
    eventId?: number;
    /** ISO `yyyy-mm-dd` to select on arrival. Implied by `eventId`. */
    date?: string;
    /** When false, focus the event's day without opening the detail sheet. */
    openDetail?: boolean;
  } | undefined;
};

// Unified closet stack (items + outfits + boards + their detail screens)
export type ClosetStackParamList = {
  ClosetMain: {
    segment?: 'pieces' | 'outfits' | 'boards';
    /** Preselect this category filter on arrival (board gap line deep-links here). */
    category?: ItemCategory;
  } | undefined;
  ItemDetail: {
    returnTo?: 'Home';
    itemId?: number;
    /** Opened from the modal Stylist: reopen it when this screen is left. */
    resumeStylist?: boolean;
    scanData?: ScanResult;
    scanImageUrl?: string;
  };
  ClosetRefresh: undefined;
  OutfitDetail: {
    outfitId: number;
    returnTo?: 'Calendar' | 'Home' | 'Stylist';
    resumeStylist?: boolean;
    returnToEventId?: number;
    returnToEventDetail?: boolean;
  };
  BoardDetail: { boardId: number; organize?: boolean; editCover?: boolean };
};

// Home nested stack
export type HomeStackParamList = {
  HomeMain: undefined;
  Suggestions: { eventId?: number } | undefined;
  Profile: undefined;
  ClosetInsights: undefined;
};

export type WishlistSection = 'products' | 'lists';

export type SavedShoppingTab = 'all' | 'looks' | 'pieces' | 'lists';
export type ShopView = 'for-you' | 'shortlist';
export type StylistStackParamList = {
  StylistMain: { view?: 'chat' | 'saved'; tab?: SavedShoppingTab; selectedId?: string } | undefined;
};
export type StylistScreenProps = CompositeScreenProps<
  NativeStackScreenProps<StylistStackParamList, 'StylistMain'>,
  BottomTabScreenProps<AppTabParamList>
>;

export type ShopSection = 'shortlist' | 'saved-looks' | 'saved-shopping';

// Shop nested stack (wishlist + shopping tools)
export type ShopStackParamList = {
  ShopMain: {
    view?: ShopView;
    section?: ShopSection;
    focusGroupId?: string;
    catalogFilter?: 'active' | 'all';
    resetFilters?: boolean;
    selectedId?: string;
    returnTo?: 'Home' | 'Closet';
  } | undefined;
  Wishlist: { section?: WishlistSection; selectedId?: string; returnTo?: 'Stylist' | 'stylist-modal' } | undefined;
  SavedShopping: { tab?: SavedShoppingTab; selectedId?: string } | undefined;
  SavedLooks: { selectedId?: string } | undefined;
  ShoppingGallery: {
    focusGroupId?: string;
    catalogFilter?: 'active' | 'all';
    resetFilters?: boolean;
    returnTo?: 'Home' | 'Closet';
  } | undefined;
  ShoppingHaulDetail: { groupKey: string };
  ShoppingCamera: undefined;
  ShoppingVisitReview: { sessionId: string };
  ShoppingBriefDetail: { returnTo?: 'Home' } | undefined;
  ShoppingEditAll: undefined;
  ShoppingPriorityEdit: {
    priority: ShoppingBriefPriority;
    source?: 'home_daily_look';
    origin?: 'shopping_brief' | 'daily_look';
    briefGeneratedAt?: string;
  };
};

// Wardrobe nested stack
export type WardrobeStackParamList = {
  WardrobeList: undefined;
  ItemDetail: {
    itemId?: number;
    scanData?: ScanResult;
    scanImageUrl?: string;
  };
  ClosetRefresh: undefined;
};

// Outfits nested stack
export type OutfitsStackParamList = {
  OutfitsList: undefined;
  OutfitDetail: { outfitId: number };
};

export type ClosetScreenProps = NativeStackScreenProps<ClosetStackParamList, 'ClosetMain'>;

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type ForgotPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
export type ResetPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

// CompositeScreenProps lets HomeMain navigate within HomeStack and across to sibling tabs.
export type HomeScreenProps = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'HomeMain'>,
  BottomTabScreenProps<AppTabParamList>
>;
export type ClosetInsightsScreenProps = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'ClosetInsights'>,
  BottomTabScreenProps<AppTabParamList>
>;
export type SuggestionsScreenProps = NativeStackScreenProps<HomeStackParamList, 'Suggestions'>;
export type ShopOverviewScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ShopStackParamList, 'ShopMain'>,
  BottomTabScreenProps<AppTabParamList>
>;
export type SavedLooksScreenProps = NativeStackScreenProps<ShopStackParamList, 'SavedLooks'>;
export type SavedShoppingScreenProps = NativeStackScreenProps<ShopStackParamList, 'SavedShopping'>;
export type ShoppingCameraScreenProps = NativeStackScreenProps<ShopStackParamList, 'ShoppingCamera'>;
export type ShoppingVisitReviewScreenProps = NativeStackScreenProps<ShopStackParamList, 'ShoppingVisitReview'>;
export type ShoppingGalleryScreenProps = NativeStackScreenProps<ShopStackParamList, 'ShoppingGallery'>;
export type ShoppingHaulDetailScreenProps = NativeStackScreenProps<ShopStackParamList, 'ShoppingHaulDetail'>;
export type ShoppingBriefDetailScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ShopStackParamList, 'ShoppingBriefDetail'>,
  BottomTabScreenProps<AppTabParamList>
>;
export type ShoppingEditAllScreenProps = NativeStackScreenProps<ShopStackParamList, 'ShoppingEditAll'>;
export type ShoppingPriorityEditScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ShopStackParamList, 'ShoppingPriorityEdit'>,
  BottomTabScreenProps<AppTabParamList>
>;
export type CalendarScreenProps = BottomTabScreenProps<AppTabParamList, 'Calendar'>;

// Screens now registered in ClosetStack
export type ItemDetailScreenProps = NativeStackScreenProps<ClosetStackParamList, 'ItemDetail'>;
export type ClosetRefreshScreenProps = NativeStackScreenProps<ClosetStackParamList, 'ClosetRefresh'>;
export type OutfitDetailScreenProps = NativeStackScreenProps<ClosetStackParamList, 'OutfitDetail'>;
export type BoardDetailScreenProps = NativeStackScreenProps<ClosetStackParamList, 'BoardDetail'>;

// Legacy — WardrobeScreen and OutfitsScreen are no longer tab destinations
// but their files still compile against these types
export type WardrobeListScreenProps = NativeStackScreenProps<WardrobeStackParamList, 'WardrobeList'>;
export type OutfitsListScreenProps = NativeStackScreenProps<OutfitsStackParamList, 'OutfitsList'>;

export type WishlistScreenProps = NativeStackScreenProps<ShopStackParamList, 'Wishlist'>;
