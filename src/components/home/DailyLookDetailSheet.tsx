import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyLookShoppingOptions } from './DailyLookShoppingOptions';
import { OutfitCollage } from '../outfits/OutfitCollage';
import { EditorialOutfitBoard } from '../outfits/EditorialOutfitBoard';
import { resolveBoardPieces } from '../outfits/editorialBoardLayout';
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
  mode?: 'look' | 'suggestion';
  sessionKey?: number;
  saving?: boolean;
  dismissing?: boolean;
  onClose: () => void;
  onSave: () => void;
  onDismiss: () => void;
  onFindPiece: () => void;
  onOpenItem: (id: number) => void;
  onSheetDismissed: () => void;
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

function containsSentence(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const fragment = norm(b);
  return !!fragment && norm(a).includes(fragment);
}

function sameSentence(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return norm(a) === norm(b);
}

/**
 * An editorial outfit board, followed by the stylist's context and wardrobe index.
 */
export function DailyLookDetailSheet({
  visible,
  candidate,
  items,
  mode = 'look',
  sessionKey = 0,
  saving = false,
  dismissing = false,
  onClose,
  onSave,
  onDismiss,
  onFindPiece,
  onOpenItem,
  onSheetDismissed,
}: Props) {
  const { width } = useWindowDimensions();
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [exploreRequest, setExploreRequest] = useState(0);
  const [shoppingAvailable, setShoppingAvailable] = useState(false);
  useEffect(() => { setShoppingOpen(false); setExploreRequest(0); setShoppingAvailable(false); }, [candidate?.id, sessionKey]);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const restoringScroll = useRef(false);
  useEffect(() => {
    scrollOffset.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [candidate?.id, sessionKey, mode]);
  useEffect(() => { if (!visible) restoringScroll.current = true; }, [visible]);
  const restoreScroll = () => {
    scrollRef.current?.scrollTo({ y: scrollOffset.current, animated: false });
    requestAnimationFrame(() => { restoringScroll.current = false; });
  };
  useEffect(() => {
    if (visible || Platform.OS === 'ios') return;
    const timer = setTimeout(onSheetDismissed, 350);
    return () => clearTimeout(timer);
  }, [visible, onSheetDismissed]);
  if (!candidate) return null;

  const busy = saving || dismissing;
  const isReady = candidate.readinessStatus === 'ready';
  const isPriority = candidate.readinessStatus === 'priority';
  const hasFlatLay = isReady && !!candidate.aiGeneratedImageUrl;
  const gap = candidate.missingEssentials[0];

  const plateWidth = width - spacing.page * 2;
  const plateHeight = Math.round(plateWidth / editorial.outfitAspectRatio);
  const ownedPieces = resolveBoardPieces(!isReady && gap ? candidate.foundationItemIds : candidate.itemIds, items);
  const isSuggestion = !hasFlatLay && !isReady && !!gap && mode === 'suggestion';
  const shoppingActive = isSuggestion || shoppingOpen;
  const title = isSuggestion && gap ? sentenceCase(gap.label) : candidateTitle(candidate, gap);
  const eyebrow = isSuggestion ? 'TO COMPLETE YOUR LOOK' : isReady ? 'Styled for you today' : 'Suggested addition';
  const reason = capitalizeFirst(candidate.reason);
  const notes = candidate.stylistNotes && !sameSentence(candidate.stylistNotes, candidate.reason)
    ? capitalizeFirst(candidate.stylistNotes)
    : null;
  const suggestionNotes = !isReady && gap && notes && containsSentence(notes, gap.label) ? notes : null;
  const specs = gap
    ? ([['Formality', gap.formality], ['Silhouette', gap.silhouette], ['Material', gap.material]] as [string, string | undefined][])
      .filter((entry): entry is [string, string] => !!entry[1])
    : [];

  const story = (
    <View style={[styles.story, isSuggestion && { paddingTop: 0 }]}>
      {isSuggestion || hasFlatLay ? <Text style={styles.standfirst}>{reason}</Text> : null}
      {notes && !isSuggestion && !suggestionNotes ? <Text style={styles.notes}>{notes}</Text> : null}
      {isSuggestion && gap?.context && !containsSentence(reason, gap.context)
        ? <Text style={styles.notes}>{capitalizeFirst(gap.context)}</Text> : null}
    </View>
  );
  const criteria = !isReady && gap && (!isSuggestion || specs.length > 0 || !!gap.preferredColors?.length) ? (
    <View style={[styles.section, isSuggestion && { paddingTop: 0, borderTopWidth: 0, marginTop: spacing.md }]}>
      {!isSuggestion ? <Text style={styles.sectionLabel}>Suggested addition</Text> : null}
      {!isSuggestion ? <Text style={styles.pieceTitle}>{sentenceCase(gap.label)}</Text> : null}
      {!isSuggestion && suggestionNotes ? <Text style={styles.pieceContext}>{suggestionNotes}</Text> : null}
      {!isSuggestion && gap.context && !containsSentence(suggestionNotes, gap.context) ? <Text style={styles.pieceContext}>{capitalizeFirst(gap.context)}</Text> : null}
      <View style={styles.specList}>
        {specs.map(([name, value]) => (
          <View key={name} style={styles.specRow}>
            <Text style={styles.specName}>{name}</Text>
            <Text style={[styles.specValue, { flex: 1, flexShrink: 1 }]}>{capitalizeFirst(gapLabel(value))}</Text>
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
  ) : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onDismiss={onSheetDismissed}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            {isSuggestion ? <View style={{ flex: 1 }} /> : <Text style={[styles.headerTitle, !hasFlatLay && { flex: 1, flexShrink: 1 }]}>{isPriority ? 'Today’s Priority' : 'Today’s Look'}</Text>}
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.close, isSuggestion && styles.quietClose, !hasFlatLay && { flexShrink: 0 }, pressed && styles.closePressed]}
              accessibilityRole="button"
              accessibilityLabel="Close daily look details"
            >
              <Ionicons name="close" size={18} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
          onScroll={(event) => { if (visible && !restoringScroll.current) scrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
          contentOffset={{ x: 0, y: scrollOffset.current }}
          onLayout={restoreScroll} onContentSizeChange={restoreScroll}>
          {isSuggestion || isReady ? <View style={{ gap: spacing.xs, paddingBottom: spacing.lg }}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
          </View> : null}
          {isSuggestion ? story : null}
          {isSuggestion ? criteria : null}
          {!isSuggestion && !hasFlatLay ? <Text style={[styles.standfirst, { marginBottom: spacing.sm }]}>{reason}</Text> : null}
          {!isSuggestion ? (
            hasFlatLay ? <OutfitCollage outfit={previewOutfit(candidate)} size={plateWidth} height={plateHeight} borderRadius={radii.photo} /> :
              <View style={{ paddingTop: spacing.lg }}>
                <EditorialOutfitBoard pieces={ownedPieces} width={plateWidth} onPressItem={onOpenItem} />
              </View>
          ) : null}
          {!isSuggestion && (hasFlatLay || (notes && !suggestionNotes)) ? story : null}
          {!isSuggestion ? criteria : null}

          {isSuggestion && ownedPieces.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>With your closet</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewCascade}>
                {ownedPieces.map((piece, index) => {
                  const uri = itemPhotoUri(piece.item, { thumb: true });
                  return <Pressable key={piece.id} disabled={!piece.item} onPress={() => onOpenItem(piece.id)}
                    style={({ pressed }) => [styles.previewTile, { marginLeft: index === 0 ? 0 : -10 }, pressed && styles.pieceRowPressed]}
                    accessibilityRole={piece.item ? 'button' : undefined}
                    accessibilityLabel={piece.item?.name ?? `${piece.category}, unavailable wardrobe piece`}
                    accessibilityHint={piece.item ? 'Open wardrobe item details' : undefined}>
                    <View style={styles.previewPhoto}>
                      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" /> : <Ionicons name="shirt-outline" size={20} color={colors.mutedForeground} />}
                    </View>
                  </Pressable>;
                })}
              </ScrollView>
            </View>
          ) : null}

          {isSuggestion && gap ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Complete your look</Text>
              <DailyLookShoppingOptions gap={gap} visible={visible} reason={reason} exploreRequest={exploreRequest} onAvailabilityChange={setShoppingAvailable} />
            </View>
          ) : null}

          {hasFlatLay && ownedPieces.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{isReady ? 'The pieces' : 'From your closet'}</Text>
              {ownedPieces.map((piece) => {
                const uri = itemPhotoUri(piece.item, { thumb: true });

                return (
                  <Pressable
                    key={piece.id}
                    onPress={() => onOpenItem(piece.id)}
                    disabled={!piece.item}
                    style={({ pressed }) => [styles.pieceRow, pressed && styles.pieceRowPressed]}
                    accessibilityRole={piece.item ? 'button' : undefined}
                    accessibilityLabel={`${piece.item?.name ?? 'Wardrobe piece'}, ${piece.category}`}
                    accessibilityHint={piece.item ? 'Open wardrobe item details' : undefined}
                  >
                    <View style={styles.thumb}>
                      {uri ? (
                        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" />
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
          {shoppingOpen && !isReady && !isSuggestion && gap ? <DailyLookShoppingOptions gap={gap} visible={visible} reason={reason} exploreRequest={exploreRequest} onAvailabilityChange={setShoppingAvailable} /> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {isReady ? (
            <PressableScale
              contentStyle={[styles.primary, !hasFlatLay && { paddingVertical: spacing.md }]}
              onPress={onSave}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Save look"
            >
              <Ionicons name="bookmark-outline" size={17} color={colors.primaryForeground} />
              <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save look'}</Text>
            </PressableScale>
          ) : gap && (!shoppingActive || shoppingAvailable) ? (
            <PressableScale
              contentStyle={[styles.primary, !hasFlatLay && { paddingVertical: spacing.md }]}
              onPress={() => shoppingActive ? setExploreRequest(value => value + 1) : setShoppingOpen(true)}
              disabled={busy || (shoppingActive && !shoppingAvailable)}
              accessibilityRole="button"
              accessibilityLabel={shoppingActive ? 'Explore all options' : `Find a ${gapLabel(gap.label)}, suggested and not in your closet`}
            >
              <Ionicons name="bag-outline" size={17} color={colors.primaryForeground} />
              <Text style={[styles.primaryText, !hasFlatLay && styles.primaryTextWrap]} numberOfLines={hasFlatLay ? 1 : undefined}>{shoppingActive ? 'Explore all options' : `Find a ${gapLabel(gap.label).toLowerCase()}`}</Text>
            </PressableScale>
          ) : null}
          <View style={isSuggestion ? styles.secondaryActions : undefined}>
          {shoppingActive && !isReady ? <Pressable onPress={onFindPiece} accessibilityRole="button" accessibilityLabel="Read styling notes" style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}><Text style={styles.dismissText}>Read styling notes</Text></Pressable> : null}
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
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.fine,
    borderColor: colors.ghostStroke,
  },
  quietClose: { borderWidth: 0 },
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
  previewCascade: { paddingVertical: spacing.xs },
  previewTile: { width: 92, height: 96 },
  previewPhoto: { flex: 1, backgroundColor: colors.surfaceSubtle, borderRadius: radii.sm, borderWidth: 2, borderColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  primaryTextWrap: { flexShrink: 1, textAlign: 'center' },
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
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: spacing.md },
  dismiss: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dismissPressed: { opacity: 0.5 },
  dismissText: { ...typography.text.meta, color: colors.mutedForeground },
});
