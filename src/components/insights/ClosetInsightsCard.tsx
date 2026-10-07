import { StyleSheet, View } from 'react-native';
import { AppText } from '../primitives/AppText';
import { PressableScale } from '../primitives/PressableScale';
import { ColorBar } from './InsightCharts';
import { colors, spacing, stroke } from '../../theme';
import { INSIGHTS_MIN_ITEMS, type ClosetInsights } from '../../lib/closetInsights';
import { formatShoppingPrice } from '../../lib/shoppingPresentation';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="editorialSection" tone="primary" style={styles.figure}>{value}</AppText>
      <AppText variant="eyebrow" tone="muted" numberOfLines={2}>{label}</AppText>
    </View>
  );
}

/**
 * Home's at-a-glance read on the closet: three numbers worth acting on over
 * the palette strip. Tapping anywhere opens the full Closet Insights screen.
 */
export function ClosetInsightsCard({
  insights,
  currencyCode,
  onPress,
}: {
  insights: ClosetInsights;
  currencyCode: string;
  onPress: () => void;
}) {
  if (!insights.ready) {
    const remaining = INSIGHTS_MIN_ITEMS - insights.totalItems;
    return (
      <View style={styles.unlock}>
        <AppText variant="editorialItalic" tone="secondary">
          Add {remaining} more {remaining === 1 ? 'piece' : 'pieces'} to see how your closet works for you.
        </AppText>
        <View style={styles.unlockTrack}>
          <View style={[styles.unlockFill, { width: `${(insights.totalItems / INSIGHTS_MIN_ITEMS) * 100}%` }]} />
        </View>
      </View>
    );
  }

  const leadColor = insights.colors[0];
  const cpw = insights.avgCostPerWear != null ? formatShoppingPrice(Number(insights.avgCostPerWear.toFixed(2)), currencyCode) : null;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel="Open closet insights"
      contentStyle={styles.card}
    >
      <View style={styles.stats}>
        <Stat value={`${Math.round(insights.activeShare * 100)}%`} label="Worn in 90 days" />
        <View style={styles.divider} />
        {cpw ? (
          <>
            <Stat value={cpw} label="Avg cost per wear" />
            <View style={styles.divider} />
          </>
        ) : null}
        <Stat value={String(insights.sleeping.length)} label="Sleeping pieces" />
      </View>
      {leadColor ? (
        <View style={styles.palette}>
          <ColorBar colors={insights.colors} height={8} />
          <AppText variant="meta" tone="muted">
            {leadColor.label} leads your palette at {Math.round(leadColor.share * 100)}%
          </AppText>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xl, paddingVertical: spacing.sm },
  stats: { flexDirection: 'row', alignItems: 'stretch' },
  stat: { flex: 1, gap: spacing.xs },
  figure: { fontVariant: ['tabular-nums'] },
  divider: {
    width: stroke.hairline,
    backgroundColor: colors.hairline,
    marginHorizontal: spacing.md,
  },
  palette: { gap: spacing.sm },
  unlock: { gap: spacing.md },
  unlockTrack: { height: 2, backgroundColor: colors.hairline, borderRadius: 1, overflow: 'hidden' },
  unlockFill: { height: 2, backgroundColor: colors.accentInk },
});
