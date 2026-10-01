import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { getSwatchColor } from '../../lib/colorUtils';
import { colors, ingestion, radii, spacing, stroke, surfaces, typography } from '../../theme';
import type { DailyLookMissingEssential } from '../../hooks/useDailyLook';
import type { Item } from '../../types/item';
import { gapLabel, gapOccasion, itemPhotoUri, sentenceCase } from './dailyLookCopy';

export type LookPlatePiece = { id: number; category: string; item: Item | undefined };

export type LookPlatePagerHandle = { scrollToIndex: (index: number, animated?: boolean) => void };

type Props = {
  pieces: LookPlatePiece[];
  gap?: DailyLookMissingEssential;
  /** Priority looks lead with the missing piece; one-piece-away looks end on it. */
  gapFirst?: boolean;
  width: number;
  /** Total height: hero plus dock. */
  height: number;
  borderRadius?: number;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Tap on a garment hero. */
  onPressPiece?: () => void;
  /** Tap on the missing-piece hero. */
  onPressGap?: () => void;
};

type Page = { kind: 'piece'; piece: LookPlatePiece } | { kind: 'gap'; gap: DailyLookMissingEssential };

const THUMB_W = 52;
const THUMB_H = 64;
/** Dock = thumbnails, their category line, and padding above and below. */
export const LOOK_DOCK_HEIGHT = THUMB_H + 46;


/**
 * Hero + dock. One piece is shown large — users' photos are crops with their
 * own grounds, so they are never set side by side at size — and the whole
 * look stays visible beneath it as a dock of small thumbnails. Tapping a
 * thumbnail crossfades it into the hero. The missing piece sits in the dock
 * as a stitched slot and becomes a typographic plate when chosen.
 */
