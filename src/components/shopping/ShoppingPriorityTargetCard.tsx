import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  const pairingCount = target.pairsWithItemIds.length;

  return (
    <Animated.View layout={transition} style={styles.direction}>
      <View style={styles.headingRow}>
        <View style={styles.indexRail}>
          <Text style={styles.indexText}>Look</Text>
          <Text style={styles.indexNumber}>{String(index).padStart(2, '0')}</Text>
        </View>
        <View style={styles.headingCopy}>
          <Text selectable style={styles.title} numberOfLines={2}>{target.title}</Text>
          <Text selectable style={styles.rationale} numberOfLines={2}>{target.rationale}</Text>
        </View>
      </View>

      <View style={styles.metadataRow}>
        <QuickMeta label="Color" value={target.color} />
        <QuickMeta label="Material" value={target.material} />
        <QuickMeta label="Budget" value={target.priceRange} />
      </View>

      <PressableScale
        contentStyle={[styles.disclosure, expanded && styles.disclosureExpanded]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Hide' : 'View'} details for ${target.title}`}
        accessibilityState={{ expanded }}
      >
        <View style={styles.disclosureCopy}>
          <Text style={styles.disclosureText}>{expanded ? 'Hide details' : 'Details'}</Text>
          <Text style={styles.pairingCount}>{pairingCount} wardrobe {pairingCount === 1 ? 'pairing' : 'pairings'}</Text>
        </View>
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
          <Meta label="Silhouette" value={target.silhouette} />
          <Meta label="Where to look" value={target.retailerExamples.join(' · ')} />
          {target.unlocks.length > 0 ? <Text selectable style={styles.unlocks}>Unlocks {target.unlocks.join(' · ')}</Text> : null}

          <View style={styles.pairsSection}>
            <Text style={styles.pairsLabel}>Pairs from your wardrobe</Text>
            <View style={styles.pairsRow}>
              {pairs.map((item, pairIndex) => (
                <WardrobePair key={target.pairsWithItemIds[pairIndex]} item={item} />
              ))}
            </View>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text selectable style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function QuickMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.quickMeta}>
      <Text style={styles.quickMetaLabel}>{label}</Text>
      <Text selectable style={styles.quickMetaValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function WardrobePair({ item }: { item?: Item }) {
  return (
    <View style={styles.pair}>
      <WardrobeThumbnail item={item} />
      <Text selectable style={styles.pairName} numberOfLines={2}>{item?.name ?? 'Wardrobe piece'}</Text>
    </View>
  );
}

function WardrobeThumbnail({ item }: { item?: Item }) {
  const [imageFailed, setImageFailed] = useState(false);
  const uri = item ? itemImageUri(item) : undefined;

  return (
    <View style={styles.thumbnail}>
      {uri && !imageFailed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={itemImageContentFit(item)}
          transition={150}
          onError={() => setImageFailed(true)}
        />
      ) : <Ionicons name="shirt-outline" size={20} color={colors.mutedForeground} />}
    </View>
  );
}

const styles = StyleSheet.create({
  direction: {
    gap: spacing.md,
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  indexRail: { width: 42, alignItems: 'flex-start', paddingTop: 2 },
  indexText: { ...typography.eyebrow, color: colors.primary, fontVariant: ['tabular-nums'] },
  indexNumber: { fontFamily: typography.family.display, fontSize: 28, lineHeight: 33, color: colors.primary },
  headingCopy: { flex: 1, minWidth: 0, gap: spacing.sm },
  title: { fontFamily: typography.family.display, ...typography.display.sm, color: colors.foreground },
  rationale: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  metadataRow: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  quickMeta: { flex: 1, minWidth: 0, gap: 3, paddingVertical: spacing.sm, paddingRight: spacing.sm },
  quickMetaLabel: { ...typography.eyebrow, fontSize: 9, color: colors.mutedForeground },
  quickMetaValue: { fontSize: 11, lineHeight: 15, fontWeight: typography.weight.medium, color: colors.inkSubtle },
  disclosure: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderRadius: radii.md, borderCurve: 'continuous', backgroundColor: colors.surfaceSubtle },
  disclosureExpanded: { backgroundColor: colors.surfaceSelected },
  disclosureCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disclosureText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },
  pairingCount: { flexShrink: 1, fontSize: typography.size.xs, color: colors.mutedForeground },
  details: { gap: spacing.lg, padding: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.accent, borderRadius: radii.md, borderCurve: 'continuous', backgroundColor: colors.surfaceSubtle },
  metaCell: { gap: spacing.xs },
  metaLabel: { ...typography.eyebrow, color: colors.mutedForeground },
  metaValue: { fontSize: typography.size.sm, lineHeight: 20, color: colors.foreground },
  unlocks: { fontSize: typography.size.sm, lineHeight: 20, color: colors.primary },
  pairsSection: { gap: spacing.sm },
  pairsLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  pairsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  pair: { flex: 1, minWidth: 0, gap: spacing.xs },
  thumbnail: {
    width: '100%',
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSubtle,
  },
  pairName: { fontSize: 10, lineHeight: 14, color: colors.mutedForeground },
});
