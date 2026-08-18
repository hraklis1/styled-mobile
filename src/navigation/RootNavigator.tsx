import { useEffect, useState, useCallback, useRef } from 'react';
import { ActivityIndicator, Easing, View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  LinkingOptions,
  getFocusedRouteNameFromRoute,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useShoppingSyncManager } from '../hooks/useShoppingSyncManager';
import { syncLocalWishlistToServer } from '../lib/wishlistSync';
import { track } from '../lib/analytics';
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
import { ItemDetailScreen } from '../screens/app/ItemDetailScreen';
import { ClosetRefreshScreen } from '../screens/app/ClosetRefreshScreen';
import { OutfitDetailScreen } from '../screens/app/OutfitDetailScreen';
import { BoardDetailScreen } from '../screens/app/BoardDetailScreen';
import { ClosetScreen } from '../screens/app/ClosetScreen';
import { CalendarScreen } from '../screens/app/CalendarScreen';
import { ProfileScreen } from '../screens/app/ProfileScreen';
import { SuggestionsScreen } from '../screens/app/SuggestionsScreen';
import { SavedLooksScreen, SavedShoppingScreen } from '../screens/app/ShopScreen';
import { ShopOverviewScreen } from '../screens/app/ShopOverviewScreen';
import { ShoppingCameraScreen } from '../screens/app/ShoppingCameraScreen';
import { ShoppingGalleryScreen } from '../screens/app/ShoppingGalleryScreen';
import { ShoppingHaulDetailScreen } from '../screens/app/ShoppingHaulDetailScreen';
import { ShoppingBriefDetailScreen } from '../screens/app/ShoppingBriefDetailScreen';
import { ShoppingPriorityEditScreen } from '../screens/app/ShoppingPriorityEditScreen';
import { StylistScreen } from '../screens/app/StylistScreen';
import { ErrorState } from '../components/primitives/ErrorState';
import { QuickMenuTabButton } from '../components/navigation/QuickMenuTabButton';
import { StylistTabButton } from '../components/navigation/StylistTabButton';
import { TabQuickMenuSheet, type TabQuickMenuOption } from '../components/navigation/TabQuickMenuSheet';
import { ShortcutCoachSheet } from '../components/navigation/ShortcutCoachSheet';
import { hasSeenShortcutCoach, markShortcutCoachSeen } from '../lib/shortcutCoach';
import { colors, spacing, typography } from '../theme';

import type {
  AuthStackParamList,
  AppTabParamList,
  RootStackParamList,
  HomeStackParamList,
  ClosetStackParamList,
  ShopStackParamList,
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
      App: {
        screens: {
          Shop: {
            screens: {
              ShopMain: 'shop',
              SavedLooks: 'saved-looks',
              ShoppingCamera: 'shopping-camera',
              ShoppingGallery: {
                path: 'shopping-gallery',
                alias: ['daily-finds'],
              },
            },
          },
        },
      } as any,
    },
  },
};
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTab = createBottomTabNavigator<AppTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ClosetStack = createNativeStackNavigator<ClosetStackParamList>();
const StylistStack = createNativeStackNavigator();
const ShopStack = createNativeStackNavigator<ShopStackParamList>();

const TAB_ICONS: Record<string, { default: keyof typeof Ionicons.glyphMap; selected: keyof typeof Ionicons.glyphMap }> = {
  Home: { default: 'home-outline', selected: 'home' },
  Closet: { default: 'file-tray-full-outline', selected: 'file-tray-full' },
  Stylist: { default: 'sparkles-outline', selected: 'sparkles' },
  Shop: { default: 'bag-outline', selected: 'bag' },
  Calendar: { default: 'calendar-outline', selected: 'calendar' },
};

const STYLIST_SHEET_TRANSITION: NonNullable<BottomTabNavigationOptions['transitionSpec']> = {
  animation: 'timing',
  config: {
    duration: 260,
    easing: Easing.out(Easing.cubic),
  },
};

// Keep the center-tab Stylist transition visually aligned with the in-app
// sheets: the scene fades as it moves vertically, and the same symmetric
// interpolation is used when opening and returning to the previous tab.
const stylistSheetInterpolator: NonNullable<BottomTabNavigationOptions['sceneStyleInterpolator']> = ({ current }) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 1, 0],
    }),
    transform: [
      {
        translateY: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [96, 0, 96],
        }),
      },
    ],
  },
});

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
      <HomeStack.Screen name="Suggestions" component={SuggestionsScreen} />
      <HomeStack.Screen name="Profile" component={ProfileScreen} options={{ presentation: 'modal' }} />
    </HomeStack.Navigator>
  );
}

