import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OutfitCollage } from '../outfits/OutfitCollage';
import { candidatePieces, DailyLookCandidateVisual } from './DailyLookCandidateVisual';
import type { LookPlatePagerHandle } from './LookPlatePager';
import { capitalizeFirst, candidateTitle, gapLabel, itemPhotoUri, sentenceCase } from './dailyLookCopy';
import { PressableScale } from '../primitives/PressableScale';
import { getSwatchColor } from '../../lib/colorUtils';
import { colors, editorial, radii, spacing, stroke, typography } from '../../theme';
import type { Outfit } from '../../types/outfit';
import type { Item } from '../../types/item';
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
  /** The plate the user was looking at on Home. */
  initialPage?: number;
  onPageChange?: (page: number) => void;
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

function sameSentence(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return norm(a) === norm(b);
}

/**
 * Today's Look, opened: an editorial page rather than a form. The plates lead,
 * then the stylist's case for the look, the missing piece as a short spec, and
 * the owned pieces as an index that drives the plates above.
 */
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
  initialPage = 0,
  onPageChange,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<LookPlatePagerHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(initialPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resync only when the sheet opens
  useEffect(() => { if (visible) setPage(initialPage); }, [visible]);
  if (!candidate) return null;

  const busy = saving || dismissing;
  const isReady = candidate.readinessStatus === 'ready';
  const isPriority = candidate.readinessStatus === 'priority';
  const gap = candidate.missingEssentials[0];
  const showPager = !isReady && !!gap;
  const plateWidth = width - spacing.page * 2;
  const plateHeight = Math.round(plateWidth / editorial.outfitAspectRatio);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const ownedPieces = showPager
    ? candidatePieces(candidate, items)
    : candidate.itemIds.map((entry) => ({ id: entry.id, category: entry.category.replaceAll('_', ' '), item: itemMap.get(entry.id) }));
  const pieceOffset = showPager && isPriority ? 1 : 0;
  const title = candidateTitle(candidate, gap);
  const eyebrow = isReady ? 'Styled for you today' : isPriority ? 'Highest-impact gap' : 'One piece away';
  const reason = capitalizeFirst(candidate.reason);
  const notes = candidate.stylistNotes && !sameSentence(candidate.stylistNotes, candidate.reason)
    ? capitalizeFirst(candidate.stylistNotes)
    : null;
  const specs = gap
    ? ([['Formality', gap.formality], ['Silhouette', gap.silhouette], ['Material', gap.material]] as [string, string | undefined][])
      .filter((entry): entry is [string, string] => !!entry[1])
    : [];

  const handlePieceRow = (position: number) => {
    if (!showPager) return;
    pagerRef.current?.scrollToIndex(position + pieceOffset);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{isPriority ? 'Today’s Priority' : 'Today’s Look'}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
              accessibilityRole="button"
              accessibilityLabel="Close daily look details"
            >
              <Ionicons name="close" size={18} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {showPager && gap ? (
            <DailyLookCandidateVisual
              ref={pagerRef}
              candidate={candidate}
              gap={gap}
              items={items}
              width={plateWidth}
              height={plateHeight}
              borderRadius={radii.photo}
              initialIndex={initialPage}
              onIndexChange={(next) => { setPage(next); onPageChange?.(next); }}
              onFindPiece={onFindPiece}
            />
          ) : (
            <OutfitCollage
              outfit={previewOutfit(candidate)}
              size={plateWidth}
              height={plateHeight}
              borderRadius={radii.photo}
            />
          )}

          <View style={styles.story}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.standfirst}>{reason}</Text>
            {notes ? <Text style={styles.notes}>{notes}</Text> : null}
          </View>

          {!isReady && gap ? (
            <View style={styles.section} accessible accessibilityLabel={`The missing piece: ${gapLabel(gap.label)}. ${gap.context}`}>
              <Text style={styles.sectionLabel}>The missing piece</Text>
              {sameSentence(title, gap.label) ? null : <Text style={styles.pieceTitle}>{sentenceCase(gap.label)}</Text>}
              {gap.context ? <Text style={[styles.pieceContext, sameSentence(title, gap.label) && styles.pieceContextLead]}>{capitalizeFirst(gap.context)}</Text> : null}
              <View style={styles.specList}>
                {specs.map(([name, value]) => (
                  <View key={name} style={styles.specRow}>
                    <Text style={styles.specName}>{name}</Text>
                    <Text style={styles.specValue}>{capitalizeFirst(gapLabel(value))}</Text>
                  </View>
                ))}
                {gap.preferredColors && gap.preferredColors.length > 0 ? (
                  <View style={styles.specRow}>
                    <Text style={styles.specName}>Colours</Text>
                    <View style={styles.swatches}>
                      {gap.preferredColors.slice(0, 4).map((color) => (
                        <View key={color} style={styles.swatchItem}>
                          <View style={[styles.swatch, { backgroundColor: getSwatchColor(color.toLowerCase()).primary }]} />
                          <Text style={styles.specValue}>{capitalizeFirst(color)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {ownedPieces.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{isReady ? 'The pieces' : 'From your closet'}</Text>
              {ownedPieces.map((piece, position) => {
                const uri = itemPhotoUri(piece.item, { thumb: true });
                const active = showPager && page === position + pieceOffset;
                return (
                  <Pressable
                    key={piece.id}
                    onPress={() => handlePieceRow(position)}
                    disabled={!showPager}
                    style={({ pressed }) => [styles.pieceRow, pressed && styles.pieceRowPressed]}
                    accessibilityRole={showPager ? 'button' : undefined}
                    accessibilityLabel={`${piece.item?.name ?? 'Wardrobe piece'}, ${piece.category}`}
                    accessibilityHint={showPager ? 'Shows this piece above' : undefined}
                  >
                    <View style={[styles.thumb, active && styles.thumbActive]}>
                      {uri ? (
                        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                      ) : (
                        <Ionicons name="shirt-outline" size={18} color={colors.mutedForeground} />
                      )}
                    </View>
                    <View style={styles.pieceText}>
                      <Text style={styles.pieceCategory}>{piece.category}</Text>
                      <Text style={styles.pieceName} numberOfLines={2}>{piece.item?.name ?? 'Wardrobe piece'}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {isReady ? (
            <PressableScale
              contentStyle={styles.primary}
              onPress={onSave}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Save look"
            >
              <Ionicons name="bookmark-outline" size={17} color={colors.primaryForeground} />
              <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save look'}</Text>
            </PressableScale>
          ) : gap ? (
            <PressableScale
              contentStyle={styles.primary}
              onPress={onFindPiece}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Find a ${gapLabel(gap.label)}, suggested and not in your closet`}
            >
              <Ionicons name="bag-outline" size={17} color={colors.primaryForeground} />
              <Text style={styles.primaryText} numberOfLines={1}>Find a {gapLabel(gap.label).toLowerCase()}</Text>
            </PressableScale>
          ) : null}
          <Pressable
            onPress={onDismiss}
            disabled={busy}
            hitSlop={8}
            style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
            accessibilityRole="button"
            accessibilityLabel="Not for me"
          >
            <Text style={styles.dismissText}>{dismissing ? 'Updating…' : 'Not for me'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.page, paddingTop: spacing.sm, paddingBottom: spacing.md },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.ghostStroke,
    marginBottom: spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { ...typography.text.editorialSection, color: colors.foreground },
  close: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.fine,
    borderColor: colors.ghostStroke,
  },
  closePressed: { backgroundColor: colors.surfaceSubtle },
  content: { paddingHorizontal: spacing.page, paddingBottom: spacing.xxxl },
  story: { paddingTop: spacing.xl, gap: spacing.xs },
  eyebrow: { ...typography.text.masthead, color: colors.accentInk, marginBottom: 2 },
  title: { ...typography.text.editorialTitle, color: colors.foreground },
  standfirst: { ...typography.text.editorialItalic, color: colors.inkSubtle, marginTop: spacing.xs },
  notes: { ...typography.text.bodySmall, color: colors.foreground, marginTop: spacing.sm },
  section: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sectionLabel: { ...typography.text.masthead, color: colors.mutedForeground, marginBottom: spacing.md },
  pieceTitle: { ...typography.text.editorialCard, color: colors.foreground },
  pieceContext: { ...typography.text.bodySmall, color: colors.inkSubtle, marginTop: spacing.xs },
  pieceContextLead: { ...typography.text.editorialItalic, color: colors.foreground, marginTop: 0 },
  specList: { marginTop: spacing.md },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  specName: { ...typography.text.caption, color: colors.mutedForeground, width: 88 },
  specValue: { ...typography.text.bodySmall, color: colors.foreground },
  swatches: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs, paddingVertical: spacing.sm },
  swatchItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ghostStroke,
  },
  pieceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  pieceRowPressed: { opacity: 0.6 },
  thumb: {
    width: 56,
    height: 70,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: stroke.fine,
    borderColor: 'transparent',
  },
  thumbActive: { borderColor: colors.foreground },
  pieceText: { flex: 1, gap: 2 },
  pieceCategory: { ...typography.text.masthead, fontSize: 10, color: colors.mutedForeground },
  pieceName: { ...typography.text.editorialCard, fontSize: 17, lineHeight: 22, color: colors.foreground },
  footer: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  primary: {
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  primaryText: { ...typography.text.label, color: colors.primaryForeground },
  dismiss: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  dismissPressed: { opacity: 0.5 },
  dismissText: { ...typography.text.meta, color: colors.mutedForeground },
});
