import type { CompositeScreenProps } from '@react-navigation/native';
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
  ResetPassword: { token?: string };
};

export type AppTabParamList = {
  Home: undefined;
  Wardrobe: undefined;
  Outfits: undefined;
  Shop: undefined;
  Calendar: undefined;
  Profile: undefined;
};

// Home nested stack
export type HomeStackParamList = {
  HomeMain: undefined;
  Stylist: { query?: string };
  Suggestions: { eventId?: number } | undefined;
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

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type ForgotPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
export type ResetPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

// CompositeScreenProps lets HomeMain navigate both within HomeStack (→ Stylist)
// and across to sibling tabs (→ Wardrobe, Outfits, Calendar)
export type HomeScreenProps = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'HomeMain'>,
  BottomTabScreenProps<AppTabParamList>
>;
export type StylistScreenProps = NativeStackScreenProps<HomeStackParamList, 'Stylist'>;
export type SuggestionsScreenProps = NativeStackScreenProps<HomeStackParamList, 'Suggestions'>;
export type ShopScreenProps = BottomTabScreenProps<AppTabParamList, 'Shop'>;
export type CalendarScreenProps = BottomTabScreenProps<AppTabParamList, 'Calendar'>;
export type ProfileScreenProps = BottomTabScreenProps<AppTabParamList, 'Profile'>;

export type WardrobeListScreenProps = NativeStackScreenProps<WardrobeStackParamList, 'WardrobeList'>;
export type ItemDetailScreenProps = NativeStackScreenProps<WardrobeStackParamList, 'ItemDetail'>;
export type ClosetRefreshScreenProps = NativeStackScreenProps<WardrobeStackParamList, 'ClosetRefresh'>;

export type OutfitsListScreenProps = NativeStackScreenProps<OutfitsStackParamList, 'OutfitsList'>;
export type OutfitDetailScreenProps = NativeStackScreenProps<OutfitsStackParamList, 'OutfitDetail'>;