function ShopNavigator() {
  return (
    <ShopStack.Navigator screenOptions={{ headerShown: false }}>
      <ShopStack.Screen name="ShopMain" component={ShopOverviewScreen} />
      <ShopStack.Screen name="ShoppingBriefDetail" component={ShoppingBriefDetailScreen} />
      <ShopStack.Screen name="ShoppingPriorityEdit" component={ShoppingPriorityEditScreen} />
      <ShopStack.Screen name="SavedShopping" component={SavedShoppingScreen} />
      <ShopStack.Screen name="SavedLooks" component={SavedLooksScreen} />
      <ShopStack.Screen name="ShoppingGallery" component={ShoppingGalleryScreen} />
      <ShopStack.Screen
        name="ShoppingHaulDetail"
        component={ShoppingHaulDetailScreen}
        options={{ animation: 'fade', gestureEnabled: true }}
      />
      <ShopStack.Screen name="ShoppingCamera" component={ShoppingCameraScreen} />
    </ShopStack.Navigator>
  );
}

function ClosetNavigator() {
  return (
    <ClosetStack.Navigator screenOptions={{ headerShown: false }}>
      <ClosetStack.Screen name="ClosetMain" component={ClosetScreen} />
      <ClosetStack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <ClosetStack.Screen name="ClosetRefresh" component={ClosetRefreshScreen} />
      <ClosetStack.Screen name="OutfitDetail" component={OutfitDetailScreen} />
      <ClosetStack.Screen name="BoardDetail" component={BoardDetailScreen} />
    </ClosetStack.Navigator>
  );
}

function StylistNavigator() {
  return (
    <StylistStack.Navigator screenOptions={{ headerShown: false }}>
      <StylistStack.Screen name="StylistMain" component={StylistScreen} />
    </StylistStack.Navigator>
  );
}

