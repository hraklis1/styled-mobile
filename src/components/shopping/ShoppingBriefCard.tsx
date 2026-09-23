import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '../primitives/PressableScale';
import { sentenceCase } from './ShoppingPriorityRow';
import { shoppingSurfaces, colors, radii, spacing, typography } from '../../theme';
import type { ShoppingBrief, ShoppingBriefPriority } from '../../lib/shopDecisionWorkspace';
import type { Item } from '../../types/item';
import { withoutOutfitCount } from '../../lib/shopClarity';

/** Three is a strategy; five is a shopping list. The brief's own headline
 *  routinely counts to three ("Three practical additions…"), so the card shows
 *  three: a headline that promises more rows than the card has reads as a
 *  card with something missing. Anything past that lives on the detail. */
const PRIORITY_LIMIT = 3;

export { sentenceCase };

/** Illustrative rows for the locked card — labelled as an example on screen. */
const SAMPLE_PRIORITIES: ShoppingBriefPriority[] = [
  { label: 'Everyday leather sneakers', category: 'shoes', reason: 'wardrobe_gap', context: '', priority: 1, unlocks: ['Weekends', 'Smart casual'] },
  { label: 'Camel wool overcoat', category: 'outerwear', reason: 'weather', context: '', priority: 2, unlocks: ['Cold-weather layering'] },
];

const SAMPLE_NOTE = 'You have plenty to wear on weekends, but little that holds up on a cold morning. A camel overcoat would do the most work—it sits over nearly everything you own.';

/** The issue line, e.g. "August brief" — so the brief reads as something
 *  issued this month rather than computed live. It rides in the section
 *  header's `trailing` slot on Shop, beside the department label, which is
 *  why it is exported rather than drawn by the card: the card owns the
 *  content, the page owns the heading. */
export function briefIssueLabel(): string {
  return `${new Date().toLocaleDateString('en-US', { month: 'long' })} brief`;
}

type Props = {
  isPremium: boolean;
  brief: ShoppingBrief | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Opens ShoppingBriefDetailScreen — the full summary, every priority, and
   *  each one's own See options control, all folded off this compressed card. */
  onOpenFullBrief: () => void;
  /** The wearable closet by id, so each priority can show the pieces it works with. */
  wardrobe?: ReadonlyMap<number, Item>;
  onSelectPriority?: (priority: ShoppingBriefPriority) => void;
  onStartShopping?: () => void;
  startLabel?: string;
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
  wardrobe,
  onSelectPriority,
  onStartShopping,
  startLabel,
  onUpgrade,
  onAddWardrobePieces,
  onRetry,
  style,
}: Props) {
  const shell = (children: ReactNode, cardStyle?: object) => (
    <View style={[styles.card, cardStyle, style]}>
      {children}
      {onStartShopping ? <PressableScale
        motion="crisp"
        scaleTo={0.985}
        contentStyle={styles.startButton}
        onPress={onStartShopping}
        accessibilityRole="button"
        accessibilityLabel={startLabel ?? 'Start with your first shopping priority'}
      >
        <Ionicons name="sparkles" size={15} color={colors.primaryForeground} />
        <Text style={styles.startLabel}>{startLabel ?? 'Start with your first priority'}</Text>
      </PressableScale>
      : null}
    </View>
  );

  if (!isPremium) {
    return shell(
      <>
        <Text style={styles.headline} numberOfLines={2}>Know what to shop for before you go</Text>
        <Text style={styles.body}>
          See which additions would genuinely expand your wardrobe—and when you are better off buying nothing.
        </Text>
        {/* What a brief looks like, not just what it does: two example rows in
            the real priority grammar, dimmed and marked as an example, so the
            locked card sells the thing rather than describing it. */}
        <View style={styles.sample} accessibilityLabel="Example brief: a note from your stylist and the pieces it recommends">
          <Text style={styles.sampleLabel}>Example</Text>
          <BriefNote text={SAMPLE_NOTE} />
          <BriefEditStrip priorities={SAMPLE_PRIORITIES} />
        </View>
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
        <Text style={styles.headline} numberOfLines={2}>Your brief is temporarily unavailable</Text>
        <Text style={styles.body}>Your shortlist is still here.</Text>
        <TextAction label="Try again" onPress={onRetry} />
      </>,
    );
  }

  if (brief.status === 'insufficient_data') {
    // Below the versatility floor still carries a starter_capsule sequence
    // now (server/shoppingOpportunities.ts) rather than an empty list, so a
    // brand-new wardrobe sees a labeled first step instead of only the CTA.
    const starterPriorities = brief.priorities.slice(0, PRIORITY_LIMIT);
    return shell(
      <>
        <BriefNote text={brief.summary} />
        <BriefEditStrip priorities={starterPriorities} />
        <TextAction label="Add wardrobe pieces" onPress={onAddWardrobePieces} />
      </>,
    );
  }

  const priorities = brief.priorities.slice(0, PRIORITY_LIMIT);
  const note = brief.priorities.reduce((text, priority) => withoutOutfitCount(text, priority.impactScore), brief.summary);

  return shell(
    <>
      {/* The note is the stylist talking; the headline it replaced here
          still titles ShoppingBriefDetailScreen and Home's brief band. */}
      <BriefNote text={note} />
      <TextAction label="Read the full brief" onPress={onOpenFullBrief} />

      {/* "Balanced" with no priorities but a known next candidate — distinct
          from "well covered", where nothing was ever found. */}
      {brief.status === 'balanced' && brief.nextUp ? (
        <View style={styles.nextUpRow}>
          <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
          <Text style={styles.nextUpLabel} numberOfLines={1}>Next up: {sentenceCase(brief.nextUp.label)}</Text>
        </View>
      ) : null}

      <BriefEditStrip priorities={priorities} onSelectPriority={onSelectPriority} />
    </>,
  );
}

