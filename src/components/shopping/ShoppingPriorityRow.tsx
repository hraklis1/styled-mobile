import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { clarifyOutfitClaims, potentialOutfitCount, priorityOccasionLabel } from '../../lib/shopClarity';
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
   *  context, and optionally tappable when a selection callback is supplied. */
  compact?: boolean;
  onPress?: () => void;
  onSkip?: () => void;
  skipping?: boolean;
  isLast?: boolean;
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
export function ShoppingPriorityRow({ index, priority, compact, onPress, onSkip, skipping, isLast }: Props) {
  const label = sentenceCase(priority.label);
  // The context often opens by restating the label ("Versatile mid-rise
  // trousers would create…") — under a title that already says it, that is
  // the same thought twice. Rather than dropping the sentence (which left
  // rows with nothing but a number), strip the restated label and let the
  // rest stand as the reason. Same guard the edit screen uses.
  const normalizedLabel = priority.label.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  const context = !compact && priority.context
    ? clarifyOutfitClaims(stripLeadingLabel(priority.context, normalizedLabel), priority.impactScore)
    : null;
  const countLabel = potentialOutfitCount(priority.impactScore);
  // An occasion the reason already names ("…for Test event.") is not repeated
  // on the meta line beneath it.
  const occasion = priorityOccasionLabel({ ...priority, unlocks: priority.unlocks.slice(0, compact ? 1 : 2) });
  const eventNamed = priority.eventTitle?.trim();
  const meta = [
    countLabel && !context?.includes(countLabel) ? countLabel : null,
    occasion && !(eventNamed && context?.toLocaleLowerCase().includes(eventNamed.toLocaleLowerCase())) ? occasion : null,
  ].filter(Boolean).join(' · ');

  const inner = (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Text style={styles.numeral} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {String(index).padStart(2, '0')}
      </Text>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, compact && styles.titleCompact]} >{label}</Text>
          {onPress && !compact ? <Ionicons name="chevron-forward" size={18} color={colors.primary} accessible={false} /> : null}
        </View>
        {context ? <Text style={styles.context}>{context}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {compact && onPress ? <Text style={styles.explore}>Open the guide →</Text> : null}
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
          accessibilityHint="Opens the shopping guide for this priority"
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
  explore: { ...typography.text.label, color: colors.action },
  footer: { alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
  skipText: { ...typography.text.label, color: colors.primary },
  disabled: { opacity: 0.5 },
});
