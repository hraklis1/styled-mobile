import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '../primitives/AppText';
import { PressableScale } from '../primitives/PressableScale';
import { Ionicons } from '@expo/vector-icons';
import { GarmentImage } from '../wardrobe/garment-image';
import { colors, radii, spacing, stroke } from '../../theme';
import { INSIGHTS_MIN_ITEMS, type ClosetInsights } from '../../lib/closetInsights';
import { formatShoppingPrice } from '../../lib/shoppingPresentation';

const CARD_WIDTH = 108;
const CARD_GAP = spacing.sm;
const CARD_HEIGHT = CARD_WIDTH * 4 / 3;

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
    <View style={styles.card}>
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${insights.sleeping.length > 0 ? `Rediscover ${insights.sleeping.length} pieces.` : ''} Open closet insights.${leadColor ? ` Wardrobe palette: ${insights.colors.filter((color) => color.key !== 'other').map((color) => color.label).join(', ')}. ${leadColor.label} makes up ${Math.round(leadColor.share * 100)} percent of your wardrobe.` : ''}`}
      contentStyle={{ minHeight: 44 }}
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
              ? insights.sleeping.every(item => !item.lastWornAt) ? 'Pieces waiting for their debut' : 'Pieces ready for a fresh rotation'
              : 'Explore the pieces that work hardest for you.'}
          </AppText>
        </View>
        <Ionicons name="arrow-forward" size={16} color={colors.foreground} />
      </View>
    </PressableScale>
      {insights.sleeping.length > 0 ? (
        <ScrollView
          horizontal
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + CARD_GAP}
          snapToAlignment="start"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pieces}
        >
          {insights.sleeping.map((item) => (
            <PressableScale key={item.id} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Rediscover ${item.name}. Open closet insights`} contentStyle={styles.piece}>
              <View style={styles.pieceCanvas}>
                <GarmentImage normalized item={item} width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={radii.md} />
                <View pointerEvents="none" style={styles.pieceOutline} />
              </View>
              <AppText variant="eyebrow" tone="muted" style={styles.contextChip} numberOfLines={2}>
                {item.lastWornAt ? `Last worn ${Math.max(0, Math.floor((Date.now() - Date.parse(item.lastWornAt)) / 86400000))}d ago` : item.name}
              </AppText>
            </PressableScale>
          ))}
        </ScrollView>
      ) : null}
      {cpw ? <AppText variant="meta" tone="secondary">{cpw} average cost per wear</AppText> : null}
      {leadColor ? (
        <View style={styles.palette}>
          <AppText variant="meta" tone="secondary">Your wardrobe palette</AppText>
          <View style={styles.swatches}>
            {insights.colors.map((color) => (
              <View key={color.key} accessible accessibilityLabel={`${color.label} ${Math.round(color.share * 100)}%`} style={[styles.swatch, { backgroundColor: color.hex, flex: color.share }]} />
            ))}
          </View>
          <AppText variant="meta" tone="muted">
            {insights.colors.slice(0, 3).map((color) => `${color.label} ${Math.round(color.share * 100)}%`).join(' · ')}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xl, paddingVertical: spacing.sm },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  leadCopy: { flex: 1, gap: spacing.xs },
  pieces: { flexDirection: 'row', gap: CARD_GAP, paddingRight: spacing.page },
  piece: { width: CARD_WIDTH, gap: spacing.sm },
  pieceCanvas: { width: '100%', aspectRatio: 3 / 4, overflow: 'hidden', borderRadius: radii.md, backgroundColor: colors.imageMat },
  pieceOutline: { ...StyleSheet.absoluteFill, borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.06)' },
  contextChip: { fontSize: 10, letterSpacing: 1, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, backgroundColor: colors.linen, borderRadius: radii.sm },
  swatches: { flexDirection: 'row', height: 12, borderRadius: radii.sm, overflow: 'hidden' },
  swatch: { height: 12, borderWidth: stroke.hairline, borderColor: colors.ghostStroke },
  palette: { gap: spacing.sm, paddingTop: spacing.lg, borderTopWidth: stroke.hairline, borderTopColor: colors.border },
  unlock: { gap: spacing.md },
  unlockTrack: { height: 2, backgroundColor: colors.hairline, borderRadius: 1, overflow: 'hidden' },
  unlockFill: { height: 2, backgroundColor: colors.accentInk },
});
