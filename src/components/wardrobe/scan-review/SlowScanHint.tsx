import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../../theme';
import { TextLink } from './atoms';

/** After this long a scan says so, and offers to carry on without the user watching where it can. */
export const SLOW_SCAN_MS = 8_000;

/** True once `key` has stayed the same for `ms`; resets when it changes. */
export function useSlowFlag(key: string | null, ms: number = SLOW_SCAN_MS): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!key) return;
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return slow;
}

/**
 * The footer line under a scan hero, shared by the closet scan and the
 * outfit log. Once the scan runs long it says so and, where the work can
 * carry on in the background, offers that; until then it shows `children`.
 */
export function SlowScanHint({ watchKey, background, children }: {
  /** The step being waited on; the timer restarts when it changes. Null stops it. */
  watchKey: string | null;
  background?: { label?: string; onPress: () => void };
  children?: ReactNode;
}) {
  const slow = useSlowFlag(watchKey);
  if (!slow) return <>{children ?? null}</>;
  return (
    <View style={styles.slow} accessibilityLiveRegion="polite">
      <Text style={styles.slowText}>Taking longer than usual</Text>
      {background ? <TextLink label={background.label ?? 'Keep going in the background'} onPress={background.onPress} /> : null}
    </View>
  );
}


const styles = StyleSheet.create({
  slow: { alignItems: 'center' },
  slowText: { ...typography.text.meta, color: colors.mutedForeground },
});
