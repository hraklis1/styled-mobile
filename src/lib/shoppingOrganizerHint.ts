import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'shopping.organizerHint.dismissed';

/**
 * Whether the organizer's gesture hint has been put away. The hold-to-select
 * and drag-to-regroup gestures have no visible affordance, so the hint is
 * shown until the shopper either dismisses it or performs one of them — at
 * which point it has done its job for good.
 */
export async function isOrganizerHintDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function dismissOrganizerHint(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Losing the flag only means the hint shows once more.
  }
}
