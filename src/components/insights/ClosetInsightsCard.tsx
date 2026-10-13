import { StyleSheet, View } from 'react-native';
import { AppText } from '../primitives/AppText';
import { PressableScale } from '../primitives/PressableScale';
import { Ionicons } from '@expo/vector-icons';
import { GarmentImage } from '../wardrobe/garment-image';
import { colors, spacing, stroke } from '../../theme';
import { INSIGHTS_MIN_ITEMS, type ClosetInsights } from '../../lib/closetInsights';
import { formatShoppingPrice } from '../../lib/shoppingPresentation';

/**
 * Home leads with a reason to revisit the wardrobe and a few real pieces.
 * Detailed percentages stay in Closet Insights; the palette reads as swatches.
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
        <AppText variant="bodySmall" tone="secondary">
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
      accessibilityLabel={`${insights.sleeping.length > 0 ? `Rediscover ${insights.sleeping.length} pieces.` : ''} Open closet insights.${leadColor ? ` Wardrobe palette: ${insights.colors.filter((color) => color.key !== 'other').map((color) => color.label).join(', ')}. ${leadColor.label} makes up ${Math.round(leadColor.share * 100)} percent of your wardrobe.` : ''}`}
      contentStyle={styles.card}
    >
      <View style={styles.leadRow}>
        <View style={styles.leadCopy}>
          <AppText variant="actionTitle" tone="primary">
            {insights.sleeping.length > 0
              ? `Rediscover ${insights.sleeping.length} ${insights.sleeping.length === 1 ? 'piece' : 'pieces'}`
              : 'Keep your favourites in rotation'}
          </AppText>
          <AppText variant="meta" tone="secondary">
            {insights.sleeping.length > 0
              ? 'Give something you haven’t worn lately a fresh look.'
              : 'Explore the pieces that work hardest for you.'}
          </AppText>
        </View>
        <Ionicons name="arrow-forward" size={16} color={colors.foreground} />
      </View>
      {insights.sleeping.length > 0 ? (
        <View style={styles.pieces}>
          {insights.sleeping.slice(0, 3).map((item) => (
            <GarmentImage key={item.id} item={item} width={64} height={80} borderRadius={2} />
          ))}
        </View>
      ) : null}
      {cpw ? <AppText variant="meta" tone="secondary">{cpw} average cost per wear</AppText> : null}
      {leadColor ? (
        <View style={styles.palette}>
          <AppText variant="meta" tone="secondary">Your wardrobe palette</AppText>
          <View style={styles.swatches}>
            {insights.colors.filter((color) => color.key !== 'other').map((color) => (
              <View key={color.key} accessible accessibilityLabel={color.label} style={[styles.swatch, { backgroundColor: color.hex }]} />
            ))}
          </View>
          <AppText variant="meta" tone="muted">
            {leadColor.label} · {Math.round(leadColor.share * 100)}% of your wardrobe
          </AppText>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xl, paddingVertical: spacing.sm },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  leadCopy: { flex: 1, gap: spacing.xs },
  pieces: { flexDirection: 'row', gap: spacing.sm },
  swatches: { flexDirection: 'row', gap: spacing.sm },
  swatch: { width: 32, height: 40, borderRadius: 2, borderWidth: stroke.hairline, borderColor: colors.ghostStroke },
  palette: { gap: spacing.sm, paddingTop: spacing.lg, borderTopWidth: stroke.hairline, borderTopColor: colors.border },
  unlock: { gap: spacing.md },
  unlockTrack: { height: 2, backgroundColor: colors.hairline, borderRadius: 1, overflow: 'hidden' },
  unlockFill: { height: 2, backgroundColor: colors.accentInk },
});
