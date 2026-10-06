import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * The stack inside the Profile modal. Profile covers who you are (style
 * editors); Settings covers how the app behaves. Both live in one modal so
 * the gear on the Profile hub is a push, not a second modal.
 */
export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditStyle: undefined;
  EditColor: undefined;
  EditFit: undefined;
  EditShopping: undefined;
  EditOccasions: undefined;
  Settings: undefined;
  SettingsMembership: undefined;
  SettingsStylist: undefined;
  SettingsNotifications: undefined;
  SettingsAccessibility: undefined;
  SettingsPrivacy: undefined;
  SettingsLearned: undefined;
  SettingsHiddenProducts: undefined;
  SettingsAccount: undefined;
  SettingsPassword: undefined;
};

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> =
  NativeStackScreenProps<ProfileStackParamList, T>;
