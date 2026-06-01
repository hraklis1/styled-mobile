import { useState } from 'react';
import { ActivityIndicator, View, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { GlobalOutfitLoggerProvider } from '../contexts/GlobalOutfitLoggerContext';
import { useGlobalOutfitLogger } from '../contexts/GlobalOutfitLoggerContext';
import { GlobalAIStylistProvider } from '../contexts/GlobalAIStylistContext';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { HomeScreen } from '../screens/app/HomeScreen';
import { StylistScreen } from '../screens/app/StylistScreen';
import { ItemDetailScreen } from '../screens/app/ItemDetailScreen';
import { ClosetRefreshScreen } from '../screens/app/ClosetRefreshScreen';
import { OutfitDetailScreen } from '../screens/app/OutfitDetailScreen';
import { ClosetScreen } from '../screens/app/ClosetScreen';
import { CalendarScreen } from '../screens/app/CalendarScreen';
import { ProfileScreen } from '../screens/app/ProfileScreen';
import { SuggestionsScreen } from '../screens/app/SuggestionsScreen';
import { ShopScreen } from '../screens/app/ShopScreen';
import { QuickCaptureSheet } from '../components/wardrobe/QuickCaptureSheet';
import { colors, shadows } from '../theme';

import type {
  AuthStackParamList,
  AppTabParamList,
  RootStackParamList,
  HomeStackParamList,
  ClosetStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTab = createBottomTabNavigator<AppTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ClosetStack = createNativeStackNavigator<ClosetStackParamList>();

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Closet: 'file-tray-full-outline',
  AddMenu: 'add-outline',
  Shop: 'bag-handle-outline',
  Calendar: 'calendar-outline',
  Profile: 'person-outline',
};

// ── Placeholder screen for the center + tab (never shown) ────────────────────

function EmptyAddScreen() {
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}

// ── Navigators ────────────────────────────────────────────────────────────────

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="Stylist" component={StylistScreen} />
      <HomeStack.Screen name="Suggestions" component={SuggestionsScreen} />
    </HomeStack.Navigator>
  );
}

function ClosetNavigator() {
  return (
    <ClosetStack.Navigator screenOptions={{ headerShown: false }}>
      <ClosetStack.Screen name="ClosetMain" component={ClosetScreen} />
      <ClosetStack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <ClosetStack.Screen name="ClosetRefresh" component={ClosetRefreshScreen} />
      <ClosetStack.Screen name="OutfitDetail" component={OutfitDetailScreen} />
    </ClosetStack.Navigator>
  );
}

function AppTabNavigator() {
  const [quickCaptureVisible, setQuickCaptureVisible] = useState(false);
  const { openLogger } = useGlobalOutfitLogger();

  return (
    <View style={{ flex: 1 }}>
      <AppTab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            height: 60,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: -2 },
            elevation: 8,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
          ),
        })}
      >
        <AppTab.Screen name="Home" component={HomeNavigator} />
        <AppTab.Screen name="Closet" component={ClosetNavigator} />
        <AppTab.Screen
          name="AddMenu"
          component={EmptyAddScreen}
          options={{
            tabBarLabel: () => null,
            tabBarButton: () => (
              <TouchableOpacity
                style={tabStyles.addTabBtn}
                onPress={() => setQuickCaptureVisible(true)}
                activeOpacity={0.85}
                accessibilityLabel="Add item or log outfit"
              >
                <View style={tabStyles.addTabCircle}>
                  <Ionicons name="add" size={30} color={colors.primaryForeground} />
                </View>
              </TouchableOpacity>
            ),
          }}
        />
        <AppTab.Screen name="Shop" component={ShopScreen} />
        <AppTab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none', width: 0, overflow: 'hidden' },
          }}
        />
        <AppTab.Screen name="Profile" component={ProfileScreen} />
      </AppTab.Navigator>

      <QuickCaptureSheet
        visible={quickCaptureVisible}
        onClose={() => setQuickCaptureVisible(false)}
        onLogOutfit={() => { setQuickCaptureVisible(false); openLogger(); }}
      />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  addTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTabCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -12 }],
    ...shadows.warm,
  },
});

function AppGate() {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!profile?.onboardingComplete) {
    return <OnboardingScreen />;
  }

  return (
    <GlobalOutfitLoggerProvider>
      <GlobalAIStylistProvider>
        <AppTabNavigator />
      </GlobalAIStylistProvider>
    </GlobalOutfitLoggerProvider>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="App" component={AppGate} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
