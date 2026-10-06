import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { ShoppingChapterContents } from './ShoppingChapterContents';
import { CuratedItemRail } from './CuratedItemRail';

export function ShopWardrobeEdit({ brief, wardrobe, onGuide, onBrief, scrollOffset = 0, onJump, registerChapter, registerHeading }: {
  brief: ShoppingBrief; wardrobe: ReadonlyMap<number, Item>;
  onGuide: (priority: ShoppingBriefPriority) => void; onBrief: () => void; scrollOffset?: number; onJump?: (key: string) => void; registerChapter?: (key: string, node: View | null) => void; registerHeading?: (key: string, node: Text | null) => void;
}) {
  const feedback = useShoppingFeedback();
  const localDate = brief.localDate ?? toLocalDateKey(new Date());
  const hiddenKeys = new Set(feedback.pending.filter(entry => entry.localDate === localDate).map(entry => entry.recommendationKey));
  const priorities = [...brief.priorities].filter(priority => !priority.recommendationKey || !hiddenKeys.has(priority.recommendationKey)).sort((a, b) => a.priority - b.priority);
  const pending = feedback.pending.filter(entry => entry.localDate === localDate && !entry.submitting);
  const overview = useRef<View>(null);
  const focusOverview = () => { if (onJump) { onJump('overview'); return; } const handle = findNodeHandle(overview.current); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); };
  return <View style={styles.edit}>
    <View ref={node => { overview.current = node; registerChapter?.('overview', node); }} style={styles.overview}>
      <Text accessibilityRole="header" ref={node => registerHeading?.('overview', node)} style={styles.note}>{priorities.length === 0 ? 'Your wardrobe is covered for now' : `${['', 'One', 'Two', 'Three', 'Four', 'Five'][priorities.length] ?? priorities.length} ${priorities.length === 1 ? 'addition' : 'additions'} to consider`}</Text>
      <Text style={styles.reason}>Explore what to add next, how to wear it, and options to consider.</Text>
    </View>
    <ShoppingChapterContents entries={priorities.map((priority, index) => ({ key: priorityIdentity(priority), title: shoppingGarmentTitle(priority.label), detail: index === 0 ? 'Start here' : index === 1 ? 'Next priority' : 'Also consider' }))} onSelect={key => onJump?.(key)} />
    <Pressable onPress={onBrief} accessibilityRole="button" style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}><Text style={styles.link}>Read your shopping brief →</Text></Pressable>
    {pending.map(entry => <View key={entry.id} style={styles.undo} accessibilityLiveRegion="polite"><Text style={styles.caption}>Suggestion hidden</Text><Pressable accessibilityRole="button" accessibilityLabel={`Undo hiding ${entry.label}`} onPress={() => feedback.undo(entry.id)} style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}><Text style={styles.link}>Undo</Text></Pressable></View>)}
    {feedback.error ? <Text accessibilityRole="alert" style={styles.error}>{feedback.error}</Text> : null}
    {priorities.map((priority, index) => <DailyAddition key={`${priorityIdentity(priority)}:${brief.generatedAt}`} priority={priority} first={index === 0} index={index} registerChapter={registerChapter} registerHeading={registerHeading} wardrobe={wardrobe} briefGeneratedAt={brief.generatedAt} scrollOffset={scrollOffset}
      onGuide={() => onGuide(priority)} onDismiss={priority.recommendationKey ? () => { focusOverview(); feedback.dismiss({ recommendationKey: priority.recommendationKey!, localDate, feedbackReason: 'not_relevant_now', label: priority.label }); } : undefined} />)}
  </View>;
}

