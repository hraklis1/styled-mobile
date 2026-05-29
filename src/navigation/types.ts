import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { ScanResult } from '../types/item';

export type RootStackParamList = {
  Auth: undefined;
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
  Calendar: undefined;
  Profile: undefined;
};

// Home nested stack
export type HomeStackParamList = {
  HomeMain: undefined;
  Stylist: { query?: string };
};

// Wardrobe nested stack
export type WardrobeStackParamList = {
  WardrobeList: undefined;
  ItemDetail: {
    itemId?: number;
    scanData?: ScanResult;
    scanImageUrl?: string;
  };
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
export type CalendarScreenProps = BottomTabScreenProps<AppTabParamList, 'Calendar'>;
export type ProfileScreenProps = BottomTabScreenProps<AppTabParamList, 'Profile'>;

export type WardrobeListScreenProps = NativeStackScreenProps<WardrobeStackParamList, 'WardrobeList'>;
export type ItemDetailScreenProps = NativeStackScreenProps<WardrobeStackParamList, 'ItemDetail'>;

export type OutfitsListScreenProps = NativeStackScreenProps<OutfitsStackParamList, 'OutfitsList'>;
export type OutfitDetailScreenProps = NativeStackScreenProps<OutfitsStackParamList, 'OutfitDetail'>;
