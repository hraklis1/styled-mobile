import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShoppingEditCard } from '../../components/shopping/ShoppingEditCard';
import { ShoppingItemLightbox } from '../../components/shopping/ShoppingItemLightbox';
import { useShoppingSnaps } from '../../hooks/useShoppingSnaps';
import { buildShoppingEditItems, mergeShoppingSnaps, type ShoppingEditItem } from '../../lib/shoppingGallery';
import { formatShoppingPrice } from '../../lib/shoppingPresentation';
import { buildShoppingSessionGroups, shoppingSessionHighlights } from '../../lib/shoppingSessionGroups';
import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { colors, spacing, typography } from '../../theme';
import type { ShoppingHaulDetailScreenProps } from '../../navigation/types';

export function ShoppingHaulDetailScreen({ route, navigation }: ShoppingHaulDetailScreenProps) {
  const { groupKey } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [lightboxItem, setLightboxItem] = useState<ShoppingEditItem | null>(null);

  const { data: remoteSnaps = [] } = useShoppingSnaps();
  const pendingUploads = useShoppingSessionStore((state) => state.pendingUploads);
  // Unfiltered on purpose — the immersive gallery shows the whole haul
  // regardless of whatever store/date filters are active back on the list.
  const allItems = useMemo(
    () => buildShoppingEditItems(mergeShoppingSnaps(remoteSnaps, pendingUploads)),
    [pendingUploads, remoteSnaps],
  );
  const groups = useMemo(() => buildShoppingSessionGroups(allItems), [allItems]);
  const group = groups.find((candidate) => candidate.key === groupKey);

  const cardWidth = (width - spacing.lg * 2 - spacing.sm) / 2;
  const rows = useMemo(() => {
    if (!group) return [];
    return group.items.reduce<ShoppingEditItem[][]>((accumulated, item, index) => {
      if (index % 2 === 0) accumulated.push([item]);
      else accumulated[accumulated.length - 1].push(item);
      return accumulated;
    }, []);
  }, [group]);

  if (!group) {
    // The haul was deleted or fully re-filed out from under this screen.
    navigation.goBack();
    return null;
  }

  const spend = formatShoppingPrice(group.knownSpend);
  const highlights = shoppingSessionHighlights(group);

  return (
    <View style={styles.screen}>
      <Animated.View sharedTransitionTag={`haul-card-${group.key}`} style={styles.hero}>
        <View style={[styles.heroInner, { paddingTop: insets.top + 56 }]}>
          <Text style={styles.heroDate}>{group.dateLabel}</Text>
          {group.storeName ? <Text style={styles.heroStore}>{group.storeName}</Text> : null}
          {group.placeLabel ? <Text style={styles.heroPlace}>{group.placeLabel}</Text> : null}
          <View style={styles.heroStatsRow}>
            <Text style={styles.heroStats}>
              {group.itemCount} item{group.itemCount === 1 ? '' : 's'} · {group.photoCount} photo{group.photoCount === 1 ? '' : 's'}
            </Text>
            {spend ? <Text style={styles.heroSpend}>{spend}</Text> : null}
          </View>
          {highlights.length > 0 ? (
            <Text style={styles.heroHighlights} numberOfLines={2}>{highlights.join(' · ')}</Text>
          ) : null}
        </View>
      </Animated.View>

      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + spacing.sm }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <Animated.ScrollView
        entering={FadeIn.duration(220).delay(80)}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row) => (
          <View key={row.map((item) => item.id).join(':')} style={styles.gridRow}>
            {row.map((item) => (
              <ShoppingEditCard
                key={item.id}
                item={item}
                width={cardWidth}
                isSelected={false}
                selectionMode={false}
                showStore={false}
                onPress={() => setLightboxItem(item)}
                onLongPress={() => {}}
              />
            ))}
            {row.length === 1 ? <View style={{ width: cardWidth }} /> : null}
          </View>
        ))}
      </Animated.ScrollView>

      {lightboxItem ? (
        <ShoppingItemLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  heroInner: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 2 },
  heroDate: { fontFamily: typography.family.display, fontSize: typography.size.xxl, color: colors.foreground },
  heroStore: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.primary },
  heroPlace: { fontSize: typography.size.sm, color: colors.mutedForeground },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  heroStats: { fontSize: typography.size.sm, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  heroSpend: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.foreground, fontVariant: ['tabular-nums'] },
  heroHighlights: { marginTop: spacing.xs, fontSize: typography.size.xs, color: colors.mutedForeground },
  backButton: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(251, 250, 247, 0.88)',
    boxShadow: '0 2px 8px rgba(40, 35, 31, 0.12)',
  },
  grid: { gap: spacing.sm, padding: spacing.lg },
  gridRow: { flexDirection: 'row', gap: spacing.sm },
});
