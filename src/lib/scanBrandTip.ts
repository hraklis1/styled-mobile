import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'scanReview.brandTip.dismissed';

/**
 * Whether the "add brands before extracting" tip on the choose-pieces grid
 * has been put away. Each tile keeps its own "+ Brand" link either way; the
 * tip only explains why it is worth a tap.
 */
export async function isBrandTipDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function dismissBrandTip(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Losing the flag only means the tip shows once more.
  }
}
