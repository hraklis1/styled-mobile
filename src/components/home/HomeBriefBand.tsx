import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EditorialSection } from '../primitives/Editorial';
import { PressableScale } from '../primitives/PressableScale';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { colors, spacing, typography } from '../../theme';

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Home's closing statement: the strongest sentence the app generates about
 * the user's wardrobe, reframed away from Shop's buying context.
 *
 * Home fetches the brief itself rather than waiting for Shop to populate the
 * cache, so a premium user sees it on the first screen of the day without
 * having to visit Shop first. The generation is cheap enough to justify
 * that: `stylist_light` (gpt-4.1-mini), ~450 output tokens, metered at 0
 * credits. Repeat opens rarely reach the model — this shares
 * `SHOPPING_BRIEF_QUERY_KEY` with Shop, and the server caches each brief for
 * 24h keyed by day plus a wardrobe/event snapshot.
 *
 * Gated on `isPremium` because the route is premium-only and would otherwise
 * 403 on every Home mount for free users. If the brief has nothing to say —
 * no data, or a wardrobe with no gaps — this renders nothing: no skeleton,
 * no error state, no upsell. Those belong to Shop.
 */
export function HomeBriefBand({ onPress, style }: Props) {
  const { isPremium } = useEntitlement();
  const { data: brief } = useShoppingBrief(isPremium);

  if (!brief || brief.status === 'insufficient_data') return null;

  return (
    <EditorialSection variant="ruled" title="The Read" style={style}>
      <Text style={styles.headline} numberOfLines={2}>{brief.headline}</Text>
      <PressableScale
        haptic={false}
        contentStyle={styles.link}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Read your full shopping brief"
      >
        <Text style={styles.linkText}>Read the brief</Text>
        <Ionicons name="arrow-forward" size={13} color={colors.action} />
      </PressableScale>
    </EditorialSection>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: typography.text.sheetTitle.fontSize,
    lineHeight: 27,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  link: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
  },
  linkText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.action,
  },
});
