import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shoppingSurfaces, spacing, typography } from '../../theme';
import type { ShoppingBrief, ShoppingBriefPriority } from '../../lib/shopDecisionWorkspace';
import type { Item } from '../../types/item';
import { focusedPriority, previewTarget, priorityIdentity } from '../../lib/shopFocusedEdit';
import { shoppingGarmentTitle } from '../../lib/shoppingEditorial';
import { withoutOutfitCount } from '../../lib/shopClarity';
import { toLocalDateKey } from '../../lib/dailyStylistPick';
import { track } from '../../lib/analytics';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { useShoppingFeedback } from '../../hooks/useShoppingFeedback';
import { CuratedItemRail } from './CuratedItemRail';

export function ShopWardrobeEdit({ brief, wardrobe, onGuide, onBrief }: {
  brief: ShoppingBrief; wardrobe: ReadonlyMap<number, Item>;
  onGuide: (priority: ShoppingBriefPriority) => void; onBrief: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const feedback = useShoppingFeedback();
  const selected = focusedPriority(brief.priorities, selectedKey);
  const key = selected ? priorityIdentity(selected) : null;
  useEffect(() => { if (key !== selectedKey) setSelectedKey(key); }, [key, selectedKey]);
  const localDate = brief.localDate ?? toLocalDateKey(new Date());
  const pending = feedback.pending.filter(entry => entry.localDate === localDate && !entry.submitting);
  return <View style={styles.edit}>
    {brief.priorities.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selector} accessibilityRole="tablist">
      {[...brief.priorities].sort((a, b) => a.priority - b.priority).map(priority => <Pressable key={priorityIdentity(priority)} onPress={() => { setSelectedKey(priorityIdentity(priority)); track('shop_edit_priority_selected', { category: priority.category, rank: priority.priority }); }} accessibilityRole="tab" accessibilityState={{ selected: key === priorityIdentity(priority) }} style={[styles.choice, key === priorityIdentity(priority) && styles.chosen]}>
        <Text style={[styles.choiceText, key === priorityIdentity(priority) && styles.chosenText]}>{shoppingGarmentTitle(priority.label)}</Text>
      </Pressable>)}
    </ScrollView> : null}
    {pending.map(entry => <View key={entry.id} style={styles.undo} accessibilityLiveRegion="polite"><Text style={styles.caption}>Suggestion hidden</Text><Pressable accessibilityRole="button" accessibilityLabel={`Undo hiding ${entry.label}`} onPress={() => feedback.undo(entry.id)} style={styles.quiet}><Text style={styles.link}>Undo</Text></Pressable></View>)}
    {feedback.error ? <Text accessibilityRole="alert" style={styles.error}>{feedback.error}</Text> : null}
    {selected ? <>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>{shoppingGarmentTitle(selected.label)}</Text>
        {selected.recommendationKey ? <Pressable accessibilityRole="button" accessibilityLabel={`Not now: ${selected.label}`} onPress={() => feedback.dismiss({ recommendationKey: selected.recommendationKey!, localDate, feedbackReason: 'not_relevant_now', label: selected.label })} style={styles.quiet}><Text style={styles.caption}>Not now</Text></Pressable> : null}
      </View>
      <FocusedShoppingPreview key={`${key}:${brief.generatedAt}`} priority={selected} briefGeneratedAt={brief.generatedAt} wardrobe={wardrobe} />
      <View style={styles.footer}>
        <Pressable onPress={() => onGuide(selected)} accessibilityRole="button" accessibilityLabel={`Explore the guide: ${selected.label}`} style={styles.quiet}><Text style={styles.link}>Explore the guide →</Text></Pressable>
        <Pressable onPress={onBrief} accessibilityRole="button" style={styles.quiet}><Text style={styles.caption}>Read your brief</Text></Pressable>
      </View>
    </> : <><Text style={styles.reason}>{brief.summary}</Text><Pressable onPress={onBrief} accessibilityRole="button" style={styles.quiet}><Text style={styles.link}>Read your brief →</Text></Pressable></>}
  </View>;
}

function FocusedShoppingPreview({ priority, briefGeneratedAt, wardrobe }: { priority: ShoppingBriefPriority; briefGeneratedAt: string; wardrobe: ReadonlyMap<number, Item> }) {
  const edit = useShoppingPriorityEdit(priority, { origin: 'shopping_brief', briefGeneratedAt, purpose: 'preview' });
  const target = previewTarget(edit.data?.targets ?? []);
  if (edit.data?.status === 'no_buy') return <Text style={styles.caption}>{edit.data.noBuyReason ?? 'Your wardrobe already covers this addition.'}</Text>;
  if (!edit.data) return <View style={styles.edit}>
    <Text selectable style={styles.reason} numberOfLines={3}>{withoutOutfitCount(priority.context, priority.impactScore)}</Text>
    {edit.isLoading ? <CuratedItemRail offers={[]} status="pending" heading="" context={{ targetKey: priorityIdentity(priority), surface: 'shop_overview' }} /> : <>
      <Text style={styles.caption}>{edit.fetchStatus === 'paused' ? 'Connect to see pieces for this addition.' : 'Pieces are unavailable right now. You can still explore your guide.'}</Text>
      <Pressable accessibilityRole="button" onPress={() => void edit.refetch()} style={styles.quiet}><Text style={styles.link}>Try again</Text></Pressable>
    </>}
  </View>;
  if (!target) return <Text style={styles.caption}>No suitable listings right now. Your wardrobe guidance is still here.</Text>;
  return <View style={styles.edit}>
    <Text selectable style={styles.reason} numberOfLines={3}>{withoutOutfitCount(target.rationale || priority.context, priority.impactScore)}</Text>
    <CuratedItemRail offers={target.offers ?? []} status={target.offerState?.status ?? 'empty'} heading="" reason={target.rationale} target={target} wardrobe={wardrobe} browserTitle={target.title} context={{ reference: edit.data.commerceReference, targetKey: target.key, surface: 'shop_overview' }} onRetry={() => void edit.refreshOffers()} />
  </View>;
}

const styles = StyleSheet.create({
  edit: { gap: spacing.md }, selector: { gap: spacing.sm, paddingBottom: spacing.xs },
  choice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: shoppingSurfaces.bone },
  chosen: { backgroundColor: shoppingSurfaces.olive.wash },
  choiceText: { ...typography.text.caption, color: colors.inkSubtle }, chosenText: { color: shoppingSurfaces.olive.accent, fontWeight: typography.weight.semibold },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.text.editorialCompact, color: colors.foreground, flex: 1 },
  reason: { ...typography.text.bodySmall, color: colors.inkSubtle },
  caption: { ...typography.text.caption, color: colors.mutedForeground },
  link: { ...typography.text.label, color: colors.action }, quiet: { minHeight: 44, justifyContent: 'center', flexShrink: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  undo: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' },
  error: { ...typography.text.bodySmall, color: colors.error },
});