export const LookPlatePager = forwardRef<LookPlatePagerHandle, Props>(function LookPlatePager({
  pieces, gap, gapFirst = false, width, height, borderRadius = 0, initialIndex = 0, onIndexChange, onPressPiece, onPressGap,
}, ref) {
  const ownedPages: Page[] = pieces.map((piece) => ({ kind: 'piece', piece }));
  const pages: Page[] = gap
    ? gapFirst ? [{ kind: 'gap', gap }, ...ownedPages] : [...ownedPages, { kind: 'gap', gap }]
    : ownedPages;
  const count = pages.length;
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, count - 1)));

  const heroRef = useRef<ScrollView>(null);
  const indexRef = useRef(index);
  // Only the first offset: a prop that tracked `index` would re-apply mid-animation and overshoot.
  const initialOffset = useRef({ x: index * width, y: 0 }).current;

  const commit = (next: number) => {
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
    onIndexChange?.(next);
  };
  /** Dock taps (and the sheet's piece rows) glide the hero to that piece. */
  const select = (next: number) => {
    const clamped = Math.max(0, Math.min(count - 1, next));
    heroRef.current?.scrollTo({ x: clamped * width, animated: true });
    commit(clamped);
  };
  useImperativeHandle(ref, () => ({ scrollToIndex: select }));

  const heroHeight = height - LOOK_DOCK_HEIGHT;
  const keyOf = (page: Page) => (page.kind === 'gap' ? 'gap' : String(page.piece.id));
  const labelOf = (page: Page) => (page.kind === 'gap'
    ? `Suggested ${gapLabel(page.gap.label)}, not in your closet`
    : `${page.piece.category}, ${page.piece.item?.name ?? 'wardrobe piece'}`);

  return (
    <View style={[styles.root, { width, height, borderRadius }]}>
      {/* The hero swipes between pieces; the dock below follows. */}
      <ScrollView
        ref={heroRef}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        scrollEnabled={count > 1}
        style={{ width, height: heroHeight, flexGrow: 0 }}
        contentOffset={initialOffset}
        // contentOffset can land before a presenting modal settles; snap once laid out.
        onLayout={() => heroRef.current?.scrollTo({ x: indexRef.current * width, animated: false })}
        onMomentumScrollEnd={(event) => commit(Math.round(event.nativeEvent.contentOffset.x / width))}
      >
        {pages.map((page) => (
          <Pressable
            key={keyOf(page)}
            style={{ width, height: heroHeight }}
            onPress={page.kind === 'gap' ? onPressGap : onPressPiece}
            accessibilityRole="button"
            accessibilityLabel={`${labelOf(page)}. Open`}
          >
            {page.kind === 'gap' ? <GapPlate gap={page.gap} /> : <PiecePlate piece={page.piece} />}
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.dock}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.dockRow, { minWidth: width }]}
        >
          {pages.map((page, position) => {
            const active = position === index;
            const uri = page.kind === 'piece' ? itemPhotoUri(page.piece.item, { thumb: true }) : undefined;
            return (
              <Pressable
                key={keyOf(page)}
                onPress={() => select(position)}
                hitSlop={4}
                style={styles.dockItem}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={labelOf(page)}
                accessibilityHint="Shows this piece above"
              >
                <View style={[styles.thumbRing, active && styles.thumbRingActive]}>
                  <View style={[styles.thumb, page.kind === 'gap' && styles.thumbGap]}>
                    {page.kind === 'gap' ? (
                      <Ionicons name="add" size={18} color={colors.accentInk} />
                    ) : uri ? (
                      <>
                        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={`${page.piece.id}-thumb`} />
                        {/* A paper wash: studio shots on pure white and raw photo crops settle onto one ground. */}
                        <View style={styles.thumbWash} pointerEvents="none" />
                      </>
                    ) : (
                      <Ionicons name="shirt-outline" size={18} color={colors.mutedForeground} />
                    )}
                  </View>
                </View>
                <Text
                  style={[styles.dockLabel, active && styles.dockLabelActive, page.kind === 'gap' && styles.dockLabelGap]}
                  numberOfLines={1}
                >
                  {page.kind === 'gap' ? 'Add' : page.piece.category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
});

function PiecePlate({ piece }: { piece: LookPlatePiece }) {
  const uri = itemPhotoUri(piece.item);
  if (!uri) {
    return (
      <View style={styles.emptyPiece}>
        <Ionicons name="shirt-outline" size={28} color={colors.mutedForeground} />
        <Text style={styles.emptyPieceName}>{piece.item?.name ?? 'Wardrobe piece'}</Text>
      </View>
    );
  }
  return (
    <View style={styles.piece}>
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { opacity: ingestion.matte.opacity }]}
        contentFit="cover"
        blurRadius={ingestion.matte.blurRadius}
        cachePolicy="memory-disk"
        recyclingKey={`${piece.id}-matte`}
        accessible={false}
      />
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={`${piece.id}-photo`}
        transition={180}
        accessible={false}
      />
      {piece.item?.name ? (
        // A gallery label, so a tight crop still says which piece it is.
        <View style={styles.tag} pointerEvents="none">
          <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.tagWash} />
          <Text style={styles.tagName} numberOfLines={1}>{piece.item.name}</Text>
        </View>
      ) : null}
    </View>
  );
}

function GapPlate({ gap }: { gap: DailyLookMissingEssential }) {
  const occasion = gapOccasion(gap);
  const swatches = (gap.preferredColors ?? []).slice(0, 4);
  return (
    <View style={styles.gapGround}>
      <View style={styles.gapFrame}>
        <View style={styles.gapGlyph}>
          <Ionicons name="add" size={20} color={colors.accentInk} />
        </View>
        <Text style={styles.gapMasthead}>Not in your closet</Text>
        <Text style={styles.gapTitle} numberOfLines={2}>{sentenceCase(gap.label)}</Text>
        {occasion ? <Text style={styles.gapOccasion} numberOfLines={3}>{occasion}</Text> : null}
        {swatches.length > 0 ? (
          <View style={styles.swatchRow}>
            {swatches.map((name) => (
              <View key={name} style={styles.swatchItem}>
                <View style={[styles.swatch, { backgroundColor: getSwatchColor(name.toLowerCase()).primary }]} />
                <Text style={styles.swatchName}>{name}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.gapCue}>
          <Text style={styles.gapCueText}>See styles</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.foreground} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: surfaces.plate },
  dock: {
    height: LOOK_DOCK_HEIGHT,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dockRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.page, paddingTop: 14 },
  dockItem: { width: THUMB_W, alignItems: 'center', gap: 6 },
  // The ring is always laid out, so selecting a piece never shifts the dock.
  thumbRing: {
    width: THUMB_W,
    height: THUMB_H,
    padding: 2,
    borderRadius: radii.sm + 3,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  thumbRingActive: {
    borderColor: colors.inkSubtle,
    backgroundColor: colors.background,
    shadowColor: '#1F1A16',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    transform: [{ translateY: -2 }],
  },
  thumb: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: surfaces.plate,
  },
  thumbWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: surfaces.plate,
    opacity: 0.18,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(31,26,22,0.08)',
  },
  thumbGap: {
    borderWidth: stroke.fine,
    borderStyle: 'dashed',
    borderColor: colors.stitch,
  },
  dockLabel: { ...typography.text.masthead, fontSize: 9, letterSpacing: 1.2, color: colors.mutedForeground },
  dockLabelActive: { color: colors.foreground },
  dockLabelGap: { color: colors.accentInk },
  piece: { flex: 1, backgroundColor: surfaces.plate },
  // A frosted pill with tracked micro-caps, set like a lookbook credit.
  tag: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    maxWidth: '70%',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  tagWash: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(250,248,244,0.5)' },
  tagName: {
    ...typography.text.masthead,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 1.8,
    color: colors.foreground,
  },
  emptyPiece: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: surfaces.plate,
  },
  emptyPieceName: { ...typography.text.editorialItalic, color: colors.mutedForeground },
  gapGround: { flex: 1, padding: spacing.lg, backgroundColor: surfaces.plate },
  gapFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    borderRadius: radii.photo,
    borderWidth: stroke.fine,
    borderStyle: 'dashed',
    borderColor: colors.stitch,
  },
  gapGlyph: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: stroke.fine,
    borderColor: colors.ghostStroke,
    marginBottom: spacing.sm,
  },
  gapMasthead: { ...typography.text.masthead, color: colors.accentInk },
  gapTitle: { ...typography.text.editorialTitle, color: colors.foreground },
  gapOccasion: { ...typography.text.editorialItalic, color: colors.inkSubtle },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  swatchItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ghostStroke,
  },
  swatchName: { ...typography.text.caption, color: colors.mutedForeground },
  gapCue: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg },
  gapCueText: { ...typography.text.label, color: colors.foreground },
});
