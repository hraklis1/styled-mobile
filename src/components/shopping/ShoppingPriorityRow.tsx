import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { isGenericOutfitClaim, priorityAnchorPieces, priorityOccasionLabel, withoutOutfitCount, worksWithLabel } from '../../lib/shopClarity';
import { shoppingPriorityGapNarrative } from '../../lib/shoppingPriorityEdit';
import { PressableScale } from '../primitives/PressableScale';
import { WardrobeThumbnail } from './WardrobeThumbnail';
import { colors, radii, shoppingSurfaces, spacing, typography } from '../../theme';
import type { ShoppingBriefPriority } from '../../lib/shopDecisionWorkspace';
import type { Item } from '../../types/item';

/** Frames in the "works with" strip. Three reads as a set; more is a closet. */
const ANCHOR_THUMBNAILS = 3;

/** Priority labels arrive lowercase ("formal trousers") but read as titles
 *  here and on the edit screen. */
export const sentenceCase = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);

/** Width of the numeral rail — the same 26pt ShoppingPriorityTargetCard uses,
 *  so the "01" on the brief and the "01" on the edit sit on one grid. */
export const PRIORITY_RAIL_WIDTH = 26;

type Props = {
  index: number;
  priority: ShoppingBriefPriority;
  /** Compact = the teaser on Shop's cover card: eyebrow, title and the
   *  works-with strip, no context, and optionally tappable when a selection
   *  callback is supplied. */
  compact?: boolean;
  onPress?: () => void;
  onSkip?: () => void;
  skipping?: boolean;
  isLast?: boolean;
  /** The wearable closet by id. When given, the row shows the owned pieces
   *  the suggestion was found against; without it the row is text only. */
  wardrobe?: ReadonlyMap<number, Item>;
};

/** "formal shirt or blouse to meet the dress code" → "To meet the dress code".
 *  Leaves the text alone when the label is not its opening. */
