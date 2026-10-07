import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useItems } from '../../hooks/useItems';
import { useOutfitLogs } from '../../hooks/useOutfitLogs';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { AppText } from '../../components/primitives/AppText';
import { EditorialSection } from '../../components/primitives/Editorial';
import { PressableScale } from '../../components/primitives/PressableScale';
import { ColorBar, ColorLegend, ShareBars, WearSparkline } from '../../components/insights/InsightCharts';
import { buildClosetInsights } from '../../lib/closetInsights';
import { formatShoppingPrice } from '../../lib/shoppingPresentation';
import { itemCoverPresentation } from '../../lib/itemImage';
import { track } from '../../lib/analytics';
import { CATEGORY_LABELS, type Item } from '../../types/item';
import { colors, radii, spacing } from '../../theme';
import type { ClosetInsightsScreenProps } from '../../navigation/types';

function utilizationLine(share: number): string {
  if (share >= 0.7) return 'Nearly everything you own is earning its place.';
  if (share >= 0.4) return 'A healthy rotation, with room to rediscover a few pieces.';
  return 'Most of your closet is waiting for an invitation.';
}

function Thumb({ item, caption, onPress }: { item: Item; caption: string; onPress: () => void }) {
  const cover = itemCoverPresentation(item);
  return (
    <PressableScale onPress={onPress} style={styles.thumbWrap} accessibilityLabel={`${item.name}, ${caption}`}>
      <View style={styles.thumbPlate}>
        {cover.uri ? (
          <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit={cover.contentFit} transition={150} />
        ) : (
          <AppText variant="editorialSection" tone="muted">{item.name.charAt(0)}</AppText>
        )}
      </View>
      <AppText variant="caption" tone="primary" numberOfLines={1}>{item.name}</AppText>
      <AppText variant="meta" tone="muted" style={styles.tabular}>{caption}</AppText>
    </PressableScale>
  );
}

function daysAgo(iso: string | null): string {
  if (!iso) return 'Never worn';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days >= 365 ? 'Over a year' : `${days} days`;
}

