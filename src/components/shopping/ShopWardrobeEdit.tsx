import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../primitives/PressableScale';
import { colors, radii, shoppingSurfaces, spacing, typography } from '../../theme';
import { BriefNote, briefIssueLabel } from './ShoppingBriefCard';
import type { ShoppingBrief, ShoppingBriefPriority } from '../../lib/shopDecisionWorkspace';
import { previewTarget, priorityIdentity } from '../../lib/shopFocusedEdit';
import { shoppingGarmentTitle } from '../../lib/shoppingEditorial';
import { withoutOutfitCount } from '../../lib/shopClarity';
import { toLocalDateKey } from '../../lib/dailyStylistPick';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { useShoppingFeedback } from '../../hooks/useShoppingFeedback';
import type { ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import { ShoppingChapterContents } from './ShoppingChapterContents';

// The Shop page in two parts: the stylist's brief, then today's additions.
// Each addition's full styling and shopping lives on its own guide page.
/** The edit's additions in order, minus any the user just set aside with "Not now". */
export function useVisibleEditPriorities(brief: ShoppingBrief | undefined) {
  const feedback = useShoppingFeedback();
  const localDate = brief?.localDate ?? toLocalDateKey(new Date());
  const hiddenKeys = new Set(feedback.pending.filter(entry => entry.localDate === localDate).map(entry => entry.recommendationKey));
  const priorities = [...(brief?.priorities ?? [])].filter(priority => !priority.recommendationKey || !hiddenKeys.has(priority.recommendationKey)).sort((a, b) => a.priority - b.priority);
  return { feedback, localDate, priorities };
}

export function ShopWardrobeEdit({ brief, onGuide, onShopAll }: {
  brief: ShoppingBrief;
  onGuide: (priority: ShoppingBriefPriority) => void;
  /** Every listing across the edit on one page, without the commentary. */
  onShopAll?: () => void;
}) {
  const { feedback, localDate, priorities } = useVisibleEditPriorities(brief);
  const pending = feedback.pending.filter(entry => entry.localDate === localDate && !entry.submitting);
  const [previews, setPreviews] = useState<Record<string, ShoppingPriorityTarget>>({});
  // Query results may be rebuilt each render, so compare what the thumbnail
  // shows rather than object identity — otherwise this loops.
  const reportTarget = useCallback((key: string, target: ShoppingPriorityTarget) => setPreviews(old => {
    const current = old[key];
    if (current && current.key === target.key && previewImage(current) === previewImage(target)) return old;
    return { ...old, [key]: target };
  }), []);
  const stage = (index: number) => index === 0 ? 'Start here' : index === 1 ? 'Next priority' : 'Also consider';
  const summary = brief.priorities.reduce((text, priority) => withoutOutfitCount(text, priority.impactScore), brief.summary);
  return <View style={styles.edit}>
    {summary ? <View style={styles.briefPanel}>
      <Text style={styles.kicker} accessibilityRole="header">Your shopping brief</Text>
      <BriefNote text={summary} full />
    </View> : null}
    <View style={styles.overview}>
      <Text style={styles.issue}>{briefIssueLabel(brief)}</Text>
      <Text accessibilityRole="header" style={styles.note}>{priorities.length === 0 ? 'Your wardrobe is covered for now' : `${['', 'One', 'Two', 'Three', 'Four', 'Five'][priorities.length] ?? priorities.length} ${priorities.length === 1 ? 'addition' : 'additions'} to consider`}</Text>
    </View>
    <ShoppingChapterContents
      entries={priorities.map((priority, index) => ({
        key: priorityIdentity(priority), title: shoppingGarmentTitle(priority.label), detail: stage(index), target: previews[priorityIdentity(priority)],
        onDismiss: priority.recommendationKey ? () => feedback.dismiss({ recommendationKey: priority.recommendationKey!, localDate, feedbackReason: 'not_relevant_now', label: priority.label }) : undefined,
      }))}
      onSelect={key => { const priority = priorities.find(entry => priorityIdentity(entry) === key); if (priority) onGuide(priority); }}
    />
    {onShopAll && priorities.length ? <PressableScale
      motion="crisp"
      scaleTo={0.985}
      contentStyle={styles.shopAll}
      onPress={onShopAll}
      accessibilityRole="button"
      accessibilityLabel="Shop all"
      accessibilityHint="Shows every suggested piece in the edit on one page"
    >
      <Ionicons name="grid-outline" size={15} color={colors.primaryForeground} />
      <Text style={styles.shopAllLabel}>Shop all</Text>
    </PressableScale> : null}
    {pending.map(entry => <View key={entry.id} style={styles.undo} accessibilityLiveRegion="polite"><Text style={styles.caption}>Suggestion hidden</Text><Pressable accessibilityRole="button" accessibilityLabel={`Undo hiding ${entry.label}`} onPress={() => feedback.undo(entry.id)} style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}><Text style={styles.link}>Undo</Text></Pressable></View>)}
    {feedback.error ? <Text accessibilityRole="alert" style={styles.error}>{feedback.error}</Text> : null}
    {priorities.map(priority => <PreviewProbe key={`${priorityIdentity(priority)}:${brief.generatedAt}`} priority={priority} briefGeneratedAt={brief.generatedAt} onTarget={reportTarget} />)}
  </View>;
}

function previewImage(target: ShoppingPriorityTarget) {
  return target.offers?.find(offer => offer.imageUrl)?.imageUrl ?? target.imageUrl ?? '';
}

// Fetches the same preview the guide opens with, only to give the row its picture.
function PreviewProbe({ priority, briefGeneratedAt, onTarget }: {
  priority: ShoppingBriefPriority; briefGeneratedAt: string; onTarget: (key: string, target: ShoppingPriorityTarget) => void;
}) {
  const edit = useShoppingPriorityEdit(priority, { origin: 'shopping_brief', briefGeneratedAt, purpose: 'preview', enabled: true });
  const target = previewTarget(edit.data?.targets ?? []);
  const identity = priorityIdentity(priority);
  useEffect(() => { if (target) onTarget(identity, target); }, [identity, onTarget, target?.key, target && previewImage(target)]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const styles = StyleSheet.create({
  overview: { gap: spacing.sm, marginTop: spacing.lg }, pressed: { opacity: 0.6 },
  edit: { gap: spacing.md },
  briefPanel: { padding: spacing.lg, gap: spacing.sm, borderRadius: radii.md, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: shoppingSurfaces.bone },
  kicker: { ...typography.text.meta, color: shoppingSurfaces.olive.accent },
  issue: { ...typography.text.meta, color: colors.mutedForeground },
  note: { ...typography.text.editorialTitle, color: colors.foreground },
  caption: { ...typography.text.caption, color: colors.mutedForeground },
  link: { ...typography.text.label, color: shoppingSurfaces.olive.accent }, quiet: { minWidth: 44, minHeight: 44, justifyContent: 'center', flexShrink: 1 },
  undo: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' },
  error: { ...typography.text.bodySmall, color: colors.error },
  // The section's one filled control, in the Shop espresso: full width so it
  // closes the list as "all of the above" rather than reading as another row.
  shopAll: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: shoppingSurfaces.espresso,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: shoppingSurfaces.highlight,
    boxShadow: shoppingSurfaces.buttonShadow,
  },
  shopAllLabel: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground, letterSpacing: 0.2 },
});
