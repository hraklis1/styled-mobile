import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { LineSheetFrames } from '../outfits/LineSheetFrames';
import { itemCoverPresentation } from '../../lib/itemImage';
import { colors, radii, spacing, stroke, typography } from '../../theme';
import type { DailyLookCandidate, DailyLookMissingEssential } from '../../hooks/useDailyLook';
import type { Item } from '../../types/item';

type Props = {
  candidate: DailyLookCandidate;
  gap: DailyLookMissingEssential;
  items: Item[];
  width: number;
  height: number;
  borderRadius?: number;
  /** Makes the suggestion strip its own target (Home); the sheet has its own CTA. */
  onFindPiece?: () => void;
};

function label(value: string): string {
  return value.replaceAll('_', ' ').trim();
}

export function DailyLookCandidateVisual({ candidate, gap, items, width, height, borderRadius = radii.lg, onFindPiece }: Props) {
  const itemMap = new Map(items.map((item) => [item.id, item]));

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

  const stripHeight = 72;
  return (
    <View
      style={[styles.incompleteBoard, { width, height, borderRadius }]}
      accessible={!onFindPiece}
      accessibilityLabel={`${candidate.name}. ${candidate.foundationItemIds.length} pieces in your closet. Suggested ${label(gap.label)}, not in your closet.`}
    >
      <LineSheetFrames
        items={candidate.foundationItemIds.map((entry) => itemMap.get(entry.id))}
        width={width}
        height={height - stripHeight}
      />
      <Pressable
        style={({ pressed }) => [styles.strip, { height: stripHeight }, pressed && onFindPiece ? styles.stripPressed : null]}
        onPress={onFindPiece}
        disabled={!onFindPiece}
        accessibilityRole={onFindPiece ? 'button' : undefined}
        accessibilityLabel={onFindPiece ? `Find ${label(gap.label)}, not in your closet` : undefined}
      >
        <View style={styles.stripIcon}>
          <Ionicons name="add" size={20} color={colors.primary} />
        </View>
        <View style={styles.stripText}>
          <Text style={styles.gapEyebrow}>COMPLETE THE LOOK</Text>
          <Text style={styles.gapTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {sentenceCase(label(gap.label))}
          </Text>
        </View>
        <View style={styles.notOwnedTag}>
          <Text style={styles.notOwned}>Not owned</Text>
        </View>
        {onFindPiece ? <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} /> : null}
      </Pressable>
    </View>
  );
}

function sentenceCase(value: string): string {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const styles = StyleSheet.create({
  incompleteBoard: {
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stripPressed: { backgroundColor: colors.muted },
  stripIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.fine,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  stripText: { flex: 1, gap: 2 },
  notOwnedTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  gapEyebrow: {
    ...typography.text.eyebrow,
    color: colors.primary,
  },
  gapTitle: {
    ...typography.text.sectionTitle,
    color: colors.foreground,
  },
  notOwned: {
    ...typography.text.caption,
    color: colors.mutedForeground,
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
    ...typography.text.eyebrow,
    color: colors.primary,
  },
  priorityTitle: {
    ...typography.text.editorialTitle,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  priorityContext: {
    ...typography.text.bodySmall,
    color: colors.inkSubtle,
  },
  anchorSection: { width: '100%', paddingTop: spacing.md, gap: spacing.sm },
  anchorLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
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
