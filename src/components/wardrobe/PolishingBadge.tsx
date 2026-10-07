import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePolishPending } from '../../features/polish-queue/store';
import { colors, radii, spacing } from '../../theme';

/**
 * Marks a closet tile whose polished cover is still being made, so the swap
 * from crop to catalog shot doesn't arrive unannounced.
 */
export function PolishingBadge({ itemId, size = 'card' }: { itemId: number; size?: 'card' | 'thumb' }) {
  const pending = usePolishPending(itemId);
  if (!pending) return null;
  return (
    <View
      style={[styles.badge, size === 'thumb' ? styles.thumb : styles.card]}
      accessible
      accessibilityLabel="Polishing"
    >
      <Ionicons name="sparkles" size={size === 'thumb' ? 10 : 12} color={colors.foreground} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    width: 21,
    height: 21,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,252,247,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { top: spacing.sm, left: spacing.sm },
  thumb: { top: 3, left: 3, width: 18, height: 18 },
});
