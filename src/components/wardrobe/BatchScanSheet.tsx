import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { useEntitlement } from '../../hooks/useEntitlement';
import { presentPaywall } from '../../lib/paywall';
import { track } from '../../lib/analytics';
import { colors, spacing, typography, radii } from '../../theme';
import { useBatchImportStore } from '../../features/batch-import/store';
import { createBatch } from '../../features/batch-import/steps';
import { batchCost } from '../../features/batch-import/cost';

export const MAX_PHOTOS = 10;

interface BatchScanSheetProps {
  onClose: () => void;
  /** Called with the new batch's id once photos are handed to the queue. */
  onStarted?: (batchId: string) => void;
}

/**
 * The batch-import picker. It only chooses photos and checks they can be
 * paid for; the work itself runs in the background queue
 * (features/batch-import), tracked by the tray and reviewed in
 * BatchImportWorkspace, so this sheet closes the moment photos are picked.
 */
export function BatchScanSheet({ onClose, onStarted }: BatchScanSheetProps) {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['48%'], []);
  const { user } = useAuth();
  const { costOf, credits } = useEntitlement();
  const scanCost = costOf('scan');
  const balance = credits?.total ?? null;

  useEffect(() => {
    bottomSheetRef.current?.present();
  }, []);

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

  const pickPhotos = async () => {
    if (!user) return;
    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (status === 'denied') {
      showLibraryDeniedAlert();
      return;
    }
    if (status !== 'granted') {
      const { status: req } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (req !== 'granted') {
        showLibraryDeniedAlert();
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: MAX_PHOTOS,
      // Full quality in; downscaling to the working sizes happens on device
      // in the queue's prepare step, once per photo.
      quality: 1,
      exif: false,
    });
    if (result.canceled || !result.assets.length) return;

    const count = await confirmAffordable(result.assets.length);
    if (count === 0) return;

    const batch = createBatch(user.id, result.assets.slice(0, count));
    useBatchImportStore.getState().start(batch);
    track('closet_batch_started', {
      photo_count: batch.photos.length,
      duplicate_count: count - batch.photos.length,
    });
    onStarted?.(batch.id);
    bottomSheetRef.current?.dismiss();
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.sheetBackground}
      enablePanDownToClose
    >
      <BottomSheetView style={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="images-outline" size={18} color={colors.primary} />
            <Text style={styles.headerTitle}>Batch Import</Text>
          </View>
          <TouchableOpacity
            onPress={() => bottomSheetRef.current?.dismiss()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Select up to {MAX_PHOTOS} photos. We&apos;ll find every piece and read its details in the
            background. Follow the progress here, or minimize to keep using the app.
          </Text>
          <TouchableOpacity style={styles.pickBtn} onPress={pickPhotos} activeOpacity={0.85} accessibilityRole="button">
            <Ionicons name="images-outline" size={22} color={colors.primaryForeground} />
            <Text style={styles.pickBtnText}>Select Photos</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            {scanCost > 0
              ? `${scanCost} credits per photo${balance != null ? ` · you have ${balance}` : ''}`
              : 'Tip: use outfit photos or flat-lays for best results.'}
          </Text>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function showLibraryDeniedAlert() {
  Alert.alert(
    'Photo library access needed',
    'Styled needs photo library access to batch scan items. Enable it in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
        },
      },
    ],
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.background,
  },
  handle: {
    backgroundColor: colors.border,
    width: 36,
  },
  body: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: {
    fontSize: typography.text.sectionTitle.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  subtitle: {
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    lineHeight: typography.text.bodySmall.fontSize * 1.6,
    textAlign: 'center',
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  pickBtnText: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  hint: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