export function ClosetInsightsScreen({ navigation }: ClosetInsightsScreenProps) {
  const insets = useSafeAreaInsets();
  const { data: items = [] } = useItems();
  const { data: logs = [] } = useOutfitLogs();
  const currency = useCurrencyCode();
  const insights = useMemo(() => buildClosetInsights(items, logs), [items, logs]);
  const [sparkWidth, setSparkWidth] = useState(0);

  const openItem = (id: number) =>
    navigation.navigate('Closet', { screen: 'ItemDetail', params: { itemId: id, returnTo: 'Home' } });
  const money = (n: number) => formatShoppingPrice(Number(n.toFixed(2)), currency);

  const pct = Math.round(insights.activeShare * 100);
  const totalWears = insights.rhythm.reduce((a, b) => a + b, 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} accessibilityLabel="Back" hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.chapter }]}>
        {/* Hero: the one number that matters most. */}
        <View style={styles.hero}>
          <AppText variant="masthead" tone="secondary">Closet Insights</AppText>
          <AppText variant="editorialFigure" tone="primary" style={styles.heroFigure}>{pct}%</AppText>
          <AppText variant="stylistLead" tone="primary">
            You reached for {insights.activeCount} of {insights.totalItems} pieces in the last 90 days.
          </AppText>
          <AppText variant="bodySmall" tone="muted">{utilizationLine(insights.activeShare)}</AppText>
        </View>

        {insights.avgCostPerWear != null ? (
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <AppText variant="editorialSection" tone="primary" style={styles.tabular}>{money(insights.avgCostPerWear)}</AppText>
              <AppText variant="eyebrow" tone="muted">Avg cost per wear</AppText>
            </View>
            <View style={styles.kpi}>
              <AppText variant="editorialSection" tone="primary" style={styles.tabular}>{insights.sleeping.length}</AppText>
              <AppText variant="eyebrow" tone="muted">Sleeping pieces</AppText>
            </View>
          </View>
        ) : null}

        {insights.rhythm.length > 0 ? (
          <EditorialSection variant="ruled" headingStyle="chapter" dividerPlacement="above-heading" title="Wear Rhythm"
            description={`${totalWears} ${totalWears === 1 ? 'look' : 'looks'} logged over 12 weeks`}>
            <View onLayout={(e) => setSparkWidth(e.nativeEvent.layout.width)}>
              <WearSparkline values={insights.rhythm} width={sparkWidth} />
            </View>
            <View style={styles.sparkAxis}>
              <AppText variant="meta" tone="muted">12 weeks ago</AppText>
              <AppText variant="meta" tone="muted">This week</AppText>
            </View>
          </EditorialSection>
        ) : null}

        <EditorialSection variant="ruled" headingStyle="chapter" dividerPlacement="above-heading" title="Composition">
          {insights.colors.length > 0 ? (
            <View style={styles.block}>
              <ColorBar colors={insights.colors} height={14} />
              <ColorLegend colors={insights.colors} />
            </View>
          ) : null}
          <ShareBars
            rows={insights.categories.map((c) => ({
              key: c.category,
              label: CATEGORY_LABELS[c.category],
              count: c.count,
              share: c.share,
            }))}
          />
        </EditorialSection>

        {insights.hardestWorking.length > 0 ? (
          <EditorialSection variant="ruled" headingStyle="chapter" dividerPlacement="above-heading" title="Hardest Working">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {insights.hardestWorking.map((item) => (
                <Thumb key={item.id} item={item} caption={`Worn ×${item.wearCount}`} onPress={() => openItem(item.id)} />
              ))}
            </ScrollView>
          </EditorialSection>
        ) : null}

        {insights.bestValue.length > 0 ? (
          <EditorialSection variant="ruled" headingStyle="chapter" dividerPlacement="above-heading" title="Best Value"
            description="Lowest cost per wear">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {insights.bestValue.map(({ item, costPerWear }) => (
                <Thumb key={item.id} item={item} caption={`${money(costPerWear)} / wear`} onPress={() => openItem(item.id)} />
              ))}
            </ScrollView>
          </EditorialSection>
        ) : null}

        {insights.sleeping.length > 0 ? (
          <EditorialSection variant="ruled" headingStyle="chapter" dividerPlacement="above-heading" title="Sleeping Pieces"
            description="Not worn in 60+ days"
            actionLabel="Refresh"
            onAction={() => {
              track('closet_insights_refresh_opened', { sleeping: insights.sleeping.length });
              navigation.navigate('Closet', { screen: 'ClosetRefresh' });
            }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {insights.sleeping.slice(0, 6).map((item) => (
                <Thumb key={item.id} item={item} caption={daysAgo(item.lastWornAt)} onPress={() => openItem(item.id)} />
              ))}
            </ScrollView>
          </EditorialSection>
        ) : null}
      </ScrollView>
    </View>
  );
}

const THUMB = 104;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.page - spacing.sm, height: 44, justifyContent: 'center' },
  back: { width: 40, height: 40, justifyContent: 'center' },
  content: { paddingHorizontal: spacing.page, gap: spacing.section },
  hero: { gap: spacing.sm, paddingTop: spacing.md },
  heroFigure: { fontSize: 72, lineHeight: 76, letterSpacing: -1 },
  kpiRow: { flexDirection: 'row', gap: spacing.xl },
  kpi: { flex: 1, gap: spacing.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  sparkAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  block: { gap: spacing.md, marginBottom: spacing.xl },
  rail: { gap: spacing.md, paddingRight: spacing.page },
  thumbWrap: { width: THUMB, gap: 2 },
  thumbPlate: {
    width: THUMB,
    height: THUMB * 1.25,
    borderRadius: radii.photo,
    backgroundColor: colors.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
