import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../primitives/PressableScale';
import { shoppingSurfaces, colors, spacing, typography } from '../../theme';
import type { ShoppingBriefPriority } from '../../lib/shopDecisionWorkspace';

/** Priority labels arrive lowercase ("formal trousers") but read as titles
 *  here and on the edit screen. */
export const sentenceCase = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);

/** Width of the numeral rail — the same 26pt ShoppingPriorityTargetCard uses,
 *  so the "01" on the brief and the "01" on the edit sit on one grid. */
export const PRIORITY_RAIL_WIDTH = 26;

type Props = {
  index: number;
  priority: ShoppingBriefPriority;
  /** Compact = the teaser on Shop's cover card: title and one meta line, no
   *  context, no actions, and not itself tappable (the card is). */
  compact?: boolean;
  onPress?: () => void;
  onSkip?: () => void;
  skipping?: boolean;
  isLast?: boolean;
};

/**
 * One wardrobe priority as a numbered editorial row.
 *
 * The same shape carries the brief's two-line teaser on Shop and the full
 * row on ShoppingBriefDetailScreen: numeral in a left rail, serif title, an
 * optional line of the stylist's reasoning, and a tracked meta line with the
 * outfit count and the occasions it unlocks. On the detail screen the whole
 * row is the door to the edit — a trailing chevron says so — and skipping is
 * a caption at the row's tail rather than a second button.
 */
export function ShoppingPriorityRow({ index, priority, compact, onPress, onSkip, skipping, isLast }: Props) {
  const label = sentenceCase(priority.label);
  // The context often opens by restating the label ("Versatile mid-rise
  // trousers would create…") — under a title that already says it, that is
  // the same thought twice. Same guard the edit screen uses for its gap label.
  const normalizedLabel = priority.label.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  const context = !compact && priority.context && !priority.context.toLocaleLowerCase().startsWith(normalizedLabel)
    ? priority.context
    : null;
  const hasCount = typeof priority.impactScore === 'number' && priority.impactScore > 0;
  // …and when the context that survives already spells the count out
  // ("would add 9 new outfits"), the meta line doesn't repeat it.
  const countInContext = hasCount && context ? context.includes(`${priority.impactScore} new outfit`) : false;
  const meta = [
    hasCount && !countInContext ? `${priority.impactScore} new outfits` : null,
    ...priority.unlocks.slice(0, compact ? 1 : 2),
  ].filter((segment): segment is string => Boolean(segment)).join(' · ');

  const inner = (
    <View style={[styles.row, compact && styles.rowCompact, isLast && styles.rowLast]}>
      <Text style={styles.numeral} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {String(index).padStart(2, '0')}
      </Text>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={compact ? 1 : 2}>{label}</Text>
          {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} /> : null}
        </View>
        {context ? <Text style={styles.context}>{context}</Text> : null}
        {meta || onSkip ? (
          <View style={styles.metaRow}>
            {meta ? <Text style={styles.meta}>{meta}</Text> : <View style={styles.metaSpacer} />}
            {onSkip ? (
              <PressableScale
                motion="crisp"
                scaleTo={0.985}
                haptic={false}
                contentStyle={styles.skip}
                onPress={onSkip}
                disabled={skipping}
                accessibilityRole="button"
                accessibilityLabel={`Skip ${priority.label} suggestion`}
              >
                <Text style={styles.skipText}>{skipping ? 'Skipping…' : 'Not for me'}</Text>
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return inner;
  return (
    <PressableScale
      motion="crisp"
      scaleTo={0.985}
      haptic={false}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={meta ? `${label}. ${meta}` : label}
      accessibilityHint="Opens the shopping edit"
    >
      {inner}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowCompact: { paddingVertical: spacing.md },
  rowLast: { borderBottomWidth: 0 },
  numeral: {
    width: PRIORITY_RAIL_WIDTH,
    ...typography.text.editorialNumeral,
    color: colors.mutedForeground,
    paddingTop: 3,
  },
  body: { flex: 1, minWidth: 0, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flexShrink: 1, ...typography.text.editorialCompact, color: colors.foreground },
  titleCompact: { ...typography.text.editorialSection },
  context: { ...typography.text.bodySmall, lineHeight: 20, color: colors.inkSubtle },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, minHeight: 20 },
  meta: { flexGrow: 1, flexShrink: 1, flexBasis: 120, ...typography.text.meta, color: colors.mutedForeground },
  metaSpacer: { flex: 1 },
  // Tall enough to hit, quiet enough to ignore.
  skip: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.sm },
  skipText: { ...typography.text.caption, color: shoppingSurfaces.olive.accent },
});
