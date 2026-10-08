import { useEffect } from 'react';
import { AppState, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { useScanDraftStore } from '../../features/scan-draft/store';
import { useBatchImportStore } from '../../features/batch-import/store';
import { confirmSheet } from '../primitives/ConfirmSheet';
import { FloatingTray } from '../primitives/FloatingTray';
import { colors, radii, spacing, typography } from '../../theme';

type Props = {
  /** The scan sheet is open, so the draft is on screen already. */
  hidden: boolean;
  onResume: () => void;
};

/**
 * An unfinished single-photo scan left behind by an app restart: a slim pill
 * above the tab bar so the user knows it exists before they tap Add.
 */
export function ScanDraftTray({ hidden, onResume }: Props) {
  const summary = useScanDraftStore((s) => s.summary);
  // One tray at a time; an active batch takes the slot.
  const batchActive = useBatchImportStore((s) => !!s.batch);

  // Re-read on foreground too, so a draft that ages past its limit drops out.
  useEffect(() => {
    void useScanDraftStore.getState().refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void useScanDraftStore.getState().refresh();
    });
    return () => sub.remove();
  }, []);

  if (!summary || hidden || batchActive) return null;

  const label = summary.count === 1 ? '1 piece waiting for review' : `${summary.count} pieces waiting for review`;
  const discard = () => confirmSheet({
    title: 'Discard unfinished scan?',
    message: 'These pieces haven’t been added to your closet yet.',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep',
    destructive: true,
    onConfirm: () => { void useScanDraftStore.getState().discard(); },
  });

  return (
    <FloatingTray
      title="Unfinished scan"
      detail={label}
      icon="shirt-outline"
      leading={summary.image ? <Image source={{ uri: summary.image }} style={styles.thumb} contentFit="cover" /> : undefined}
      trailing={<Text style={styles.resume}>Resume</Text>}
      accessory={{ icon: 'close', label: 'Discard unfinished scan', onPress: discard }}
      onPress={onResume}
      accessibilityLabel={`Unfinished scan. ${label}`}
      accessibilityHint="Resumes the scan"
    />
  );
}

const styles = StyleSheet.create({
  thumb: { width: 40, height: 40, borderRadius: radii.full },
  resume: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
    marginLeft: spacing.sm,
  },
});
