import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { OutfitCollage } from '../outfits/OutfitCollage';
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
    aiGeneratedImageUrl: candidate.aiGeneratedImageUrl,
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
}: Props) {
  const { width } = useWindowDimensions();
  if (!candidate) return null;
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const outfit = previewOutfit(candidate);
  const busy = saving || dismissing;
  const imageSize = Math.min(width - spacing.lg * 2, 380);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Today’s Look</Text>
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
          <OutfitCollage outfit={outfit} size={imageSize} height={Math.round(imageSize * 1.28)} borderRadius={radii.lg} />
          <Text style={styles.eyebrow}>Styled for you today</Text>
          <Text style={styles.title}>{candidate.name}</Text>
          <Text style={styles.reason}>{candidate.reason}</Text>
          {candidate.stylistNotes ? <Text style={styles.notes}>{candidate.stylistNotes}</Text> : null}

          <View style={styles.pieces}>
            {candidate.itemIds.map((entry) => {
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
  headerTitle: { fontFamily: typography.family.display, fontSize: typography.size.xl, color: colors.foreground },
  content: { alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.xxxl },
  eyebrow: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    color: colors.primary,
    fontSize: 10,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: { alignSelf: 'stretch', marginTop: 2, fontFamily: typography.family.display, fontSize: typography.size.xxl, color: colors.foreground },
  reason: { alignSelf: 'stretch', marginTop: spacing.xs, color: colors.mutedForeground, fontSize: typography.size.sm },
  notes: { alignSelf: 'stretch', marginTop: spacing.md, color: colors.foreground, fontSize: typography.size.sm, lineHeight: 21 },
  pieces: { alignSelf: 'stretch', marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pieceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pieceDot: { width: 6, height: 6, borderRadius: 3, marginRight: spacing.sm, backgroundColor: colors.primary },
  pieceName: { flex: 1, color: colors.foreground, fontSize: typography.size.sm },
  pieceCategory: { color: colors.mutedForeground, fontSize: typography.size.xs, textTransform: 'capitalize' },
  actions: { alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.sm },
  saveButton: { minHeight: 48, borderRadius: radii.full, backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  saveButtonText: { color: colors.primaryForeground, fontWeight: typography.weight.semibold, fontSize: typography.size.sm },
  dismissButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  dismissButtonText: { color: colors.mutedForeground, fontSize: typography.size.sm },
});
