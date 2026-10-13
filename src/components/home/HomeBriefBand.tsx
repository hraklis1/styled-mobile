import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { EditorialSection } from '../primitives/Editorial';
import { PressableScale } from '../primitives/PressableScale';
import { Ionicons } from '@expo/vector-icons';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { colors, spacing } from '../../theme';
import { AppText } from '../primitives/AppText';
import { homeShoppingExplanation, homePriorityTitle } from '../../lib/homePresentationCopy';
import { garmentFriendlyContentFit } from '../../lib/shoppingPresentation';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';
import type { ShoppingBriefPriority } from '../../lib/shopDecisionWorkspace';
import { withoutOutfitCount } from '../../lib/shopClarity';
import { useItems } from '../../hooks/useItems';

const PRIORITY_LIMIT = 3;
const STRIP_LIMIT = 4;
const STRIP_GAP = spacing.sm;

type Props = {
  onBriefPress: () => void;
  onPriorityPress: (priority: ShoppingBriefPriority, briefGeneratedAt: string) => void;
  onShopPress: () => void;
  kicker?: string;
  style?: StyleProp<ViewStyle>;
};

/** One thumb per distinct photo: several finds are often shot together. */
function distinctFinds(items: ShoppingEditItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const uri = item.primarySnap.imageUri;
    if (seen.has(uri)) return false;
    seen.add(uri);
    return true;
  });
}

/**
 * Home's window into Shop: the stylist's brief on the wardrobe's gaps, with
 * its suggested additions. The user's own shortlist is a separate section
 * (`HomeShortlist`) because it is their picks, not the stylist's advice.
 *
 * Home fetches the brief itself rather than waiting for Shop to populate the
 * cache, so a premium user sees it on the first screen of the day without
 * having to visit Shop first. The generation is cheap enough to justify
 * that: `stylist_light` (gpt-4.1-mini), ~450 output tokens, metered at 0
 * credits. Repeat opens rarely reach the model — this shares
 * `SHOPPING_BRIEF_QUERY_KEY` with Shop, and the server caches each brief for
 * 24h keyed by day plus a wardrobe/event snapshot.
 *
 * Gated on `isPremium` because the brief route is premium-only and would
 * otherwise 403 on every Home mount for free users.
 */
