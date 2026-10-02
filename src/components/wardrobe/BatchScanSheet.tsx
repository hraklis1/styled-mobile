import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryLaunchMany } from '../../hooks/useCameraLaunch';
import { colors, spacing, typography, radii } from '../../theme';
import { useStartBatch } from '../../features/batch-import/useStartBatch';

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
  const { startBatch, scanCost, balance } = useStartBatch();
  const launchLibraryMany = useLibraryLaunchMany();

  useEffect(() => {
    bottomSheetRef.current?.present();
  }, []);

  const pickPhotos = async () => {
    // Full quality in; downscaling to the working sizes happens on device
    // in the queue's prepare step, once per photo.
    const assets = await launchLibraryMany({ limit: MAX_PHOTOS });
    const batchId = await startBatch(assets);
    if (!batchId) return;
    onStarted?.(batchId);
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
