import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'scanReview.batchLayout';

/** How a multi-photo review lays out: grouped under each photo, or the contact sheet. */
export type BatchReviewLayout = 'sections' | 'grid';

export async function loadBatchReviewLayout(): Promise<BatchReviewLayout> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'grid' ? 'grid' : 'sections';
  } catch {
    return 'sections';
  }
}

export async function saveBatchReviewLayout(layout: BatchReviewLayout): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, layout);
  } catch {
    // Losing the choice only means the default layout returns.
  }
}
