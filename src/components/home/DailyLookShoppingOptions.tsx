import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { shoppingPriorityFromDailyLookGap } from '../../lib/dailyLookPresentation';
import type { StylistMissingEssential } from '../../features/stylist/types';
import { useItems } from '../../hooks/useItems';
import { wearableWardrobe } from '../../lib/shopClarity';
import { CuratedItemRail } from '../shopping/CuratedItemRail';
import { spacing, typography, colors } from '../../theme';
export function DailyLookShoppingOptions({ gap, visible, reason, exploreRequest = 0, onAvailabilityChange }: {
  gap: StylistMissingEssential; visible: boolean; reason?: string; exploreRequest?: number; onAvailabilityChange?: (available: boolean) => void;
}) {
  const query = useShoppingPriorityEdit(shoppingPriorityFromDailyLookGap(gap), { origin: 'daily_look', enabled: visible });
  const { data: items = [] } = useItems();
  const wardrobe = wearableWardrobe(items);
  const targets = query.data?.targets ?? [];
  const firstEligible = query.data?.status === 'no_buy' ? -1 : targets.findIndex(target => target.offers?.some(offer => offer.inStock !== false));
  useEffect(() => { onAvailabilityChange?.(firstEligible >= 0); }, [firstEligible, onAvailabilityChange]);
  return <View style={styles.root}>
    {query.data?.status === 'no_buy' ? <Text style={styles.copy}>{query.data.noBuyReason || 'Your wardrobe already covers this addition.'}</Text> : targets.length ? targets.map((target, index) => <CuratedItemRail key={target.key} offers={target.offers ?? []} status={target.offerState?.status} heading={target.title} reason={target.rationale || reason} target={target} wardrobe={wardrobe} collectionAction={index === firstEligible ? 'external' : 'rail'} exploreRequest={index === firstEligible ? exploreRequest : 0} context={{ reference: query.data?.commerceReference, targetKey: target.key, surface: 'daily_look' }} onRetry={() => void query.refreshOffers()} />) : <CuratedItemRail offers={[]} status={query.isError || query.fetchStatus === 'paused' ? 'unavailable' : query.data ? 'empty' : 'pending'} heading="Complete this look" context={{ targetKey: gap.category, surface: 'daily_look' }} onRetry={() => void query.refetch()} />}
  </View>;
}
const styles = StyleSheet.create({ root: { gap: spacing.lg, paddingTop: spacing.lg }, copy: { ...typography.text.bodySmall, color: colors.mutedForeground } });
