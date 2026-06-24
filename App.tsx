import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PostHogProvider } from 'posthog-react-native';
import { queryClient } from './src/lib/queryClient';
import { posthog } from './src/lib/analytics';
import { initPurchases } from './src/lib/purchases';
import { AuthProvider } from './src/contexts/AuthContext';
import { GlobalAddSheetProvider } from './src/contexts/GlobalAddSheetContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/primitives/ErrorBoundary';
import { OfflineBanner } from './src/components/primitives/OfflineBanner';
import { useAppStateListener } from './src/hooks/useAppStateListener';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: __DEV__ ? 1.0 : 0.1,
});

// Must be called before AuthProvider mounts so loginUser() can run immediately after auth
initPurchases();

SplashScreen.preventAutoHideAsync();

function App() {
  useAppStateListener();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <PostHogProvider
            client={posthog}
            autocapture={false}
          >
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <BottomSheetModalProvider>
                  <GlobalAddSheetProvider>
                    <StatusBar style="dark" />
                    <RootNavigator />
                    <OfflineBanner />
                  </GlobalAddSheetProvider>
                </BottomSheetModalProvider>
              </AuthProvider>
            </QueryClientProvider>
          </PostHogProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
