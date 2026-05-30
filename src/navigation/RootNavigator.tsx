import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { GlobalOutfitLoggerProvider } from '../contexts/GlobalOutfitLoggerContext';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { HomeScreen } from '../screens/app/HomeScreen';
import { StylistScreen } from '../screens/app/StylistScreen';
import { WardrobeScreen } from '../screens/app/WardrobeScreen';
import { ItemDetailScreen } from '../screens/app/ItemDetailScreen';
import { OutfitsScreen } from '../screens/app/OutfitsScreen';
import { OutfitDetailScreen } from '../screens/app/OutfitDetailScreen';
import { CalendarScreen } from '../screens/app/CalendarScreen';
import { ProfileScreen } from '../screens/app/ProfileScreen';
import { SuggestionsScreen } from '../screens/app/SuggestionsScreen';
import { ShopScreen } from '../screens/app/ShopScreen';

import type {
  AuthStackParamList,
  AppTabParamList,
  RootStackParamList,
  HomeStackParamList,
  WardrobeStackParamList,
  OutfitsStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTab = createBottomTabNavigator<AppTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const WardrobeStack = createNativeStackNavigator<WardrobeStackParamList>();
const OutfitsStack = createNativeStackNavigator<OutfitsStackParamList>();

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Wardrobe: 'shirt-outline',
  Outfits: 'layers-outline',
  Shop: 'bag-handle-outline',
  Calendar: 'calendar-outline',
  Profile: 'person-outline',
};

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

function WardrobeNavigator() {
  return (
    <WardrobeStack.Navigator screenOptions={{ headerShown: false }}>
      <WardrobeStack.Screen name="WardrobeList" component={WardrobeScreen} />
      <WardrobeStack.Screen name="ItemDetail" component={ItemDetailScreen} />
    </WardrobeStack.Navigator>
  );
}

function OutfitsNavigator() {
  return (
    <OutfitsStack.Navigator screenOptions={{ headerShown: false }}>
      <OutfitsStack.Screen name="OutfitsList" component={OutfitsScreen} />
      <OutfitsStack.Screen name="OutfitDetail" component={OutfitDetailScreen} />
    </OutfitsStack.Navigator>
  );
}

function AppTabNavigator() {
  return (
    <AppTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <AppTab.Screen name="Home" component={HomeNavigator} />
      <AppTab.Screen name="Wardrobe" component={WardrobeNavigator} />
      <AppTab.Screen name="Outfits" component={OutfitsNavigator} />
      <AppTab.Screen name="Shop" component={ShopScreen} />
      <AppTab.Screen name="Calendar" component={CalendarScreen} />
      <AppTab.Screen name="Profile" component={ProfileScreen} />
    </AppTab.Navigator>
  );
}

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
      <AppTabNavigator />
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
