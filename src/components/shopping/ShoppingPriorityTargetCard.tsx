import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '../primitives/PressableScale';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import type { Item } from '../../types/item';

type Props = {
  target: ShoppingPriorityTarget;
  index: number;
  wardrobe: ReadonlyMap<number, Item>;
  expanded: boolean;
  onToggle: () => void;
};

export function ShoppingPriorityTargetCard({ target, index, wardrobe, expanded, onToggle }: Props) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    progress.value = expanded ? 1 : 0;
  }, [expanded, progress]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(progress.value ? '180deg' : '0deg', { duration: reduceMotion ? 0 : 180 }) }],
  }));
  const transition = reduceMotion ? undefined : LinearTransition.duration(180);
  const pairs = target.pairsWithItemIds.map((id) => wardrobe.get(id));
  const previewPairs = pairs.slice(0, 3);

  return (
    <Animated.View layout={transition} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.indexBadge}><Text style={styles.indexText}>{String(index).padStart(2, '0')}</Text></View>
        <Text selectable style={styles.title}>{target.title}</Text>
      </View>

      <Text selectable style={styles.rationale}>{target.rationale}</Text>

      <View style={styles.quickFacts}>
        <QuickFact value={target.color} />
        <QuickFact value={target.material} />
        <QuickFact value={target.priceRange} />
      </View>

      <View style={styles.wardrobePreview}>
        <View style={styles.thumbStack}>
          {previewPairs.map((item, previewIndex) => (
            <View key={target.pairsWithItemIds[previewIndex]} style={[styles.stackedThumb, previewIndex > 0 && styles.stackedThumbOffset]}>
              <WardrobeThumbnail item={item} size={44} />
            </View>
          ))}
        </View>
        <Text style={styles.wardrobePreviewText}>Works with {target.pairsWithItemIds.length} {target.pairsWithItemIds.length === 1 ? 'piece' : 'pieces'}</Text>
      </View>

      <PressableScale
        contentStyle={styles.disclosure}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Hide' : 'View'} details for ${target.title}`}
        accessibilityState={{ expanded }}
      >
        <Text style={styles.disclosureText}>{expanded ? 'Hide details' : 'View details'}</Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={17} color={colors.mutedForeground} />
        </Animated.View>
      </PressableScale>

      {expanded ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(150)}
          exiting={reduceMotion ? undefined : FadeOut.duration(100)}
          layout={transition}
          style={styles.details}
        >
          <Meta label="Silhouette" value={target.silhouette} wide />
          <View style={styles.metaGrid}>
            <Meta label="Color" value={target.color} />
            <Meta label="Material" value={target.material} />
            <Meta label="Price band" value={target.priceRange} />
          </View>
          <Text selectable style={styles.retailers}>Where to look: {target.retailerExamples.join(' · ')}</Text>
          {target.unlocks.length > 0 ? <Text selectable style={styles.unlocks}>Unlocks {target.unlocks.join(' · ')}</Text> : null}

          <View style={styles.pairsSection}>
            <Text style={styles.pairsLabel}>Pairs from your wardrobe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pairsRail}>
              {pairs.map((item, pairIndex) => (
                <WardrobePair key={target.pairsWithItemIds[pairIndex]} item={item} />
              ))}
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function QuickFact({ value }: { value: string }) {
  return <View style={styles.quickFact}><Text selectable style={styles.quickFactText}>{value}</Text></View>;
}

function Meta({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.metaCell, wide && styles.metaCellWide]}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text selectable style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function WardrobePair({ item }: { item?: Item }) {
  return (
    <View style={styles.pair}>
      <WardrobeThumbnail item={item} size={76} />
      <Text selectable style={styles.pairName} numberOfLines={2}>{item?.name ?? 'Wardrobe piece'}</Text>
    </View>
  );
}

function WardrobeThumbnail({ item, size }: { item?: Item; size: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const uri = item ? itemImageUri(item) : undefined;

  return (
    <View style={[styles.thumbnail, { width: size, height: size, borderRadius: size >= 60 ? radii.md : radii.sm }]}>
      {uri && !imageFailed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={itemImageContentFit(item)}
          transition={150}
          onError={() => setImageFailed(true)}
        />
      ) : <Ionicons name="shirt-outline" size={size >= 60 ? 20 : 16} color={colors.mutedForeground} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    boxShadow: '0 2px 7px rgba(40, 35, 31, 0.045)',
  },
  cardHeader: { gap: spacing.sm },
  indexBadge: { width: 30, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm, backgroundColor: colors.secondary },
  indexText: { fontSize: 11, fontWeight: typography.weight.bold, color: colors.primary, fontVariant: ['tabular-nums'] },
  title: { fontFamily: typography.family.display, ...typography.display.sm, color: colors.foreground },
  rationale: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  quickFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  quickFact: { maxWidth: '100%', paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
  quickFactText: { fontSize: 11, lineHeight: 15, fontWeight: typography.weight.medium, color: colors.inkSubtle },
  wardrobePreview: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumbStack: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.sm },
  stackedThumb: { overflow: 'hidden', borderWidth: 2, borderColor: colors.surfaceElevated },
  stackedThumbOffset: { marginLeft: -14 },
  thumbnail: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle },
  wardrobePreviewText: { flex: 1, fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.inkSubtle },
  disclosure: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  disclosureText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },
  details: { gap: spacing.md, paddingTop: spacing.xs },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metaCell: { width: '46%', gap: 3 },
  metaCellWide: { width: '100%' },
  metaLabel: { ...typography.eyebrow, color: colors.mutedForeground },
  metaValue: { fontSize: typography.size.sm, lineHeight: 20, color: colors.foreground },
  retailers: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  unlocks: { fontSize: typography.size.sm, lineHeight: 20, color: colors.primary },
  pairsSection: { gap: spacing.sm, paddingTop: spacing.xs },
  pairsLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  pairsRail: { gap: spacing.sm, paddingBottom: 2 },
  pair: { width: 76, gap: spacing.xs },
  pairName: { fontSize: 10, lineHeight: 14, color: colors.mutedForeground },
});
