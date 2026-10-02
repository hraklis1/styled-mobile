import { useCallback } from 'react';
import { Alert } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';

import { useAuth } from '../../contexts/AuthContext';
import { useEntitlement } from '../../hooks/useEntitlement';
import { presentPaywall } from '../../lib/paywall';
import { track } from '../../lib/analytics';
import { useBatchImportStore } from './store';
import { createBatch } from './steps';
import { batchCost } from './cost';

/**
 * Hands picked photos to the background queue, first checking they can be
 * paid for. Resolves to the new batch's id, or null if nothing was started
 * (signed out, or the user backed out of the credits prompt).
 */
export function useStartBatch() {
  const { user } = useAuth();
  const { costOf, credits } = useEntitlement();
  const scanCost = costOf('scan');
  const balance = credits?.total ?? null;

  /** Resolve how many of `count` photos to scan, asking when credits fall short. */
  const confirmAffordable = useCallback(async (count: number): Promise<number> => {
    const { cost, affordable, sufficient } = batchCost(count, scanCost, balance);
    if (sufficient) return count;
    track('closet_batch_credits_short', { photo_count: count, cost, balance });
    return new Promise<number>((resolve) => {
      const buttons: Parameters<typeof Alert.alert>[2] = [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(0) },
        {
          text: 'Get credits',
          onPress: () => {
            void presentPaywall().then((purchased) => resolve(purchased ? count : 0));
          },
        },
      ];
      if (affordable > 0) {
        buttons.splice(1, 0, { text: `Scan first ${affordable}`, onPress: () => resolve(affordable) });
      }
      Alert.alert(
        'Not enough credits',
        `${count} photos use ${cost} credits and you have ${balance}.`,
        buttons,
      );
    });
  }, [balance, scanCost]);

  const startBatch = useCallback(async (assets: ImagePickerAsset[]): Promise<string | null> => {
    if (!user || !assets.length) return null;
    const count = await confirmAffordable(assets.length);
    if (count === 0) return null;

    const batch = createBatch(user.id, assets.slice(0, count));
    useBatchImportStore.getState().start(batch);
    track('closet_batch_started', {
      photo_count: batch.photos.length,
      duplicate_count: count - batch.photos.length,
    });
    return batch.id;
  }, [confirmAffordable, user]);

  return { startBatch, scanCost, balance };
}