function AppTabNavigator() {
  const { user } = useAuth();
  const userId = user?.id;
  const insets = useSafeAreaInsets();
  const previousTabRef = useRef<Exclude<keyof AppTabParamList, 'Stylist'>>('Home');
  const [quickMenu, setQuickMenu] = useState<{
    title: string;
    subtitle?: string;
    options: TabQuickMenuOption[];
  } | null>(null);
  const [shortcutCoachVisible, setShortcutCoachVisible] = useState(false);
  const [shortcutCoachPulse, setShortcutCoachPulse] = useState(0);
  const closeQuickMenu = useCallback(() => setQuickMenu(null), []);

  const { openAddSheet } = useGlobalAddSheet();
  const { openScanItem, openBatchScan } = useGlobalScan();
  const { openLogger } = useGlobalOutfitLogger();

  // Capture is the app's core loop, so it lives one long-press from every screen
  // rather than only on Home. Straight to the camera — the full menu of import
  // routes stays available on Home.
  const quickAddPiece = useCallback(() => {
    track('closet_quick_action_tapped', { action: 'add_clothes' });
    openScanItem('camera');
  }, [openScanItem]);

  const quickImportPieces = useCallback(() => {
    track('closet_quick_action_tapped', { action: 'import_clothes' });
    openAddSheet({
      onTakePhoto: () => openScanItem('camera'),
      onFromLibrary: () => openScanItem('library'),
      onBatchImport: openBatchScan,
    });
  }, [openAddSheet, openBatchScan, openScanItem]);

  const quickLogWear = useCallback(() => {
    track('closet_quick_action_tapped', { action: 'record_wear' });
    openLogger({ quickStart: true });
  }, [openLogger]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setShortcutCoachVisible(false);
    if (!userId) return () => { active = false; };

    hasSeenShortcutCoach(userId).then((seen) => {
      if (!active || seen) return;
      timer = setTimeout(() => {
        if (active) {
          track('tab_shortcut_coach_shown');
          setShortcutCoachVisible(true);
        }
      }, 700);
    }).catch(() => undefined);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [userId]);

  const finishShortcutCoach = useCallback((reason: 'got_it' | 'dismissed') => {
    if (!userId) return;
    setShortcutCoachVisible(false);
    track('tab_shortcut_coach_dismissed', { reason });
    void markShortcutCoachSeen(userId);
  }, [userId]);

  const tryShortcut = useCallback(() => {
    if (!userId) return;
    setShortcutCoachVisible(false);
    setShortcutCoachPulse((value) => value + 1);
    track('tab_shortcut_coach_try_tapped');
    void markShortcutCoachSeen(userId);
  }, [userId]);

  // Once per signed-in session, migrate any legacy on-device wishlist to the server.
  useEffect(() => {
    void syncLocalWishlistToServer();
  }, []);

  const baseTabBarStyle = {
    height: 60 + insets.bottom,
    paddingBottom: insets.bottom,
    backgroundColor: colors.background,
    borderTopColor: colors.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    boxShadow: '0 -3px 10px rgba(29, 27, 24, 0.07)',
  };

  return (
    <View style={{ flex: 1 }}>
      <AppTab.Navigator
        /**
         * Keep inactive tab screens attached to the native view hierarchy.
         *
         * With detaching on, the tab's `activityState` on the underlying
         * react-native-screens Screen is driven by the same Animated value as
         * our fade, and on the new architecture the two race: a tab whose fade
         * is interrupted mid-flight (any re-render of this navigator restarts
         * it) can settle detached while focused, so the screen comes up blank
         * until you leave and come back. It hits the heaviest screens hardest,
         * which is why Shop and Calendar showed it most.
         *
         * Attaching unconditionally is the upstream-endorsed workaround; the
         * cost is that visited tabs keep their native views around. See
         * https://github.com/react-navigation/react-navigation/issues/12755
         * and https://github.com/software-mansion/react-native-screens/issues/3550
         * — remove this once react-native-screens fixes the race.
         */
        detachInactiveScreens={false}
        screenOptions={({ route }) => ({
          headerShown: false,
          animation: 'fade',
          tabBarStyle: baseTabBarStyle,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? TAB_ICONS[route.name].selected : TAB_ICONS[route.name].default}
              size={size}
              color={color}
            />
          ),
          tabBarLabel: ({ children, color, focused }) => (
            <Text
              style={[
                tabStyles.tabLabel,
                { color, fontWeight: focused ? typography.weight.semibold : typography.weight.regular },
              ]}
            >
              {children}
            </Text>
          ),
        })}
      >
        <AppTab.Screen name="Home" component={HomeNavigator} />
        <AppTab.Screen
          name="Closet"
          component={ClosetNavigator}
          options={{
            tabBarAccessibilityLabel: 'Closet. Press and hold for shortcuts.',
            tabBarButton: (props) => <QuickMenuTabButton {...props} pulseToken={shortcutCoachPulse} />,
          }}
          listeners={({ navigation }) => ({
            tabLongPress: () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setQuickMenu({
                title: 'Closet',
                subtitle: 'Capture a piece, or jump to a section',
                options: [
                  {
                    key: 'add-piece',
                    label: 'Photograph a piece',
                    icon: 'camera',
                    iconColor: colors.primaryForeground,
                    iconBg: colors.primary,
                    onPress: quickAddPiece,
                  },
                  {
                    key: 'import-pieces',
                    label: 'Import pieces',
                    icon: 'images',
                    iconColor: colors.primaryForeground,
                    iconBg: colors.primary,
                    onPress: quickImportPieces,
                  },
                  {
                    key: 'log-wear',
                    label: 'What did you wear?',
                    icon: 'checkmark-done',
                    iconColor: colors.primaryForeground,
                    iconBg: colors.primary,
                    onPress: quickLogWear,
                  },
                  {
                    key: 'pieces',
                    label: 'Pieces',
                    icon: 'shirt-outline',
                    dividerAbove: true,
                    onPress: () => navigation.navigate('Closet', { screen: 'ClosetMain', params: { segment: 'pieces' } }),
                  },
                  {
                    key: 'outfits',
                    label: 'Outfits',
                    icon: 'layers-outline',
                    onPress: () => navigation.navigate('Closet', { screen: 'ClosetMain', params: { segment: 'outfits' } }),
                  },
                  {
                    key: 'boards',
                    label: 'Boards',
                    icon: 'albums-outline',
                    onPress: () => navigation.navigate('Closet', { screen: 'ClosetMain', params: { segment: 'boards' } }),
                  },
                  {
                    key: 'refresh',
                    label: 'Closet Refresh',
                    icon: 'color-wand-outline',
                    onPress: () => navigation.navigate('Closet', { screen: 'ClosetRefresh' }),
                  },
                ],
              });
            },
          })}
        />
        <AppTab.Screen
          name="Stylist"
          component={StylistNavigator}
          options={{
            tabBarAccessibilityLabel: 'Stylist',
            tabBarLabel: () => null,
            tabBarButton: (props) => <StylistTabButton {...props} />,
            transitionSpec: STYLIST_SHEET_TRANSITION,
            sceneStyleInterpolator: stylistSheetInterpolator,
          }}
          listeners={({ navigation }) => ({
            tabPress: (event) => {
              if (!navigation.isFocused()) {
                const state = navigation.getState();
                const currentTab = state.routes[state.index]?.name;

                if (currentTab && currentTab !== 'Stylist') {
                  previousTabRef.current = currentTab;
                }
                return;
              }

              event.preventDefault();
              navigation.navigate(previousTabRef.current);
            },
          })}
        />
        <AppTab.Screen
          name="Shop"
          component={ShopNavigator}
          options={({ route }) => ({
            tabBarAccessibilityLabel: 'Shop. Press and hold for shortcuts.',
            tabBarButton: (props) => <QuickMenuTabButton {...props} pulseToken={shortcutCoachPulse} />,
            tabBarStyle:
              getFocusedRouteNameFromRoute(route) === 'ShoppingCamera'
                ? { ...baseTabBarStyle, display: 'none' }
                : baseTabBarStyle,
          })}
          listeners={({ navigation }) => ({
            tabLongPress: () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setQuickMenu({
                title: 'Shop',
                subtitle: 'Jump straight to a section',
                options: [
                  {
                    key: 'overview',
                    label: 'Shopping Brief',
                    icon: 'bag-outline',
                    onPress: () => navigation.navigate('Shop', { screen: 'ShopMain' }),
                  },
                  {
                    key: 'saved-looks',
                    label: 'From Your Stylist',
                    icon: 'heart-outline',
                    onPress: () => navigation.navigate('Shop', { screen: 'SavedShopping' }),
                  },
                  {
                    key: 'shopping-history',
                    label: 'Shortlist',
                    icon: 'images-outline',
                    onPress: () => navigation.navigate('Shop', { screen: 'ShoppingGallery' }),
                  },
                  {
                    key: 'shopping-camera',
                    label: 'Shopping Mode',
                    icon: 'camera-outline',
                    onPress: () => navigation.navigate('Shop', { screen: 'ShoppingCamera' }),
                  },
                ],
              });
            },
          })}
        />
        <AppTab.Screen name="Calendar" component={CalendarScreen} />
      </AppTab.Navigator>
      <TabQuickMenuSheet
        visible={quickMenu !== null}
        title={quickMenu?.title ?? ''}
        subtitle={quickMenu?.subtitle}
        options={quickMenu?.options ?? []}
        onClose={closeQuickMenu}
      />
      <ShortcutCoachSheet
        visible={shortcutCoachVisible}
        onClose={finishShortcutCoach}
        onTry={tryShortcut}
      />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  tabLabel: {
    fontSize: typography.size.xs,
    lineHeight: 14,
    marginBottom: spacing.xs,
  },
});

