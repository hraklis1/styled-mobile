import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { ResolvedOutfitCollage, type ResolvedOutfitSlot } from '../outfits/ResolvedOutfitCollage';
import { itemCoverPresentation } from '../../lib/itemImage';
import { colors, radii, spacing, typography } from '../../theme';
import type { DailyLookCandidate, DailyLookMissingEssential } from '../../hooks/useDailyLook';
import type { Item } from '../../types/item';

type Props = {
  candidate: DailyLookCandidate;
  gap: DailyLookMissingEssential;
  items: Item[];
  width: number;
  height: number;
  borderRadius?: number;
};

function ownedSlots(candidate: DailyLookCandidate, items: Item[]): ResolvedOutfitSlot[] {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return candidate.foundationItemIds.map((entry) => {
    const item = itemMap.get(entry.id);
    const cover = itemCoverPresentation(item);
    return { key: String(entry.id), uri: cover.uri, contentFit: cover.contentFit, ghost: !item };
  });
}

function label(value: string): string {
  return value.replaceAll('_', ' ').trim();
}

export function DailyLookCandidateVisual({ candidate, gap, items, width, height, borderRadius = radii.lg }: Props) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const slots = ownedSlots(candidate, items);

  if (candidate.readinessStatus === 'priority') {
    const anchors = candidate.foundationItemIds
      .map((entry) => itemMap.get(entry.id))
      .filter((item): item is Item => !!item)
      .slice(0, 4);
    return (
      <View
        style={[styles.priorityCard, { width, minHeight: height, borderRadius }]}
        accessible
        accessibilityLabel={`Today’s priority. Suggested ${label(gap.label)}, not in your closet. ${gap.context}`}
      >
        <View style={styles.priorityIcon}>
          <Ionicons name="sparkles-outline" size={24} color={colors.primary} />
        </View>
        <Text style={styles.suggestedLabel}>SUGGESTED · NOT IN YOUR CLOSET</Text>
        <Text style={styles.priorityTitle}>{label(gap.label)}</Text>
        <Text style={styles.priorityContext}>{gap.context}</Text>
        {anchors.length > 0 ? (
          <View style={styles.anchorSection}>
            <Text style={styles.anchorLabel}>WORKS WITH PIECES YOU OWN</Text>
            <View style={styles.anchorRow}>
              {anchors.map((item) => {
                const cover = itemCoverPresentation(item);
                return (
                  <View key={item.id} style={styles.anchorTile} accessible accessibilityLabel={`${item.name}, in your closet`}>
                    {cover.uri ? (
                      <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit={cover.contentFit} />
                    ) : (
                      <Ionicons name="shirt-outline" size={19} color={colors.mutedForeground} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  const gapWidth = Math.max(116, Math.round(width * 0.34));
  const ownedWidth = width - gapWidth;
  return (
    <View
      style={[styles.incompleteBoard, { width, height, borderRadius }]}
      accessible
      accessibilityLabel={`${candidate.name}. ${candidate.foundationItemIds.length} pieces in your closet. Suggested ${label(gap.label)}, not in your closet.`}
    >
      <ResolvedOutfitCollage slots={slots} size={ownedWidth} height={height} borderRadius={0} />
      <View style={[styles.gapTile, { width: gapWidth }]}>
        <View style={styles.gapIcon}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </View>
        <Text style={styles.gapEyebrow}>SUGGESTED</Text>
        <Text style={styles.gapTitle} numberOfLines={3}>{label(gap.label)}</Text>
        <Text style={styles.notOwned}>Not in your closet</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  incompleteBoard: {
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  gapTile: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.primary,
    borderStyle: 'dashed',
  },
  gapIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}18`,
  },
  gapEyebrow: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    letterSpacing: 1,
  },
  gapTitle: {
    color: colors.foreground,
    fontSize: typography.size.lg,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  notOwned: {
    color: colors.mutedForeground,
    fontSize: 10,
    textAlign: 'center',
  },
  priorityCard: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: spacing.xl,
    gap: spacing.sm,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  priorityIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}18`,
  },
  suggestedLabel: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    letterSpacing: 1,
  },
  priorityTitle: {
    color: colors.foreground,
    fontFamily: typography.family.display,
    fontSize: typography.size.xxl,
    textTransform: 'capitalize',
  },
  priorityContext: {
    color: colors.mutedForeground,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  anchorSection: { width: '100%', paddingTop: spacing.md, gap: spacing.sm },
  anchorLabel: { color: colors.mutedForeground, fontSize: 9, fontWeight: typography.weight.bold, letterSpacing: 0.8 },
  anchorRow: { flexDirection: 'row', gap: spacing.sm },
  anchorTile: {
    width: 54,
    height: 54,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
