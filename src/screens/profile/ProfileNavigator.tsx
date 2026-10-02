import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { ProfileHomeScreen } from './ProfileHomeScreen';
import { EditStyleScreen } from './EditStyleScreen';
import { EditColorScreen } from './EditColorScreen';
import { EditFitScreen } from './EditFitScreen';
import { EditShoppingScreen } from './EditShoppingScreen';
import { EditOccasionsScreen } from './EditOccasionsScreen';
import { SettingsScreen } from './SettingsScreen';
import { MembershipScreen } from './MembershipScreen';
import { StylistSettingsScreen } from './StylistSettingsScreen';
import { NotificationsScreen } from './NotificationsScreen';
import { AccessibilityScreen } from './AccessibilityScreen';
import { PrivacyScreen } from './PrivacyScreen';
import { LearnedScreen } from './LearnedScreen';
import { AccountScreen } from './AccountScreen';
import { PasswordScreen } from './PasswordScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileHomeScreen} />
      <Stack.Screen name="EditStyle" component={EditStyleScreen} />
      <Stack.Screen name="EditColor" component={EditColorScreen} />
      <Stack.Screen name="EditFit" component={EditFitScreen} />
      <Stack.Screen name="EditShopping" component={EditShoppingScreen} />
      <Stack.Screen name="EditOccasions" component={EditOccasionsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SettingsMembership" component={MembershipScreen} />
      <Stack.Screen name="SettingsStylist" component={StylistSettingsScreen} />
      <Stack.Screen name="SettingsNotifications" component={NotificationsScreen} />
      <Stack.Screen name="SettingsAccessibility" component={AccessibilityScreen} />
      <Stack.Screen name="SettingsPrivacy" component={PrivacyScreen} />
      <Stack.Screen name="SettingsLearned" component={LearnedScreen} />
      <Stack.Screen name="SettingsAccount" component={AccountScreen} />
      <Stack.Screen name="SettingsPassword" component={PasswordScreen} />
    </Stack.Navigator>
  );
}
