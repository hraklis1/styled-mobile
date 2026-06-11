import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PostHogProvider } from 'posthog-react-native';
import { queryClient, asyncStoragePersister } from './src/lib/queryClient';
import { posthog } from './src/lib/analytics';
import { initPurchases } from './src/lib/purchases';
import { AuthProvider } from './src/contexts/AuthContext';
import { GlobalAddSheetProvider } from './src/contexts/GlobalAddSheetContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/primitives/ErrorBoundary';
import { OfflineBanner } from './src/components/primitives/OfflineBanner';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});

// Must be called before AuthProvider mounts so loginUser() can run immediately after auth
initPurchases();

SplashScreen.preventAutoHideAsync();

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <PostHogProvider
            client={posthog}
            autocapture={{
              captureScreens: false,
              captureTouches: true,
            }}
          >
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{ persister: asyncStoragePersister }}
            >
              <AuthProvider>
                <BottomSheetModalProvider>
                  <GlobalAddSheetProvider>
                    <StatusBar style="auto" />
                    <RootNavigator />
                    <OfflineBanner />
                  </GlobalAddSheetProvider>
                </BottomSheetModalProvider>
              </AuthProvider>
            </PersistQueryClientProvider>
          </PostHogProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
