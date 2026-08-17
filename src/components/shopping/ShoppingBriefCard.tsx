import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../primitives/PressableScale';
import { categoryIcon } from '../stylist/GapCard';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingBrief } from '../../lib/shopDecisionWorkspace';

/** Two is a strategy; five is a shopping list. The rest live behind "View plan". */
const PRIORITY_LIMIT = 2;

/** Priority labels arrive lowercase ("formal trousers") but read as chip titles
 *  here and on ShoppingBriefDetailScreen — exported for that reuse. */
export const sentenceCase = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);

/** "Your shopping brief" paired with an issue line, e.g. "August brief" — so
 *  the card reads as something issued this month rather than computed live. */
function BriefMasthead() {
  const issue = new Date().toLocaleDateString('en-US', { month: 'long' });
  return (
    <View style={styles.masthead}>
      <Text style={styles.label}>Your shopping brief</Text>
      <Text style={styles.issue}>{issue} brief</Text>
    </View>
  );
}

type Props = {
  isPremium: boolean;
  brief: ShoppingBrief | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Opens ShoppingBriefDetailScreen — the full summary, every priority, and
   *  each one's own Ask stylist control, all folded off this compressed card. */
  onOpenFullBrief: () => void;
  onStartShopping: () => void;
  onUpgrade: () => void;
  onAddWardrobePieces: () => void;
  onRetry: () => void;
  style?: object;
};

/**
 * Shop's cover feature, summarized: enough of the brief to justify the page's
 * one action, with the reasoning behind it one tap away on
 * ShoppingBriefDetailScreen rather than filling the card itself. The action
 * sits at the foot of the card so it still reads as the brief's conclusion,
 * not a button the page happens to carry.
 */
export function ShoppingBriefCard({
  isPremium,
  brief,
  isLoading,
  isError,
  onOpenFullBrief,
  onStartShopping,
  onUpgrade,
  onAddWardrobePieces,
  onRetry,
  style,
}: Props) {
  // The action is the shell's, not any branch's: a brief that failed to
  // generate is still a page you can start shopping from.
  const shell = (children: ReactNode, cardStyle?: object) => (
    <View style={[styles.card, cardStyle, style]}>
      {children}
      <PressableScale
        scaleTo={0.97}
        contentStyle={styles.startButton}
        onPress={onStartShopping}
        accessibilityRole="button"
        accessibilityLabel="Ask your stylist what to buy first"
      >
        <Ionicons name="sparkles" size={15} color={colors.primaryForeground} />
        <Text style={styles.startLabel}>What should I buy first?</Text>
      </PressableScale>
    </View>
  );

  if (!isPremium) {
    return shell(
      <>
        <BriefMasthead />
        <Text style={styles.headline} numberOfLines={2}>Know what to shop for before you go</Text>
        <Text style={styles.body}>
          See which additions would genuinely expand your wardrobe—and when you are better off buying nothing.
        </Text>
        <TextAction label="See plans" icon="sparkles" onPress={onUpgrade} />
      </>,
    );
  }

  if (isLoading) {
    return shell(
      <View style={styles.loadingBlock} accessibilityLabel="Building your Shopping Brief">
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.body}>Reviewing your wardrobe…</Text>
      </View>,
    );
  }

  if (isError || !brief) {
    return shell(
      <>
        <BriefMasthead />
        <Text style={styles.headline} numberOfLines={2}>Your brief is temporarily unavailable</Text>
        <Text style={styles.body}>Your shortlist is still here.</Text>
        <TextAction label="Try again" onPress={onRetry} />
      </>,
    );
  }

  if (brief.status === 'insufficient_data') {
    return shell(
      <>
        <BriefMasthead />
        <Text style={styles.headline} numberOfLines={2}>{brief.headline}</Text>
        <Text style={styles.body}>{brief.summary}</Text>
        <TextAction label="Add wardrobe pieces" onPress={onAddWardrobePieces} />
      </>,
    );
  }

  const priorities = brief.priorities.slice(0, PRIORITY_LIMIT);

  return shell(
    <>
      <BriefMasthead />
      <Text style={styles.headline} numberOfLines={2}>{brief.headline}</Text>
      <Text style={styles.body} numberOfLines={3}>{brief.summary}</Text>

      {priorities.length > 0 ? (
        <View style={styles.priorities}>
          <Text style={styles.prioritiesLabel}>Priorities</Text>
          {priorities.map((priority) => (
            <View key={`${priority.priority}-${priority.label}`} style={styles.priorityRow}>
              <View style={styles.priorityHead}>
                <Ionicons name={categoryIcon(priority.category)} size={15} color={colors.primary} />
                <Text style={styles.priorityLabel} numberOfLines={1}>{sentenceCase(priority.label)}</Text>
              </View>
              {priority.unlocks.length > 0 ? (
                <Text style={styles.priorityUnlocks} numberOfLines={2}>
                  Unlocks {priority.unlocks.join(' · ')}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* The reasoning behind each priority, and the stylist control to act
          on it, live on ShoppingBriefDetailScreen — this is the one door to
          it, so a card that only ever states a headline and two labels still
          reads as a brief rather than a teaser. */}
      <TextAction label="Read the full brief" onPress={onOpenFullBrief} />
    </>,
  );
}

function TextAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <PressableScale
      haptic={false}
      contentStyle={styles.textAction}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? <Ionicons name={icon} size={14} color={colors.action} /> : null}
      <Text style={styles.textActionLabel}>{label}</Text>
      <Ionicons name="arrow-forward" size={13} color={colors.action} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // No fill and no hairline of its own: the card sits inside Shop's tinted
  // brief band (ShopOverviewScreen's `briefBand`), whose own edge is the
  // boundary — a rule here on top of that would read as two dividers in the
  // space of one.
  card: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  loadingBlock: { minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  masthead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  label: { ...typography.eyebrow, color: colors.primary },
  issue: { fontSize: typography.size.xs, color: colors.mutedForeground },
  // display.sm, not .md: at .md this matched the page's own masthead
  // ("Buy fewer, better pieces") one-for-one and the two competed. A step
  // down reads as the page's cover feature rather than a second title.
  headline: {
    fontFamily: typography.family.display,
    ...typography.display.sm,
    color: colors.foreground,
  },
  body: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  prioritiesLabel: { ...typography.eyebrow, color: colors.mutedForeground },
  priorities: { paddingTop: spacing.sm },
  // Hairline-separated, not a white card inside a tinted one: the priority is
  // the reading, not a nested surface.
  priorityRow: {
    gap: 5,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  priorityHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityLabel: {
    flexShrink: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  priorityUnlocks: { fontSize: 10, lineHeight: 15, fontWeight: typography.weight.medium, color: colors.primary },
  // Full width, unlike every other action on this card: it is the page's one
  // filled button, and stretching it across the foot is what makes it read as
  // the brief's conclusion rather than a fourth thing to consider.
  startButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  startLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
  textAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  textActionLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.action },
});
