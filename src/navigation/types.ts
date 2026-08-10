import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { ScanResult } from '../types/item';

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string; token_hash?: string; type?: string };
};

export type AppTabParamList = {
  Home: undefined;
  Closet: NavigatorScreenParams<ClosetStackParamList> | undefined;
  Stylist: undefined;
  Shop: NavigatorScreenParams<ShopStackParamList> | undefined;
  Calendar: {
    /** Open this event's detail sheet on arrival, and filter to its day. */
    eventId?: number;
    /** ISO `yyyy-mm-dd` to select on arrival. Implied by `eventId`. */
    date?: string;
  } | undefined;
};

// Unified closet stack (items + outfits + boards + their detail screens)
export type ClosetStackParamList = {
  ClosetMain: { segment?: 'pieces' | 'outfits' | 'boards' } | undefined;
  ItemDetail: {
    itemId?: number;
    scanData?: ScanResult;
    scanImageUrl?: string;
  };
  ClosetRefresh: undefined;
  OutfitDetail: { outfitId: number; returnTo?: 'Calendar' | 'Home' };
  BoardDetail: { boardId: number; organize?: boolean; editCover?: boolean };
};

// Home nested stack
export type HomeStackParamList = {
  HomeMain: undefined;
  Suggestions: { eventId?: number } | undefined;
  Profile: undefined;
};

export type ShopSection = 'brief' | 'shortlist' | 'saved-looks';

// Shop nested stack (wishlist + shopping tools)
export type ShopStackParamList = {
  ShopMain: {
    section?: ShopSection;
    focusGroupId?: string;
    catalogFilter?: 'active' | 'all';
    selectedId?: string;
    returnTo?: 'Home' | 'Closet';
  } | undefined;
  SavedLooks: { selectedId?: string } | undefined;
  ShoppingGallery: {
    focusGroupId?: string;
    catalogFilter?: 'active' | 'all';
    returnTo?: 'Home' | 'Closet';
  } | undefined;
  ShoppingHaulDetail: { groupKey: string };
  ShoppingCamera: undefined;
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
export type SuggestionsScreenProps = NativeStackScreenProps<HomeStackParamList, 'Suggestions'>;
export type ShopOverviewScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ShopStackParamList, 'ShopMain'>,
  BottomTabScreenProps<AppTabParamList>
>;
export type SavedLooksScreenProps = NativeStackScreenProps<ShopStackParamList, 'SavedLooks'>;
export type ShoppingCameraScreenProps = NativeStackScreenProps<ShopStackParamList, 'ShoppingCamera'>;
export type ShoppingGalleryScreenProps = NativeStackScreenProps<ShopStackParamList, 'ShoppingGallery'>;
export type ShoppingHaulDetailScreenProps = NativeStackScreenProps<ShopStackParamList, 'ShoppingHaulDetail'>;
export type CalendarScreenProps = BottomTabScreenProps<AppTabParamList, 'Calendar'>;
export type ProfileScreenProps = NativeStackScreenProps<HomeStackParamList, 'Profile'>;

// Screens now registered in ClosetStack
export type ItemDetailScreenProps = NativeStackScreenProps<ClosetStackParamList, 'ItemDetail'>;
export type ClosetRefreshScreenProps = NativeStackScreenProps<ClosetStackParamList, 'ClosetRefresh'>;
export type OutfitDetailScreenProps = NativeStackScreenProps<ClosetStackParamList, 'OutfitDetail'>;
export type BoardDetailScreenProps = NativeStackScreenProps<ClosetStackParamList, 'BoardDetail'>;

// Legacy — WardrobeScreen and OutfitsScreen are no longer tab destinations
// but their files still compile against these types
export type WardrobeListScreenProps = NativeStackScreenProps<WardrobeStackParamList, 'WardrobeList'>;
export type OutfitsListScreenProps = NativeStackScreenProps<OutfitsStackParamList, 'OutfitsList'>;