function DailyAddition({ priority, first, index, registerChapter, registerHeading, wardrobe, briefGeneratedAt, scrollOffset, onGuide, onDismiss }: {
  priority: ShoppingBriefPriority; first: boolean; index: number; registerChapter?: (key: string, node: View | null) => void; registerHeading?: (key: string, node: Text | null) => void; wardrobe: ReadonlyMap<number, Item>; briefGeneratedAt: string; scrollOffset: number; onGuide: () => void; onDismiss?: () => void;
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
  return <View ref={node => { ref.current = node; registerChapter?.(priorityIdentity(priority), node); }} testID={`shop-addition-${priorityIdentity(priority)}`} collapsable={false} onLayout={() => { laidOut.current = true; checkVisibility(); }} style={styles.addition}>
    <View style={styles.identity}>
    <Text style={styles.start}>{String(index + 1).padStart(2, '0')} / {first ? 'Start here' : index === 1 ? 'Next priority' : 'Also consider'}</Text>
    <View style={styles.heading}>
      <Text ref={node => registerHeading?.(priorityIdentity(priority), node)} accessibilityRole="header" style={styles.title}>{shoppingGarmentTitle(priority.label)}</Text>
      {onDismiss ? <Pressable accessibilityRole="button" accessibilityLabel={`Not now: ${priority.label}`} onPress={onDismiss} style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}><Text style={styles.caption}>Not now</Text></Pressable> : null}
    </View>
    <Text selectable style={styles.reason}>{noBuy ? edit.data?.noBuyReason ?? 'Your wardrobe already covers this addition.' : withoutOutfitCount(priority.context || target?.rationale || '', priority.impactScore)}</Text>
    </View>
    {!noBuy && (look && target ? <View style={styles.group}><Text style={styles.label}>Wear it with pieces you own</Text><ShoppingOutfitPreview editorial look={look} target={target} wardrobe={wardrobe} /></View> : anchors.length ? <View style={styles.edit}>
      <Text style={styles.caption}>Pieces you own</Text><View style={styles.anchors}>{anchors.map(item => <View key={item.id} style={styles.anchor}><WardrobeThumbnail item={item} style={styles.thumbnail} /><Text style={styles.caption}>{item.name}</Text></View>)}</View>
    </View> : null)}
    {!noBuy && target?.rationale && priority.context && target.rationale.trim() !== priority.context.trim() ? <Text selectable style={styles.reason}>{withoutOutfitCount(target.rationale, priority.impactScore)}</Text> : null}
    {!noBuy && (!edit.data ? !enabled || edit.isLoading ? <CuratedItemRail editorial offers={[]} status="pending" heading="" context={{ targetKey: priorityIdentity(priority), surface: 'shop_overview' }} /> : <View style={styles.edit}>
      <Text style={styles.caption}>{edit.fetchStatus === 'paused' ? 'Connect to see pieces for this addition.' : 'Pieces are unavailable right now. Your styling guide is still here.'}</Text>
      <Pressable accessibilityRole="button" onPress={() => void edit.refetch()} style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}><Text style={styles.link}>Try again</Text></Pressable>
    </View> : target ? <CuratedItemRail editorial offers={target.offers ?? []} status={target.offerState?.status ?? 'empty'} heading="Shop this recommendation" reason={target.rationale} target={target} wardrobe={wardrobe} browserTitle={target.title} context={{ reference: edit.data.commerceReference, targetKey: target.key, surface: 'shop_overview' }} onRetry={() => void edit.refreshOffers()} /> : <Text style={styles.caption}>No suitable listings right now. Your wardrobe guidance is still here.</Text>)}
    <Pressable onPress={onGuide} accessibilityRole="button" accessibilityLabel={`View shopping guide: ${priority.label}`} style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}><Text style={styles.link}>View shopping guide →</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  overview: { gap: spacing.sm }, identity: { gap: spacing.md }, group: { gap: spacing.md }, label: { ...typography.text.label, color: colors.foreground }, pressed: { backgroundColor: colors.surfaceSelected },
  edit: { gap: spacing.md }, addition: { gap: spacing.xl, paddingVertical: spacing.xxl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  note: { ...typography.text.editorialSection, color: colors.foreground },
  start: { ...typography.text.caption, color: shoppingSurfaces.olive.accent },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.text.editorialCompact, color: colors.foreground, flex: 1 },
  reason: { ...typography.text.body, color: colors.inkSubtle },
  caption: { ...typography.text.caption, color: colors.mutedForeground },
  link: { ...typography.text.label, color: colors.action }, quiet: { minWidth: 44, minHeight: 44, justifyContent: 'center', flexShrink: 1 },
  anchors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, anchor: { width: 80, gap: spacing.xs }, thumbnail: { width: 64, aspectRatio: 0.8 },
  undo: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' },
  error: { ...typography.text.bodySmall, color: colors.error },
});
