import { useEffect } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
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
import { FabScrollProvider, useFabScroll } from '../contexts/FabScrollContext';
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
import { useGlobalAIStylist } from '../contexts/GlobalAIStylistContext';
import { colors, spacing, typography, radii } from '../theme';

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
  const { openStylist } = useGlobalAIStylist();
  const { openAddSheet } = useGlobalAddSheet();
  const { openScanItem, openBatchScan } = useGlobalScan();
  const { openLogger } = useGlobalOutfitLogger();
  const insets = useSafeAreaInsets();
  const { fabCollapsed } = useFabScroll();

  const EASE_OUT = { duration: 200, easing: Easing.out(Easing.quad) };

  const fabAnimStyle = useAnimatedStyle(() => ({
    paddingHorizontal: withTiming(
      fabCollapsed.value ? spacing.sm : spacing.lg,
      EASE_OUT,
    ),
  }));

  const fabLabelContainerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(fabCollapsed.value ? 0 : 1, { duration: 150 }),
    width: withTiming(fabCollapsed.value ? 0 : 48, EASE_OUT),
    marginLeft: withTiming(fabCollapsed.value ? 0 : spacing.xs, EASE_OUT),
  }));

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

      <Animated.View
        style={[tabStyles.stylistFab, fabAnimStyle, { bottom: insets.bottom + 60 + spacing.xs }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={() => openStylist()}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={0.85}
          accessibilityLabel="Open AI Stylist"
        >
          <Ionicons name="sparkles" size={22} color={colors.primaryForeground} />
          <Animated.View style={[tabStyles.stylistFabLabelContainer, fabLabelContainerStyle]}>
            <Text style={tabStyles.stylistFabLabel} numberOfLines={1}>Stylist</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

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
  stylistFab: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  stylistFabLabelContainer: {
    overflow: 'hidden',
  },
  stylistFabLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
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
