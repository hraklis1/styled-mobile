import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EditorialSection } from '../primitives/Editorial';
import { PressableScale } from '../primitives/PressableScale';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { colors, spacing } from '../../theme';
import { AppText } from '../primitives/AppText';

type Props = {
  onBriefPress: () => void;
  shortlist?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Home's wardrobe-intelligence chapter. The brief supplies the editorial
 * read; an active shortlist can sit beneath it as the concrete decision queue.
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
  const hasBrief = !!brief && brief.status !== 'insufficient_data';

  if (!hasBrief && !shortlist) return null;

  return (
    <EditorialSection variant="ruled" headingStyle="editorial" title="Wardrobe Edit" style={style}>
      {hasBrief ? (
        <View style={styles.briefGroup}>
          <AppText variant="eyebrow" tone="muted">The Read</AppText>
          <AppText variant="editorialCompact" tone="primary" numberOfLines={2}>{brief.headline}</AppText>
          <PressableScale
            haptic={false}
            contentStyle={styles.link}
            onPress={onBriefPress}
            accessibilityRole="button"
            accessibilityLabel="Read your full shopping brief"
          >
            <AppText variant="label" tone="action">Read the brief</AppText>
            <Ionicons name="arrow-forward" size={13} color={colors.action} />
          </PressableScale>
        </View>
      ) : null}
      {hasBrief && shortlist ? <View style={styles.divider} /> : null}
      {shortlist ? (
        <View style={styles.shortlistGroup}>
          <AppText variant="eyebrow" tone="muted">The Shortlist</AppText>
          {shortlist}
        </View>
      ) : null}
    </EditorialSection>
  );
}

const styles = StyleSheet.create({
  briefGroup: { gap: spacing.sm },
  link: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
    backgroundColor: colors.border,
  },
  shortlistGroup: { gap: spacing.sm },
});
