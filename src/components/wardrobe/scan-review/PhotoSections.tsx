import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { groupPiecesByPhoto, type PhotoGroup } from '../../../lib/scan-review';
import { colors, radii, spacing, typography } from '../../../theme';
import { MarkedPhoto, type PhotoMark } from './MarkedPhoto';
import { PieceRow } from './PieceRow';
import { TextLink } from './atoms';
import type { ScanReviewPiece } from './types';

const STRIP_THUMB = 40;

/** How tall a section's photo stands: a map for its rows, not the task. */
export function sectionPhotoHeight(screenHeight: number) {
  return Math.max(170, Math.min(240, Math.round(screenHeight * 0.24)));
}

/**
 * A batch's review: the single scan's photo-led review once per photo. Each
 * section is that photo with its numbered markers, then one row per piece.
 * Numbers restart in each photo, so a section reads exactly like a single
 * scan. A strip of the photos jumps between sections.
 */
export function PhotoSections({ blurb, progress, pieces, numbers, duplicateIds, noteFor, isPolished, activeId, disabled, reduceMotion, bottomPadding, onActivate, onClearActive, onOpen, onToggleIncluded, onBrand, onAddPiece }: {
  blurb: string;
  /** 0–1 while details are read in place: a hairline under the strip. */
  progress?: number;
  pieces: ScanReviewPiece[];
  /** Each piece's marker number within its photo. */
  numbers: ReadonlyMap<string, number>;
  duplicateIds?: ReadonlySet<string>;
  noteFor: (piece: ScanReviewPiece) => string | null;
  isPolished?: (id: string) => boolean;
  activeId: string | null;
  disabled: boolean;
  reduceMotion: boolean;
  bottomPadding: number;
  onActivate: (id: string) => void;
  onClearActive?: () => void;
  onOpen: (id: string) => void;
  onToggleIncluded: (id: string) => void;
  onBrand?: (id: string) => void;
  onAddPiece?: () => void;
}) {
  const { height } = useWindowDimensions();
  const photoHeight = sectionPhotoHeight(height);
  const groups = useMemo(() => groupPiecesByPhoto(pieces), [pieces]);
  const scroll = useRef<ScrollView>(null);
  const sectionTops = useRef(new Map<number, number>());
  const rowTops = useRef(new Map<string, number>());
  const [current, setCurrent] = useState(1);

  const scrollTo = (y: number) => scroll.current?.scrollTo({ y: Math.max(0, y), animated: !reduceMotion });
  const jumpTo = (photoIndex: number) => {
    setCurrent(photoIndex);
    scrollTo((sectionTops.current.get(photoIndex) ?? 0) - spacing.sm);
  };
  const reveal = (photoIndex: number, id: string) => {
    onActivate(id);
    const sectionTop = sectionTops.current.get(photoIndex);
    const rowTop = rowTops.current.get(id);
    if (sectionTop === undefined || rowTop === undefined) return;
    scrollTo(sectionTop + rowTop - photoHeight * 0.6);
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y + photoHeight * 0.5;
    let next = 1;
    for (const [index, top] of sectionTops.current) if (top <= y && index > next) next = index;
    if (next !== current) setCurrent(next);
  };

  return (
    <View style={styles.root}>
      {groups.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
          {groups.map(group => (
            <Pressable
              key={group.photoIndex}
              onPress={() => jumpTo(group.photoIndex)}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${group.photoIndex} of ${groups.length}`}
              accessibilityState={{ selected: group.photoIndex === current }}
              style={[styles.stripFrame, group.photoIndex === current && styles.stripFrameActive]}
            >
              {group.source ? <Image source={{ uri: group.source }} style={styles.stripImage} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.stripImage} />}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {progress !== undefined ? (
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
          <View style={[styles.fill, { width: `${Math.round(Math.max(0.04, progress) * 100)}%` }]} />
        </View>
      ) : null}

      <ScrollView
        ref={scroll}
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        onScroll={onScroll}
        scrollEventThrottle={64}
      >
        <Text style={styles.blurb}>{blurb}</Text>
        {groups.map(group => (
          <View key={group.photoIndex} onLayout={event => sectionTops.current.set(group.photoIndex, event.nativeEvent.layout.y)}>
            <PhotoSection
              group={group}
              total={groups.length}
              photoHeight={photoHeight}
              numbers={numbers}
              duplicateIds={duplicateIds}
              noteFor={noteFor}
              isPolished={isPolished}
              activeId={activeId}
              disabled={disabled}
              reduceMotion={reduceMotion}
              rowTops={rowTops.current}
              onMarkerPress={id => reveal(group.photoIndex, id)}
              onClearActive={onClearActive}
              onActivate={onActivate}
              onOpen={onOpen}
              onToggleIncluded={onToggleIncluded}
              onBrand={onBrand}
            />
          </View>
        ))}
        {onAddPiece ? (
          <View style={styles.add}>
            <TextLink label="Missing a piece? Add one" tone="muted" onPress={onAddPiece} disabled={disabled} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function PhotoSection({ group, total, photoHeight, numbers, duplicateIds, noteFor, isPolished, activeId, disabled, reduceMotion, rowTops, onMarkerPress, onClearActive, onActivate, onOpen, onToggleIncluded, onBrand }: {
  group: PhotoGroup<ScanReviewPiece>;
  total: number;
  photoHeight: number;
  numbers: ReadonlyMap<string, number>;
  duplicateIds?: ReadonlySet<string>;
  noteFor: (piece: ScanReviewPiece) => string | null;
  isPolished?: (id: string) => boolean;
  activeId: string | null;
  disabled: boolean;
  reduceMotion: boolean;
  /** Row offsets within the section, shared with the list for marker jumps. */
  rowTops: Map<string, number>;
  onMarkerPress: (id: string) => void;
  onClearActive?: () => void;
  onActivate: (id: string) => void;
  onOpen: (id: string) => void;
  onToggleIncluded: (id: string) => void;
  onBrand?: (id: string) => void;
}) {
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { height } = useWindowDimensions();
  const main = group.pieces.filter(piece => !duplicateIds?.has(piece.id));
  const duplicates = group.pieces.filter(piece => duplicateIds?.has(piece.id));
  const included = group.pieces.filter(piece => piece.included !== false).length;
  const hidden = showDuplicates ? undefined : duplicateIds;
  const marks = useMemo<PhotoMark[]>(() => group.pieces.filter(piece => !hidden?.has(piece.id)).map((piece, index) => ({
    id: piece.id, box: piece.cropBbox, label: piece.name, number: numbers.get(piece.id) ?? index + 1, off: piece.included === false,
  })), [group.pieces, hidden, numbers]);
  const mainTop = useRef(0);
  const duplicatesTop = useRef(0);

  const rows = (list: ScanReviewPiece[], duplicate: boolean) => list.map((piece, index) => (
    <View key={piece.id} onLayout={event => rowTops.set(piece.id, (duplicate ? duplicatesTop.current : mainTop.current) + event.nativeEvent.layout.y)}>
      {index > 0 ? <View style={styles.rule} /> : null}
      <PieceRow
        piece={piece}
        number={numbers.get(piece.id) ?? index + 1}
        active={piece.id === activeId}
        polished={isPolished?.(piece.id) ?? false}
        note={duplicate ? (piece.included === false ? 'Possible duplicate · Not selected' : 'Possible duplicate') : noteFor(piece)}
        disabled={disabled}
        reduceMotion={reduceMotion}
        onOpen={() => onOpen(piece.id)}
        onToggle={() => onToggleIncluded(piece.id)}
        onBrand={onBrand && !duplicate ? () => onBrand(piece.id) : undefined}
      />
    </View>
  ));

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.eyebrow}>{total > 1 ? `Photo ${group.photoIndex} of ${total}` : 'Your photo'}</Text>
        <Text style={styles.count}>{included === group.pieces.length ? pieceLabel(included) : `${included} of ${pieceLabel(group.pieces.length)}`}</Text>
      </View>

      {group.source ? (
        <View>
          <MarkedPhoto
            source={group.source}
            marks={marks}
            activeId={activeId && group.pieces.some(piece => piece.id === activeId) ? activeId : null}
            height={expanded ? Math.round(height * 0.55) : photoHeight}
            onMarkerPress={onMarkerPress}
            onPhotoPress={activeId ? onClearActive : () => setExpanded(open => !open)}
          />
          <Pressable
            style={styles.expand}
            onPress={() => setExpanded(open => !open)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Shrink photo' : 'Enlarge photo'}
          >
            <Ionicons name={expanded ? 'contract-outline' : 'expand-outline'} size={14} color={colors.foreground} />
          </Pressable>
        </View>
      ) : null}

      <View onLayout={event => { mainTop.current = event.nativeEvent.layout.y; }}>
        {rows(main, false)}
      </View>

      {duplicates.length > 0 ? (
        <View style={styles.group} onLayout={event => { duplicatesTop.current = event.nativeEvent.layout.y + 48; }}>
          <Pressable
            style={({ pressed }) => [styles.groupHeader, pressed && styles.pressed]}
            onPress={() => setShowDuplicates(open => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDuplicates }}
          >
            <Text style={styles.groupTitle}>{duplicates.length === 1 ? '1 possible duplicate' : `${duplicates.length} possible duplicates`}</Text>
            <Ionicons name={showDuplicates ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </Pressable>
          {showDuplicates ? rows(duplicates, true) : null}
        </View>
      ) : null}
    </View>
  );
}

const pieceLabel = (count: number) => (count === 1 ? '1 piece' : `${count} pieces`);

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.xl },
  blurb: { ...typography.text.bodySmall, color: colors.mutedForeground },
  strip: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  stripContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  stripFrame: { borderRadius: radii.photo, borderWidth: 1.5, borderColor: 'transparent', padding: 2, opacity: 0.55 },
  stripFrameActive: { borderColor: colors.foreground, opacity: 1 },
  stripImage: { width: STRIP_THUMB, height: STRIP_THUMB, borderRadius: radii.photo - 3, backgroundColor: colors.muted },
  track: { height: 2, backgroundColor: colors.hairline },
  fill: { height: 2, backgroundColor: colors.foreground },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  eyebrow: { ...typography.text.masthead, color: colors.foreground },
  count: { ...typography.text.meta, color: colors.mutedForeground },
  expand: {
    position: 'absolute', right: spacing.sm, bottom: spacing.sm, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.85)',
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: spacing.sm + 16 + spacing.md },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  groupHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  groupTitle: { ...typography.text.bodySmall, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  pressed: { opacity: 0.6 },
  add: { alignItems: 'center' },
});
