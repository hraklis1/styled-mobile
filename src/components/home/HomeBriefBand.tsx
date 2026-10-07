import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EditorialSection } from '../primitives/Editorial';
import { PressableScale } from '../primitives/PressableScale';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { colors, radii, shadows, spacing, stroke } from '../../theme';
import { AppText } from '../primitives/AppText';
import { withoutOutfitCount } from '../../lib/shopClarity';

type Props = {
  onBriefPress: () => void;
  /**
   * Renders the shortlist card. It gets the kicker to show inside its own
   * pressable, above its row, and the card surface so it matches the brief.
   */
  shortlist?: (slot: { header: ReactNode; cardStyle: StyleProp<ViewStyle> }) => ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Names the Shop destination a Wardrobe Edit card opens, in the words Shop's
 * own section headings use, with a line on what it is for. Sentence case, not
 * tracked caps: the section's serif title is the heading here, and a caps
 * kicker read as its peer. The two cards lead
 * to different places, so each carries its own sign rather than sharing one.
 */
function WardrobeEditKicker({ icon, label, purpose }: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  purpose: string;
}) {
  return (
    <View style={styles.kicker}>
      <View style={styles.kickerIcon}>
        <Ionicons name={icon} size={14} color={colors.accentInk} />
      </View>
      <View style={styles.kickerCopy}>
        <AppText variant="label" tone="primary" numberOfLines={1}>{label}</AppText>
        <AppText variant="meta" tone="muted" numberOfLines={1}>{purpose}</AppText>
      </View>
    </View>
  );
}

/**
 * Home's window into Shop. The brief supplies the editorial read of what to
 * buy next; an active shortlist is the queue of finds still waiting on a
 * decision. They open different Shop screens, so they are two cards, not one
 * folio split by a hairline — sharing a sheet made them read as one feature.
 * Each card is wholly tappable and leads with a kicker naming where it goes.
 *
 * Home fetches the brief itself rather than waiting for Shop to populate the
 * cache, so a premium user sees it on the first screen of the day without
 * having to visit Shop first. The generation is cheap enough to justify
 * that: `stylist_light` (gpt-4.1-mini), ~450 output tokens, metered at 0
 * credits. Repeat opens rarely reach the model — this shares
 * `SHOPPING_BRIEF_QUERY_KEY` with Shop, and the server caches each brief for
 * 24h keyed by day plus a wardrobe/event snapshot.
 *
 * Gated on `isPremium` because the brief route is premium-only and would
 * otherwise 403 on every Home mount for free users. The shortlist is local and
 * can still render when the brief has nothing to say.
 */
export function HomeWardrobeEdit({ onBriefPress, shortlist, style }: Props) {
  const { isPremium } = useEntitlement();
  const { data: brief } = useShoppingBrief(isPremium);
  // The same text Shop's "Your shopping brief" panel shows, nothing more.
  const summary = brief && brief.status !== 'insufficient_data'
    ? brief.priorities.reduce((text, priority) => withoutOutfitCount(text, priority.impactScore), brief.summary)
    : '';
  const hasBrief = !!summary;

  if (!hasBrief && !shortlist) return null;

  return (
    <EditorialSection
      variant="ruled"
      headingStyle="chapter"
      dividerPlacement="above-heading"
      title="Wardrobe Edit"
      style={style}
    >
      <View style={styles.cards}>
        {hasBrief ? (
          <PressableScale
            haptic={false}
            scaleTo={0.99}
            contentStyle={[styles.card, styles.briefCard]}
            onPress={onBriefPress}
            accessibilityRole="button"
            accessibilityLabel={`Your shopping brief: ${summary}. Opens Shop`}
          >
            <WardrobeEditKicker
              icon="sparkles-outline"
              label="Your shopping brief"
              purpose="What your wardrobe needs next"
            />
            <AppText variant="body" tone="primary">{summary}</AppText>
          </PressableScale>
        ) : null}
        {shortlist?.({
          header: (
            <WardrobeEditKicker
              icon="bookmark-outline"
              label="Your shortlist"
              purpose="Finds you saved while shopping"
            />
          ),
          cardStyle: [styles.card, styles.shortlistCard],
        })}
      </View>
    </EditorialSection>
  );
}

const styles = StyleSheet.create({
  cards: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.panel,
    borderCurve: 'continuous',
    borderWidth: stroke.hairline,
    borderColor: colors.border,
    ...shadows.ambient,
  },
  briefCard: {
    gap: spacing.md,
    paddingHorizontal: spacing.control,
    paddingTop: spacing.control,
    paddingBottom: spacing.lg,
  },
  // The row below the kicker brings its own vertical padding.
  shortlistCard: {
    paddingHorizontal: spacing.control,
    paddingTop: spacing.control,
    paddingBottom: spacing.xs,
  },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  kickerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  kickerCopy: { flex: 1 },
});
