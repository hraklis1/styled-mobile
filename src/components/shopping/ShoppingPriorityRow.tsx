import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, spacing, typography } from '../../theme';
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

/** Numbered editorial priority with independent navigation and skip actions. */
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
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Text style={styles.numeral} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {String(index).padStart(2, '0')}
      </Text>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={compact ? 1 : undefined}>{label}</Text>
          {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.primary} accessible={false} /> : null}
        </View>
        {context ? <Text style={styles.context}>{context}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, compact && styles.containerCompact, !isLast && !compact && styles.separated]}>
      {onPress ? (
        <PressableScale
          motion="crisp" scaleTo={0.985} haptic={false}
          contentStyle={styles.open} pressedContentStyle={styles.pressed}
          onPress={onPress} accessibilityRole="button"
          accessibilityLabel={meta ? `${label}. ${meta}` : label}
          accessibilityHint="Opens the shopping edit"
        >
          {inner}
        </PressableScale>
      ) : inner}
      {onSkip && !compact ? (
        <View style={styles.footer}>
          <PressableScale
            motion="crisp" scaleTo={0.985} haptic={false}
            contentStyle={[styles.skip, skipping && styles.disabled]}
            pressedContentStyle={styles.pressed}
            onPress={onSkip} disabled={skipping} accessibilityRole="button"
            accessibilityState={{ disabled: !!skipping, busy: !!skipping }}
            accessibilityLabel={`Skip ${priority.label} suggestion`}
          >
            <Text style={styles.skipText}>{skipping ? 'Skipping…' : 'Not for me'}</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surfaceElevated, borderRadius: radii.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  containerCompact: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0 },
  separated: { marginBottom: spacing.md },
  open: { borderRadius: radii.card },
  pressed: { backgroundColor: colors.surfaceSelected },
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  rowCompact: { paddingHorizontal: 0, paddingVertical: spacing.md },
  numeral: { width: PRIORITY_RAIL_WIDTH, ...typography.text.priorityNumeral, color: colors.tertiary, paddingTop: spacing.xs },
  body: { flex: 1, minWidth: 0, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, ...typography.text.editorialCompact, color: colors.foreground },
  titleCompact: { ...typography.text.editorialSection },
  context: { ...typography.text.bodySmall, color: colors.inkSubtle },
  meta: { ...typography.text.meta, color: colors.mutedForeground },
  footer: { alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
  skipText: { ...typography.text.label, color: colors.primary },
  disabled: { opacity: 0.5 },
});
