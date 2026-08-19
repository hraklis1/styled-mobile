import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../primitives/PressableScale';
import { WishlistOutfitPreview } from './WishlistOutfitPreview';
import { colors, radii, spacing, typography } from '../../theme';
import type { WishlistEntry } from '../../lib/wishlist';

/**
 * A saved look at history scale: two of these sit in the width the full
 * summary card used to take, which is the point — on Shop they are the last
 * thing on the page, not the first.
 */
export function SavedLookTile({ entry, onPress }: { entry: WishlistEntry; onPress: () => void }) {
  const { outfit, eventContext } = entry;
  const context = eventContext?.title ?? outfit.city?.trim();
  const itemCount = `${outfit.items.length} ${outfit.items.length === 1 ? 'item' : 'items'}`;

  return (
    <PressableScale
      scaleTo={0.98}
      // Width is layout, so it belongs on the outer pressable; the inner view
      // that scales stretches to fill it.
      style={styles.tileLayout}
      contentStyle={styles.tile}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[outfit.intro, itemCount, outfit.totalBudget, context].filter(Boolean).join(', ')}
      accessibilityHint="Opens outfit details"
    >
      <WishlistOutfitPreview entry={entry} style={styles.preview} />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{outfit.intro}</Text>
        {context ? (
          <View style={styles.contextRow}>
            <Ionicons
              name={eventContext ? 'calendar-outline' : 'location-outline'}
              size={11}
              color={colors.mutedForeground}
            />
            <Text style={styles.context} numberOfLines={1}>{context}</Text>
          </View>
        ) : null}
        <Text style={styles.meta} numberOfLines={1}>
          {[outfit.totalBudget, itemCount].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tileLayout: { width: '48%' },
  tile: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  // Square rather than the usual 4:5 outfit crop: at history scale the moodboard
  // only needs to be recognisable, and two rows of portraits would dominate the
  // page they are meant to close.
  preview: { width: '100%', aspectRatio: 1 },
  copy: { gap: 2, paddingHorizontal: 2, paddingBottom: spacing.xs },
  title: {
    fontSize: typography.text.bodySmall.fontSize,
    lineHeight: 18,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  context: { flex: 1, fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  meta: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
});
