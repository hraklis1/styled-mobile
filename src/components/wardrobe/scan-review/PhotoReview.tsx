import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, typography } from '../../../theme';
import { MarkedPhoto } from './MarkedPhoto';
import { PieceRow } from './PieceRow';
import { TextLink } from './atoms';
import type { ScanReviewPiece } from './types';

/**
 * The photo-led review: the stylist's line, the photo with numbered markers,
 * then one compact row per piece. Marker numbers are fixed at detection, so
 * a number always names the same garment. Likely duplicates wait in a
 * collapsed group at the end, unselected, with their markers hidden until
 * the group is opened.
 */
export function PhotoReview({ source, blurb, pieces, numbers, duplicateIds, noteFor, isPolished, activeId, disabled, reduceMotion, bottomPadding, onActivate, onClearActive, onOpen, onToggleIncluded, onBrand, onAddPiece, compactPhoto = false }: {
  source: string;
  blurb: string;
  pieces: ScanReviewPiece[];
  /** Each piece's marker number. Fixed at detection, so a number names the same garment on every screen. */
  numbers: ReadonlyMap<string, number>;
  /** Pieces that likely repeat another; grouped and collapsed. */
  duplicateIds?: ReadonlySet<string>;
  noteFor: (piece: ScanReviewPiece) => string | null;
  /** Pieces that will get a polished cover. */
  isPolished?: (id: string) => boolean;
  activeId: string | null;
  disabled: boolean;
  reduceMotion: boolean;
  bottomPadding: number;
  onActivate: (id: string) => void;
  /** Clears the highlighted piece: a tap on the photo away from the markers. */
  onClearActive?: () => void;
  onOpen: (id: string) => void;
  onToggleIncluded: (id: string) => void;
  onBrand?: (id: string) => void;
  onAddPiece?: () => void;
  /** After extraction the photo is a map, not the task: it gives the list more room. */
  compactPhoto?: boolean;
}) {
  const { height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const rowTops = useRef(new Map<string, number>());
  const sectionTops = useRef({ main: 0, duplicates: 0 });
  const [showDuplicates, setShowDuplicates] = useState(false);
  // Enough photo to read the outfit, while the first rows still show on an SE.
  const photoHeight = compactPhoto
    ? Math.max(200, Math.min(300, Math.round(height * 0.3)))
    : Math.max(260, Math.min(420, Math.round(height * 0.42)));

  const main = useMemo(() => pieces.filter(piece => !duplicateIds?.has(piece.id)), [duplicateIds, pieces]);
  const duplicates = useMemo(() => pieces.filter(piece => duplicateIds?.has(piece.id)), [duplicateIds, pieces]);
  const hiddenIds = showDuplicates ? undefined : duplicateIds;

  const reveal = (id: string) => {
    onActivate(id);
    const top = rowTops.current.get(id);
    if (top === undefined) return;
    const base = duplicateIds?.has(id) ? sectionTops.current.duplicates : sectionTops.current.main;
    scroll.current?.scrollTo({ y: Math.max(0, base + top - photoHeight * 0.5), animated: !reduceMotion });
  };

  const rows = (list: ScanReviewPiece[], duplicate: boolean) => list.map((piece, index) => (
    <View key={piece.id} onLayout={event => rowTops.current.set(piece.id, event.nativeEvent.layout.y)}>
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
        // A likely repeat rarely needs a brand; its label gets the whole line instead.
        onBrand={onBrand && !duplicate ? () => onBrand(piece.id) : undefined}
      />
    </View>
  ));

  return (
    <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
      <Text style={styles.blurb}>{blurb}</Text>

      <MarkedPhoto source={source} pieces={pieces} numbers={numbers} hiddenIds={hiddenIds} activeId={activeId} height={photoHeight} onMarkerPress={reveal} onPhotoPress={activeId ? onClearActive : undefined} />

      <View onLayout={event => { sectionTops.current.main = event.nativeEvent.layout.y; }}>
        {rows(main, false)}
      </View>

      {duplicates.length > 0 ? (
        <View style={styles.group}>
          <Pressable
            style={({ pressed }) => [styles.groupHeader, pressed && styles.pressed]}
            onPress={() => setShowDuplicates(open => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDuplicates }}
            accessibilityHint={showDuplicates ? 'Hides them and their markers' : 'Shows them and their markers on the photo'}
          >
            <Text style={styles.groupTitle}>{duplicates.length === 1 ? '1 possible duplicate' : `${duplicates.length} possible duplicates`}</Text>
            <Ionicons name={showDuplicates ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </Pressable>
          {showDuplicates ? (
            <View onLayout={event => { sectionTops.current.duplicates = event.nativeEvent.layout.y; }}>
              {rows(duplicates, true)}
            </View>
          ) : null}
        </View>
      ) : null}

      {onAddPiece ? (
        <View style={styles.add}>
          <TextLink label="Missing a piece? Add one" tone="muted" onPress={onAddPiece} disabled={disabled} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.lg },
  blurb: { ...typography.text.bodySmall, color: colors.mutedForeground },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: spacing.sm + 16 + spacing.md },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  groupHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  groupTitle: { ...typography.text.bodySmall, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  pressed: { opacity: 0.6 },
  add: { alignItems: 'center' },
});
