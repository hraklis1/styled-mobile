import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EditorialSection } from '../primitives/Editorial';
import { PressableScale } from '../primitives/PressableScale';
import { useShoppingBriefCache } from '../../hooks/useShoppingBrief';
import { colors, spacing, typography } from '../../theme';

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Home's closing statement: the strongest sentence the app generates about
 * the user's wardrobe, reframed away from Shop's buying context. Reads the
 * Shop brief's query cache only (`useShoppingBriefCache`) — Home never
 * triggers the brief's LLM call itself. If the cache is empty (Shop hasn't
 * been opened this session) or the brief has nothing to say, this renders
 * nothing: no skeleton, no error state, no upsell. Those belong to Shop.
 */
export function HomeBriefBand({ onPress, style }: Props) {
  const { data: brief } = useShoppingBriefCache();

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
    fontFamily: typography.family.display,
    fontSize: typography.size.xl,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.action,
  },
});
