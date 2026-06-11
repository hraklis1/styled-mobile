import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, View, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { GlobalOutfitLoggerProvider, useGlobalOutfitLogger } from '../contexts/GlobalOutfitLoggerContext';
import { GlobalAIStylistProvider } from '../contexts/GlobalAIStylistContext';
import { GlobalScanProvider, useGlobalScan } from '../contexts/GlobalScanContext';
import { useGlobalAddSheet } from '../contexts/GlobalAddSheetContext';
import { FabScrollProvider } from '../contexts/FabScrollContext';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
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
import { colors, radii } from '../theme';

import type {
  AuthStackParamList,
  AppTabParamList,
  RootStackParamList,
  HomeStackParamList,
  ClosetStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['styled://'],
  config: {
    screens: {
      Auth: {
        screens: {
          // styled://reset-password?token_hash=...&type=recovery
          ResetPassword: 'reset-password',
        },
      } as any,
    },
  },
};
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTab = createBottomTabNavigator<AppTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ClosetStack = createNativeStackNavigator<ClosetStackParamList>();

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Closet: 'file-tray-full-outline',
  AddMenu: 'add-outline',
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
      <HomeStack.Screen name="Shop" component={ShopScreen} />
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
  const { openAddSheet } = useGlobalAddSheet();
  const { openScanItem, openBatchScan } = useGlobalScan();
  const { openLogger } = useGlobalOutfitLogger();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <AppTab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
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
                onPress={() => openAddSheet({
                  onTakePhoto: () => openScanItem('camera'),
                  onFromLibrary: () => openScanItem('library'),
                  onBatchImport: openBatchScan,
                  onLogOutfit: openLogger,
                })}
                activeOpacity={0.8}
                accessibilityLabel="Add item or log outfit"
              >
                <View style={tabStyles.addTabCircle}>
                  <Ionicons name="add" size={26} color={colors.primaryForeground} />
                </View>
              </TouchableOpacity>
            ),
          }}
        />
        <AppTab.Screen name="Calendar" component={CalendarScreen} />
        <AppTab.Screen name="Profile" component={ProfileScreen} />
      </AppTab.Navigator>
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
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const WELCOME_SEEN_KEY = 'welcome_seen';

function AppGate() {
  const { data: profile, isLoading } = useProfile();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SEEN_KEY).then((val) => {
      setWelcomeSeen(val === 'true');
    });
  }, []);

  const handleWelcomeComplete = useCallback(async () => {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true');
    setWelcomeSeen(true);
  }, []);

  if (isLoading || welcomeSeen === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Show welcome intro only to new users who haven't completed onboarding
  if (!welcomeSeen && !profile?.onboardingComplete) {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />;
  }

  if (!profile?.onboardingComplete) {
    return <OnboardingScreen />;
  }

  return (
    <GlobalOutfitLoggerProvider>
      <GlobalAIStylistProvider>
        <GlobalScanProvider>
          <FabScrollProvider>
            <AppTabNavigator />
          </FabScrollProvider>
        </GlobalScanProvider>
      </GlobalAIStylistProvider>
    </GlobalOutfitLoggerProvider>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer linking={linking}>
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