function stripLeadingLabel(text: string, normalizedLabel: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!normalizedLabel || !trimmed.toLocaleLowerCase().startsWith(normalizedLabel)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  const rest = trimmed.slice(normalizedLabel.length).replace(/^[\s,:—–-]+/, '');
  if (!rest) return '';
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Numbered editorial priority with independent navigation and skip actions. */
export function ShoppingPriorityRow({ index, priority, compact, onPress, onSkip, skipping, isLast, wardrobe }: Props) {
  const label = sentenceCase(priority.label);
  // The context often opens by restating the label ("Versatile mid-rise
  // trousers would create…") — under a title that already says it, that is
  // the same thought twice. Rather than dropping the sentence (which left
  // rows with nothing but a number), strip the restated label and let the
  // rest stand as the reason. Same guard the edit screen uses.
  const normalizedLabel = priority.label.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  // The narrative helper lifts "Step 1 of 2: <label>" bookkeeping out of the
  // sentence (it goes on the eyebrow instead), and a sentence reduced to the
  // bare "would create new outfits from pieces you already own" says less
  // than the works-with strip under it, so it is left out.
  const gap = shoppingPriorityGapNarrative(priority.label, priority.context ?? '', { impactScore: priority.impactScore });
  const sentence = !compact && gap.voice
    ? withoutOutfitCount(stripLeadingLabel(gap.voice, normalizedLabel), priority.impactScore)
    : '';
  const context = sentence && !isGenericOutfitClaim(sentence) ? sentence : null;
  const anchors = priorityAnchorPieces(priority, wardrobe);
  // The compact card holds one line beside the frames, so it names one
  // piece under a shorter lead and keeps the "+N" visible.
  const worksWith = compact ? worksWithLabel(anchors, 1, 'With your') : worksWithLabel(anchors);
  // The eyebrow says what the piece is for before the title says what it is.
  // An occasion the reason already names ("…for Test event.") is not repeated.
  const occasion = priorityOccasionLabel({ ...priority, unlocks: priority.unlocks.slice(0, compact ? 1 : 2) });
  const eventNamed = priority.eventTitle?.trim();
  const showOccasion = occasion && !(eventNamed && context?.toLocaleLowerCase().includes(eventNamed.toLocaleLowerCase()));
  const step = !compact && gap.step ? `${gap.step.current} of ${gap.step.total}` : null;
  const eyebrow = [showOccasion ? occasion : null, step].filter(Boolean).join(' · ');

  const inner = (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Text style={[styles.numeral, eyebrow ? styles.numeralWithEyebrow : null]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {String(index).padStart(2, '0')}
      </Text>
      <View style={styles.body}>
        {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
        <View style={styles.titleRow}>
          <Text style={[styles.title, compact && styles.titleCompact]} >{label}</Text>
          {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} accessible={false} /> : null}
        </View>
        {context ? <Text style={styles.context}>{context}</Text> : null}
        {worksWith ? (
          <View style={styles.anchors}>
            <View style={styles.anchorFrames}>
              {anchors.slice(0, ANCHOR_THUMBNAILS).map((item) => (
                <View key={item.id} style={styles.anchorFrame}>
                  <WardrobeThumbnail item={item} iconSize={12} />
                </View>
              ))}
            </View>
            <Text style={styles.anchorLabel} numberOfLines={compact ? 1 : 2}>{worksWith}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  // One grammar on both surfaces: a line sheet with numerals down the left
  // and a hairline under each body column — never a stack of boxed cards.
  return (
    <View>
      {onPress ? (
        <PressableScale
          motion="crisp" scaleTo={0.985} haptic={false}
          contentStyle={styles.open} pressedContentStyle={styles.pressed}
          onPress={onPress} accessibilityRole="button"
          accessibilityLabel={[label, eyebrow, worksWith].filter(Boolean).join('. ')}
          accessibilityHint="Opens the shopping guide for this priority"
        >
          {inner}
        </PressableScale>
      ) : inner}
      {/* Declining is secondary to reading, so it is a quiet text action at
          the foot of the row rather than a pill that outweighs the title. */}
      {onSkip && !compact ? (
        <PressableScale
          motion="crisp" scaleTo={0.97} haptic={false}
          contentStyle={[styles.skip, skipping && styles.disabled]}
          onPress={onSkip} disabled={skipping} accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityState={{ disabled: !!skipping, busy: !!skipping }}
          accessibilityLabel={`Skip ${priority.label} suggestion`}
        >
          <Text style={styles.skipText}>{skipping ? 'Skipping…' : 'Not for me'}</Text>
        </PressableScale>
      ) : null}
      {!isLast ? <View style={styles.rule} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  open: { borderRadius: radii.sm },
  pressed: { backgroundColor: colors.surfaceSelected },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg },
  rowCompact: { paddingVertical: spacing.md },
  // The rail is the ordering device, so it is set in the Shop family's accent
  // rather than in grey: the sequence should read down the left edge.
  numeral: { width: PRIORITY_RAIL_WIDTH, ...typography.text.priorityNumeral, color: shoppingSurfaces.olive.accent, paddingTop: spacing.xs },
  // With an eyebrow above the title, the numeral sits on the eyebrow's line.
  numeralWithEyebrow: { paddingTop: 0 },
  body: { flex: 1, minWidth: 0, gap: spacing.sm },
  // The rule starts after the numerals rather than under them, so rows read
  // as one ordered list — a line sheet, not a table of boxed cards.
  rule: { marginLeft: PRIORITY_RAIL_WIDTH + spacing.md, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  eyebrow: { ...typography.text.eyebrow, color: shoppingSurfaces.olive.accent, marginBottom: -spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, ...typography.text.editorialCompact, color: colors.foreground },
  titleCompact: { ...typography.text.editorialSection },
  context: { ...typography.text.bodySmall, color: colors.inkSubtle },
  anchors: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  anchorFrames: { flexDirection: 'row', gap: 2 },
  anchorFrame: { width: 26 },
  anchorLabel: { flex: 1, ...typography.text.meta, color: colors.inkSubtle },
  skip: { alignSelf: 'flex-end', paddingBottom: spacing.md, marginTop: -spacing.sm },
  skipText: { ...typography.text.meta, color: colors.mutedForeground },
  disabled: { opacity: 0.5 },
});