export function HomeWardrobeEdit({ onBriefPress, onPriorityPress, onShopPress, kicker, style }: Props) {
  const { data: items = [] } = useItems();
  const { isPremium } = useEntitlement();
  const { data: brief } = useShoppingBrief(isPremium);
  const ready = !!brief && brief.status !== 'insufficient_data';
  const priorities = ready ? brief.priorities.slice(0, PRIORITY_LIMIT) : [];
  const note = ready
    ? brief.priorities.reduce((text, priority) => withoutOutfitCount(text, priority.impactScore), brief.summary).trim()
    : '';
  const hasBrief = !!note || priorities.length > 0;

  if (!hasBrief) return null;

  return (
    <EditorialSection
      variant="ruled"
      headingStyle="supporting"
      dividerPlacement="none"
      kicker={kicker}
      title="The Edit"
      description="Gaps in your wardrobe, and what fills them."
      actionLabel="Shop"
      onAction={onShopPress}
      style={style}
    >
      <View style={styles.sheet}>
        <View style={styles.brief}>
          {/* The stylist's read of the wardrobe leads, in its own voice. */}
          {note ? (
            <PressableScale
              haptic={false}
              scaleTo={0.99}
              motion="crisp"
              contentStyle={styles.note}
              onPress={onBriefPress}
              accessibilityRole="button"
              accessibilityLabel={`From your stylist: ${note}. Open the full edit in Shop`}
            >
              <AppText variant="editorialItalic" tone="primary" style={styles.noteText} numberOfLines={4}>{note}</AppText>
            </PressableScale>
          ) : null}
          {priorities.length > 0 ? (
            <View style={styles.additions}>
              <AppText variant="masthead" tone="muted" style={[styles.eyebrow, styles.additionsLabel]}>
                {priorities.length === 1 ? 'Suggested addition' : 'Suggested additions'}
              </AppText>
              {priorities.map((priority, index) => {
                const title = homePriorityTitle(priority.label);
                const why = homeShoppingExplanation(priority, items);
                return (
                  <PressableScale
                    key={priority.recommendationKey ?? priority.label}
                    haptic={false}
                    scaleTo={0.99}
                    motion="crisp"
                    contentStyle={[styles.addition, index > 0 && styles.additionRuled]}
                    onPress={() => onPriorityPress(priority, brief!.generatedAt)}
                    accessibilityRole="button"
                    accessibilityLabel={`${title}. ${why}. Open the guide`}
                  >
                    <AppText variant="masthead" tone="muted" style={styles.additionIndex}>
                      {String(index + 1).padStart(2, '0')}
                    </AppText>
                    <View style={styles.additionCopy}>
                      <AppText variant="editorialCard" tone="primary" numberOfLines={1}>{title}</AppText>
                      {why ? <AppText variant="meta" tone="secondary" numberOfLines={1}>{why}</AppText> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} style={styles.additionChevron} />
                  </PressableScale>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </EditorialSection>
  );
}

/** The user's saved finds still waiting on a decision; absent when empty. */
export function HomeShortlist({ items, onPress, kicker, style }: {
  items: ShoppingEditItem[];
  onPress: () => void;
  kicker?: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (items.length === 0) return null;
  const finds = distinctFinds(items);
  const shown = finds.slice(0, finds.length > STRIP_LIMIT ? STRIP_LIMIT - 1 : STRIP_LIMIT);
  const remaining = items.length - shown.length;

  return (
    <EditorialSection
      variant="ruled"
      headingStyle="supporting"
      dividerPlacement="none"
      kicker={kicker}
      title="Your Shortlist"
      description={`${items.length} saved piece${items.length === 1 ? '' : 's'}, waiting on a yes or no.`}
      actionLabel="Decide"
      onAction={onPress}
      style={style}
    >
      <PressableScale
        haptic={false}
        scaleTo={0.99}
        motion="crisp"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Your shortlist. ${items.length} saved find${items.length === 1 ? '' : 's'} waiting on a decision. Opens your shortlist in Shop`}
      >
        <View style={styles.thumbs}>
          {shown.map((item) => (
            <View key={item.id} style={styles.thumb}>
              <Image
                source={{ uri: item.primarySnap.imageUri }}
                style={StyleSheet.absoluteFill}
                contentFit={garmentFriendlyContentFit(item.primarySnap)}
                cachePolicy="memory-disk"
                recyclingKey={item.primarySnap.id}
                transition={180}
              />
            </View>
          ))}
          {remaining > 0 ? (
            <View style={[styles.thumb, styles.moreThumb]}>
              <AppText variant="editorialSection" tone="primary">+{remaining}</AppText>
            </View>
          ) : null}
          {/* Keeps thumbs a fixed width when the strip is short. */}
          {Array.from({ length: Math.max(0, STRIP_LIMIT - shown.length - (remaining > 0 ? 1 : 0)) }).map((_, index) => (
            <View key={`spacer-${index}`} style={styles.thumbSpacer} />
          ))}
        </View>
      </PressableScale>
    </EditorialSection>
  );
}

const styles = StyleSheet.create({
  // The page's one card material: a linen sheet, no outline.
  sheet: {
    backgroundColor: colors.linen,
    borderRadius: 16,
    overflow: 'hidden',
  },
  brief: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: spacing.sm },
  note: { paddingBottom: spacing.lg },
  eyebrow: { fontSize: 10, letterSpacing: 2 },
  noteText: { fontSize: 16, lineHeight: 23 },
  additions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  additionsLabel: { marginBottom: spacing.xs },
  addition: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm },
  additionRuled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  // Small tracked index on the title's first line, like a contents page.
  additionIndex: { width: 22, marginTop: 5, fontSize: 10, letterSpacing: 1, fontVariant: ['tabular-nums'] },
  additionChevron: { alignSelf: 'center' },
  additionCopy: { flex: 1, gap: 2 },
  thumbs: { flexDirection: 'row', gap: STRIP_GAP },
  thumb: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.linen,
  },
  moreThumb: { alignItems: 'center', justifyContent: 'center' },
  thumbSpacer: { flex: 1 },
});
