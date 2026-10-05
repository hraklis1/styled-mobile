import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, shoppingSurfaces, spacing, typography } from '../../theme';
import type { ShoppingBrief, ShoppingBriefPriority } from '../../lib/shopDecisionWorkspace';
import type { Item } from '../../types/item';
import { previewTarget, priorityIdentity } from '../../lib/shopFocusedEdit';
import { shoppingGarmentTitle } from '../../lib/shoppingEditorial';
import { priorityAnchorPieces, withoutOutfitCount } from '../../lib/shopClarity';
import { toLocalDateKey } from '../../lib/dailyStylistPick';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { useShoppingFeedback } from '../../hooks/useShoppingFeedback';
import { targetOutfitIdeas } from '../../lib/shoppingPriorityEdit';
import { ShoppingOutfitPreview } from './ShoppingOutfitPreview';
import { WardrobeThumbnail } from './WardrobeThumbnail';
import { CuratedItemRail } from './CuratedItemRail';

export function ShopWardrobeEdit({ brief, wardrobe, onGuide, onBrief, scrollOffset = 0 }: {
  brief: ShoppingBrief; wardrobe: ReadonlyMap<number, Item>;
  onGuide: (priority: ShoppingBriefPriority) => void; onBrief: () => void; scrollOffset?: number;
}) {
  const feedback = useShoppingFeedback();
  const priorities = [...brief.priorities].sort((a, b) => a.priority - b.priority);
  const localDate = brief.localDate ?? toLocalDateKey(new Date());
  const pending = feedback.pending.filter(entry => entry.localDate === localDate && !entry.submitting);
  return <View style={styles.edit}>
    <Text selectable style={styles.note}>{brief.summary}</Text>
    {pending.map(entry => <View key={entry.id} style={styles.undo} accessibilityLiveRegion="polite"><Text style={styles.caption}>Suggestion hidden</Text><Pressable accessibilityRole="button" accessibilityLabel={`Undo hiding ${entry.label}`} onPress={() => feedback.undo(entry.id)} style={styles.quiet}><Text style={styles.link}>Undo</Text></Pressable></View>)}
    {feedback.error ? <Text accessibilityRole="alert" style={styles.error}>{feedback.error}</Text> : null}
    {priorities.map((priority, index) => <DailyAddition key={`${priorityIdentity(priority)}:${brief.generatedAt}`} priority={priority} first={index === 0} wardrobe={wardrobe} briefGeneratedAt={brief.generatedAt} scrollOffset={scrollOffset}
      onGuide={() => onGuide(priority)} onDismiss={priority.recommendationKey ? () => feedback.dismiss({ recommendationKey: priority.recommendationKey!, localDate, feedbackReason: 'not_relevant_now', label: priority.label }) : undefined} />)}
    <Pressable onPress={onBrief} accessibilityRole="button" style={styles.quiet}><Text style={styles.link}>Read your brief →</Text></Pressable>
  </View>;
}

