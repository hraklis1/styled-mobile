import { StyleSheet, Text, View } from 'react-native';
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
};

/**
 * Home's only shortlist surface: shown when store finds are still waiting on a
 * decision, absent once they are settled. Home stays about today, so this is a
 * status line — Shop carries the pieces themselves, in `ShortlistCarousel`.
 */
export function ShortlistDecisionCard({ items, storeNames, onPress, style }: Props) {
  if (items.length === 0) return null;

  const thumbs = items.slice(0, THUMB_LIMIT);
  const subtitle = storeNames.length > 0 ? storeNames.join(' · ') : 'From your shopping trips';

  return (
    <PressableScale
      style={style}
      contentStyle={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`The shortlist. ${items.length} piece${items.length === 1 ? '' : 's'} waiting on a decision. Opens your shortlist`}
    >
      <View style={styles.row}>
        <View style={[styles.stack, { width: 34 + (thumbs.length - 1) * 18 }]}>
          {thumbs.map((item, index) => (
            <View key={item.id} style={[styles.thumb, { left: index * 18, zIndex: THUMB_LIMIT - index }]}>
              <Image
                source={{ uri: item.primarySnap.imageUri }}
                style={StyleSheet.absoluteFill}
                contentFit={garmentFriendlyContentFit(item.primarySnap)}
                cachePolicy="memory-disk"
                recyclingKey={item.primarySnap.id}
                transition={180}
              />
            </View>
          ))}
        </View>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {items.length} {items.length === 1 ? 'piece' : 'pieces'} to decide on
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Ionicons name="arrow-forward" size={17} color={colors.primary} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // The flat tint block Home uses for every non-image container. Its
  // "The Shortlist" label lives on the section header above it, not inside.
  card: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stack: { height: 42 },
  thumb: {
    position: 'absolute',
    top: 0,
    width: 34,
    height: 42,
    overflow: 'hidden',
    borderRadius: radii.sm,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: colors.surfaceSubtle,
    backgroundColor: colors.muted,
  },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.text.cardTitle, color: colors.foreground },
  subtitle: { ...typography.text.caption, color: colors.mutedForeground },
});
