import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../primitives/PressableScale';
import { garmentFriendlyContentFit } from '../../lib/shoppingPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';

const THUMB_LIMIT = 3;

type Props = {
  items: ShoppingEditItem[];
  storeNames: string[];
  onPress: () => void;
  style?: object;
  /**
   * `card` — its own white surface. `row` — no surface of its own, for when
   * the host supplies one (Home's Wardrobe Edit).
   */
  variant?: 'card' | 'row';
  /** Shown above the row, inside the pressable, e.g. Home's destination kicker. */
  header?: ReactNode;
  /** Replaces the surface of the pressed content, for a host with its own card. */
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Home's only shortlist surface: shown when store finds are still waiting on a
 * decision, absent once they are settled. Home stays about today, so this is a
 * status line — Shop carries the pieces themselves, in `ShortlistCarousel`.
 */
export function ShortlistDecisionCard({ items, storeNames, onPress, style, variant = 'card', header, contentStyle }: Props) {
  if (items.length === 0) return null;

  const thumbs = items.slice(0, THUMB_LIMIT);
  const subtitle = storeNames.length > 0 ? storeNames.join(' · ') : 'From your shopping trips';

  return (
    <PressableScale
      style={style}
      contentStyle={contentStyle ?? (variant === 'row' ? undefined : styles.card)}
      scaleTo={variant === 'row' ? 0.99 : undefined}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Your shortlist. ${items.length} piece${items.length === 1 ? '' : 's'} waiting on a decision. Opens your shortlist in Shop`}
    >
      {header}
      <View style={[styles.row, variant === 'row' && styles.rowBare]}>
        <View style={[styles.stack, { width: 46 + (thumbs.length - 1) * 24 }]}>
          {thumbs.map((item, index) => (
            <View key={item.id} style={[styles.thumb, { left: index * 24, zIndex: THUMB_LIMIT - index }]}>
              <Image
                source={{ uri: item.primarySnap.imageUri }}
                style={StyleSheet.absoluteFill}
                contentFit={garmentFriendlyContentFit(item.primarySnap)}
                cachePolicy="memory-disk"
                recyclingKey={item.primarySnap.id}
                transition={180}
              />
              <View style={styles.thumbOutline} pointerEvents="none" />
            </View>
          ))}
        </View>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {items.length} {items.length === 1 ? 'piece' : 'pieces'} to decide on
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // A white card with no label of its own; a host can pass one as `header`.
  card: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceElevated,
  },
  row: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBare: { minHeight: 0, paddingHorizontal: 0, paddingVertical: spacing.lg },
  stack: { height: 58 },
  thumb: {
    position: 'absolute',
    top: 0,
    width: 46,
    height: 58,
    overflow: 'hidden',
    borderRadius: radii.sm,
    borderCurve: 'continuous',
    // The ring matches the card so each thumb cuts cleanly out of the one
    // behind it; the hairline keeps white product shots from merging.
    borderWidth: 1.5,
    borderColor: colors.surfaceElevated,
    backgroundColor: colors.surfaceElevated,
  },
  thumbOutline: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.sm - 1.5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.text.cardTitle, color: colors.foreground },
  subtitle: { ...typography.text.caption, color: colors.mutedForeground },
});
