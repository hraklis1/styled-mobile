import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useShoppingSessionStore } from '../stores/useShoppingSessionStore';

const SHOPPING_SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

function handleAppStateChange(nextState: AppStateStatus, now = Date.now()): void {
  const {
    lastBackgroundTimestamp,
    clearStoreName,
    setBackgroundTimestamp,
  } = useShoppingSessionStore.getState();

  if (nextState === 'background') {
    setBackgroundTimestamp(now);
    return;
  }

  if (nextState !== 'active' || lastBackgroundTimestamp === null) return;

  if (now - lastBackgroundTimestamp > SHOPPING_SESSION_IDLE_TIMEOUT_MS) {
    clearStoreName();
  }

  setBackgroundTimestamp(null);
}

/**
 * Maintains the active Shopping Mode store context across brief app switches,
 * but clears it after the app has spent more than ten minutes in background.
 */
export function useAppStateListener(): void {
  useEffect(() => {
    // Reconcile persisted state on a cold launch as AppState may already be
    // active before the change listener is attached.
    handleAppStateChange(AppState.currentState);

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
}