function DailyAddition({ priority, first, wardrobe, briefGeneratedAt, scrollOffset, onGuide, onDismiss }: {
  priority: ShoppingBriefPriority; first: boolean; wardrobe: ReadonlyMap<number, Item>; briefGeneratedAt: string; scrollOffset: number; onGuide: () => void; onDismiss?: () => void;
}) {
  const ref = useRef<View>(null);
  const laidOut = useRef(false);
  const { height } = useWindowDimensions();
  const [enabled, setEnabled] = useState(first);
  const checkVisibility = useCallback(() => {
    if (!laidOut.current) return;
    ref.current?.measureInWindow((_x, y) => { if (y <= height * 2) setEnabled(true); });
  }, [height]);
  useEffect(checkVisibility, [checkVisibility, scrollOffset]);
  const edit = useShoppingPriorityEdit(priority, { origin: 'shopping_brief', briefGeneratedAt, purpose: 'preview', enabled });
  const target = previewTarget(edit.data?.targets ?? []);
  const look = target ? targetOutfitIdeas(target).find(idea => idea.itemIds.some(id => wardrobe.has(id))) : undefined;
  const anchors = priorityAnchorPieces(priority, wardrobe).slice(0, 3);
  const noBuy = edit.data?.status === 'no_buy';
  return <View ref={ref} testID={`shop-addition-${priorityIdentity(priority)}`} collapsable={false} onLayout={() => { laidOut.current = true; checkVisibility(); }} style={styles.addition}>
    {first ? <Text style={styles.start}>Start here</Text> : null}
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>{shoppingGarmentTitle(priority.label)}</Text>
      {onDismiss ? <Pressable accessibilityRole="button" accessibilityLabel={`Not now: ${priority.label}`} onPress={onDismiss} style={styles.quiet}><Text style={styles.caption}>Not now</Text></Pressable> : null}
    </View>
    <Text selectable style={styles.reason}>{noBuy ? edit.data?.noBuyReason ?? 'Your wardrobe already covers this addition.' : withoutOutfitCount(priority.context || target?.rationale || '', priority.impactScore)}</Text>
    {!noBuy && (look && target ? <ShoppingOutfitPreview look={look} target={target} wardrobe={wardrobe} /> : anchors.length ? <View style={styles.edit}>
      <Text style={styles.caption}>With pieces you own</Text><View style={styles.anchors}>{anchors.map(item => <View key={item.id} style={styles.anchor}><WardrobeThumbnail item={item} style={styles.thumbnail} /><Text style={styles.caption}>{item.name}</Text></View>)}</View>
    </View> : null)}
    {!noBuy && target?.rationale && priority.context && target.rationale.trim() !== priority.context.trim() ? <Text selectable style={styles.reason}>{withoutOutfitCount(target.rationale, priority.impactScore)}</Text> : null}
    {!noBuy && (!edit.data ? !enabled || edit.isLoading ? <CuratedItemRail offers={[]} status="pending" heading="" context={{ targetKey: priorityIdentity(priority), surface: 'shop_overview' }} /> : <View style={styles.edit}>
      <Text style={styles.caption}>{edit.fetchStatus === 'paused' ? 'Connect to see pieces for this addition.' : 'Pieces are unavailable right now. Your styling guide is still here.'}</Text>
      <Pressable accessibilityRole="button" onPress={() => void edit.refetch()} style={styles.quiet}><Text style={styles.link}>Try again</Text></Pressable>
    </View> : target ? <CuratedItemRail offers={target.offers ?? []} status={target.offerState?.status ?? 'empty'} heading="Pieces to consider" reason={target.rationale} target={target} wardrobe={wardrobe} browserTitle={target.title} context={{ reference: edit.data.commerceReference, targetKey: target.key, surface: 'shop_overview' }} onRetry={() => void edit.refreshOffers()} /> : <Text style={styles.caption}>No suitable listings right now. Your wardrobe guidance is still here.</Text>)}
    <Pressable onPress={onGuide} accessibilityRole="button" accessibilityLabel={`View styling guide: ${priority.label}`} style={styles.quiet}><Text style={styles.link}>View styling guide →</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  edit: { gap: spacing.md }, addition: { gap: spacing.md, paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  note: { ...typography.text.editorialBody, color: colors.foreground },
  start: { ...typography.text.caption, color: shoppingSurfaces.olive.accent },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.text.editorialCompact, color: colors.foreground, flex: 1 },
  reason: { ...typography.text.bodySmall, color: colors.inkSubtle },
  caption: { ...typography.text.caption, color: colors.mutedForeground },
  link: { ...typography.text.label, color: colors.action }, quiet: { minHeight: 44, justifyContent: 'center', flexShrink: 1 },
  anchors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, anchor: { width: 80, gap: spacing.xs }, thumbnail: { width: 64, aspectRatio: 0.8 },
  undo: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' },
  error: { ...typography.text.bodySmall, color: colors.error },
});
