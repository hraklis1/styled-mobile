import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useShoppingSessionStore } from '../stores/useShoppingSessionStore';
import { scheduleImageCacheMaintenance } from '../lib/imageCacheMaintenance';
import { maintainShoppingPreviews } from '../lib/shoppingPreviews';

function handleAppStateChange(nextState: AppStateStatus, now = Date.now()): void {
  const {
    lastBackgroundTimestamp,
    currentSession,
    pauseVisit,
    setBackgroundTimestamp,
  } = useShoppingSessionStore.getState();

  if (nextState === 'background') {
    if (currentSession?.lifecycleStatus === 'active') pauseVisit(now);
    setBackgroundTimestamp(now);
    return;
  }

  if (nextState !== 'active' || lastBackgroundTimestamp === null) return;

  maintainShoppingPreviews(now);
  setBackgroundTimestamp(null);
}

/**
 * Maintains the active Shopping Mode store context across brief app switches,
 * and reconciles its wall-clock expiry whenever the app returns.
 *
 * Also the hook that owns "once per app start" housekeeping — currently the
 * image-cache size check, which is self-throttled to once a day.
 */
export function useAppStateListener(): void {
  useEffect(() => {
    // Reconcile persisted state on a cold launch as AppState may already be
    // active before the change listener is attached.
    handleAppStateChange(AppState.currentState);
    maintainShoppingPreviews();

    // Deferred until interactions settle — this walks the cache directory.
    scheduleImageCacheMaintenance();

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
}