/** The brief in the stylist's own voice: a short note, set as a quotation
 *  so it reads as advice from someone rather than a computed label. */
export function BriefNote({ text, full }: { text: string; full?: boolean }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">“</Text>
      <Text style={styles.noteText} numberOfLines={full ? undefined : 5}>{text}</Text>
    </View>
  );
}

/** The pieces the note recommends, as one line of numbered pills — the
 *  rich rows (what each works with, occasions, skip) live on the detail. */
function BriefEditStrip({ priorities, onSelectPriority }: { priorities: ShoppingBriefPriority[]; onSelectPriority?: (priority: ShoppingBriefPriority) => void }) {
  if (priorities.length === 0) return null;
  return (
    <View style={styles.edit}>
      <Text style={styles.editLabel}>The edit</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.editRow} style={styles.editScroll}>
        {priorities.map((priority, index) => {
          const label = sentenceCase(priority.label);
          return (
            <PressableScale
              key={`${priority.priority}-${priority.label}`}
              motion="crisp"
              scaleTo={0.96}
              disabled={!onSelectPriority}
              contentStyle={styles.pill}
              onPress={onSelectPriority ? () => onSelectPriority(priority) : undefined}
              accessibilityRole={onSelectPriority ? 'button' : undefined}
              accessibilityLabel={`Priority ${index + 1}: ${label}`}
            >
              <Text style={styles.pillNumeral}>{index + 1}</Text>
              <Text style={styles.pillLabel} numberOfLines={1}>{label}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
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
      motion="crisp"
      scaleTo={0.985}
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
  // Transparent, and no hairline of its own: the card sits inside Shop's
  // softly lit brief panel (ShopOverviewScreen's `briefPanel`), which owns the
  // surface, the edge and the padding. A fill here would cover the gradient
  // and a rule would read as two dividers in the space of one.
  card: {
    gap: spacing.sm,
    backgroundColor: 'transparent',
  },
  loadingBlock: { minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  // A deck, not a title. At editorialCompact (22pt medium) this matched the
  // priority titles below it one-for-one, so the recommendation list never
  // resolved as a list — the eye had two things of equal weight to land on.
  // Dropped to the regular editorial face a step down, it sets up the page's
  // ladder: masthead 28 → the pieces being recommended 22 → this 19.
  // Capped short of the column so a two-line headline breaks at a phrase
  // rather than stranding its last word on the second line.
  headline: {
    ...typography.text.editorialBody,
    maxWidth: 320,
    color: colors.foreground,
  },
  body: { ...typography.text.bodySmall, color: colors.inkSubtle },
  nextUpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nextUpLabel: { ...typography.text.caption, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  note: { flexDirection: 'row', gap: spacing.xs },
  noteMark: { ...typography.text.editorialBody, fontSize: 30, lineHeight: 30, color: shoppingSurfaces.olive.accent, marginTop: -2 },
  // The stylist's voice: the editorial face in italic, a step under the
  // masthead, so it reads as a letter rather than a headline.
  noteText: { ...typography.text.editorialBody, fontSize: 17, lineHeight: 24, flex: 1, fontStyle: 'italic', color: colors.foreground },
  edit: { gap: spacing.xs, paddingTop: spacing.xs },
  editLabel: { ...typography.text.meta, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1 },
  // Bleeds to the panel edge so a long third pill scrolls rather than clips.
  editScroll: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  editRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  pill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: shoppingSurfaces.olive.wash,
  },
  pillNumeral: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 26,
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: shoppingSurfaces.olive.wash,
    backgroundColor: shoppingSurfaces.olive.accent,
  },
  pillLabel: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.medium, color: colors.foreground },
  sample: { opacity: 0.55, paddingTop: spacing.xs },
  sampleLabel: { ...typography.text.meta, color: colors.mutedForeground },
  // Full width, unlike every other action on this card: it is the page's one
  // filled button, and stretching it across the foot is what makes it read as
  // the brief's conclusion rather than a fourth thing to consider.
  startButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: shoppingSurfaces.espresso,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: shoppingSurfaces.highlight,
    boxShadow: shoppingSurfaces.buttonShadow,
  },
  startLabel: {
    fontSize: typography.text.bodySmall.fontSize,
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
  // Ink, not olive: this is a section-level "go deeper" link like the
  // "See all" beside Your shortlist, and the three should not differ. Olive
  // is reserved for content marks — the numerals and the counts — so the
  // accent never appears on something tappable.
  textActionLabel: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.action },
});
