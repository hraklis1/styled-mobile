import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'scanReview.cropTip.dismissed';

/**
 * Whether the "tap a piece to fix its crop" tip on the choose-pieces grid has
 * been put away — by its close mark, or by opening a piece, which shows the
 * tip has done its job.
 */
export async function isCropTipDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function dismissCropTip(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Losing the flag only means the tip shows once more.
  }
}

export async function resetCropTip(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