const WELCOME_SEEN_KEY = 'welcome_seen';

function AppGate() {
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);
  /**
   * Whether the questionnaire is on screen — a latch, not a derived value.
   *
   * `onboardingComplete` flips to true partway through the flow, at the point
   * the required steps are done and the optional ones begin. Rendering straight
   * off the flag would tear the screen down right there and drop the user into
   * the app mid-questionnaire. So the flag decides when to ENTER, and only the
   * screen itself decides when to leave. This is also what lets "Retake style
   * quiz" reopen the flow from inside the app.
   */
  const [onboardingActive, setOnboardingActive] = useState(false);
  const needsOnboarding = !!profile && !profile.onboardingComplete;

  useEffect(() => {
    if (needsOnboarding) setOnboardingActive(true);
  }, [needsOnboarding]);

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

  if (isError) {
    return <ErrorState message="Couldn't load your account" onRetry={refetch} />;
  }

  // Show welcome intro only to new users who haven't completed onboarding
  if (!welcomeSeen && !profile?.onboardingComplete) {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />;
  }

  if (onboardingActive) {
    return <OnboardingScreen onExit={() => setOnboardingActive(false)} />;
  }

  return (
    <GlobalScanProvider>
      <GlobalOutfitLoggerProvider>
        <GlobalAIStylistProvider>
          <FabScrollProvider>
            <AppTabNavigator />
          </FabScrollProvider>
        </GlobalAIStylistProvider>
      </GlobalOutfitLoggerProvider>
    </GlobalScanProvider>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();
  useShoppingSyncManager();

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
