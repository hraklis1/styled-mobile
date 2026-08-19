import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { OutfitCollage } from '../outfits/OutfitCollage';
import { DailyLookCandidateVisual } from './DailyLookCandidateVisual';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, spacing, typography } from '../../theme';
import type { Item } from '../../types/item';
import type { Outfit } from '../../types/outfit';
import type { DailyLookCandidate } from '../../hooks/useDailyLook';

type Props = {
  visible: boolean;
  candidate: DailyLookCandidate | null;
  items: Item[];
  saving?: boolean;
  dismissing?: boolean;
  onClose: () => void;
  onSave: () => void;
  onDismiss: () => void;
  onFindPiece: () => void;
};

function previewOutfit(candidate: DailyLookCandidate): Outfit {
  return {
    id: -candidate.id,
    userId: candidate.userId,
    name: candidate.name,
    description: candidate.stylistNotes,
    event: null,
    itemIds: candidate.itemIds,
    tags: [],
    notes: candidate.stylistNotes,
    isDraft: false,
    isFavorite: false,
    aiGeneratedImageUrl: candidate.readinessStatus === 'ready' ? candidate.aiGeneratedImageUrl : null,
    wearCount: 0,
    lastWornAt: null,
    createdAt: candidate.createdAt,
  };
}

export function DailyLookDetailSheet({
  visible,
  candidate,
  items,
  saving = false,
  dismissing = false,
  onClose,
  onSave,
  onDismiss,
  onFindPiece,
}: Props) {
  const { width } = useWindowDimensions();
  if (!candidate) return null;
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const outfit = previewOutfit(candidate);
  const busy = saving || dismissing;
  const imageSize = Math.min(width - spacing.lg * 2, 380);
  const isReady = candidate.readinessStatus === 'ready';
  const gap = candidate.missingEssentials[0];
  const ownedEntries = isReady ? candidate.itemIds : candidate.foundationItemIds;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{candidate.readinessStatus === 'priority' ? 'Today’s Priority' : 'Today’s Look'}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close daily look details"
          >
            <Ionicons name="close" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {isReady || !gap ? (
            <OutfitCollage outfit={outfit} size={imageSize} height={Math.round(imageSize * 1.28)} borderRadius={radii.lg} />
          ) : (
            <DailyLookCandidateVisual
              candidate={candidate}
              gap={gap}
              items={items}
              width={imageSize}
              height={Math.round(imageSize * (candidate.readinessStatus === 'priority' ? 0.9 : 1.12))}
            />
          )}
          <Text style={styles.eyebrow}>{isReady ? 'Styled for you today' : candidate.readinessStatus === 'incomplete' ? 'One piece away' : 'Highest-impact wardrobe gap'}</Text>
          <Text style={styles.title}>{candidate.name}</Text>
          <Text style={styles.reason}>{candidate.reason}</Text>
          {candidate.stylistNotes ? <Text style={styles.notes}>{candidate.stylistNotes}</Text> : null}

          {!isReady && gap ? (
            <View style={styles.gapBrief} accessible accessibilityLabel={`Suggested ${gap.label}, not in your closet. ${gap.context}`}>
              <Text style={styles.gapBriefLabel}>COMPLETE IT WITH</Text>
              <Text style={styles.gapBriefTitle}>{gap.label.replaceAll('_', ' ')}</Text>
              <Text style={styles.gapBriefContext}>{gap.context}</Text>
              {[gap.formality, gap.silhouette, gap.material, gap.preferredColors?.join(' · ')].filter(Boolean).length > 0 ? (
                <Text style={styles.gapBriefMeta}>
                  {[gap.formality, gap.silhouette, gap.material, gap.preferredColors?.join(' · ')].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.pieces}>
            {!isReady ? <Text style={styles.piecesLabel}>IN YOUR CLOSET</Text> : null}
            {ownedEntries.map((entry) => {
              const item = itemMap.get(entry.id);
              return (
                <View key={entry.id} style={styles.pieceRow}>
                  <View style={styles.pieceDot} />
                  <Text style={styles.pieceName}>{item?.name ?? 'Wardrobe piece'}</Text>
                  <Text style={styles.pieceCategory}>{entry.category.replace('_', ' ')}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.actions}>
            {isReady ? (
              <PressableScale
                contentStyle={styles.saveButton}
                onPress={onSave}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Save look"
              >
                <Ionicons name="bookmark-outline" size={17} color={colors.primaryForeground} />
                <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save look'}</Text>
              </PressableScale>
            ) : gap ? (
              <PressableScale
                contentStyle={styles.saveButton}
                onPress={onFindPiece}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Find ${gap.label}, suggested and not in your closet`}
              >
                <Ionicons name="search-outline" size={17} color={colors.primaryForeground} />
                <Text style={styles.saveButtonText}>Find {gap.label.replaceAll('_', ' ')}</Text>
              </PressableScale>
            ) : null}
            <PressableScale
              contentStyle={styles.dismissButton}
              onPress={onDismiss}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Not for me"
            >
              <Text style={styles.dismissButtonText}>{dismissing ? 'Updating…' : 'Not for me'}</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: typography.text.sheetTitle.fontSize, color: colors.foreground },
  content: { alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.xxxl },
  eyebrow: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    ...typography.text.eyebrow,
    color: colors.primary,
  },
  title: { alignSelf: 'stretch', marginTop: 2, ...typography.text.editorialTitle, color: colors.foreground },
  reason: { alignSelf: 'stretch', marginTop: spacing.xs, ...typography.text.bodySmall, color: colors.inkSubtle },
  notes: { alignSelf: 'stretch', marginTop: spacing.md, ...typography.text.bodySmall, color: colors.foreground },
  gapBrief: { alignSelf: 'stretch', marginTop: spacing.lg, padding: spacing.md, gap: spacing.xs, borderRadius: radii.md, backgroundColor: colors.card },
  gapBriefLabel: { ...typography.text.eyebrow, color: colors.primary },
  gapBriefTitle: { ...typography.text.sectionTitle, color: colors.foreground, textTransform: 'capitalize' },
  gapBriefContext: { ...typography.text.bodySmall, color: colors.foreground },
  gapBriefMeta: { ...typography.text.caption, color: colors.mutedForeground, textTransform: 'capitalize' },
  pieces: { alignSelf: 'stretch', marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  piecesLabel: { ...typography.text.eyebrow, color: colors.mutedForeground, paddingTop: spacing.sm },
  pieceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pieceDot: { width: 6, height: 6, borderRadius: 3, marginRight: spacing.sm, backgroundColor: colors.primary },
  pieceName: { flex: 1, color: colors.foreground, ...typography.text.bodySmall },
  pieceCategory: { ...typography.text.caption, color: colors.mutedForeground, textTransform: 'capitalize' },
  actions: { alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.sm },
  saveButton: { minHeight: 48, borderRadius: radii.full, backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  saveButtonText: { color: colors.primaryForeground, fontWeight: typography.weight.semibold, fontSize: typography.text.bodySmall.fontSize },
  dismissButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  dismissButtonText: { color: colors.mutedForeground, fontSize: typography.text.bodySmall.fontSize },
});
