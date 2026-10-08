import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { CuratedItemRail } from '../../components/shopping/CuratedItemRail';
import { briefIssueLabel, sentenceCase } from '../../components/shopping/ShoppingBriefCard';
import { useVisibleEditPriorities } from '../../components/shopping/ShopWardrobeEdit';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useItems } from '../../hooks/useItems';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { wearableWardrobe } from '../../lib/shopClarity';
import type { ShoppingBriefPriority } from '../../lib/shopDecisionWorkspace';
import type { Item } from '../../types/item';
import { colors, shoppingSurfaces, spacing, typography } from '../../theme';
import type { ShoppingEditAllScreenProps } from '../../navigation/types';

/**
 * "Shop all": every listing the day's edit surfaces, on one quiet page —
 * no stylist note, no rationale, no criteria. Each priority keeps only a
 * numbered label so the grid still reads in the edit's order. Listings come
 * from the same per-priority guide queries as ShoppingPriorityEditScreen, so
 * opening a guide afterwards (or before) is served from cache.
 */
export function ShoppingEditAllScreen({ navigation }: ShoppingEditAllScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPremium } = useEntitlement();
  const brief = useShoppingBrief(isPremium);
  const { data: items = [] } = useItems();
  const wardrobe = useMemo(() => wearableWardrobe(items), [items]);
  const { priorities } = useVisibleEditPriorities(brief.data);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        <ShopSubpageHeader
          eyebrow={briefIssueLabel(brief.data).toUpperCase()}
          eyebrowTrailing={priorities.length ? `${priorities.length} ${priorities.length === 1 ? 'piece' : 'pieces'}` : undefined}
          editorialSize
          title="Shop the edit"
          onBack={() => navigation.goBack()}
          style={styles.header}
        />
        {brief.data && brief.data.generatedAt ? priorities.map((priority, index) => (
          <PrioritySection
            key={`${priority.priority}-${priority.label}`}
            priority={priority}
            index={index}
            briefGeneratedAt={brief.data!.generatedAt}
            wardrobe={wardrobe}
          />
        )) : null}
        {!brief.isLoading && !priorities.length ? (
          <Text style={styles.empty}>Nothing to shop in today’s edit.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function PrioritySection({ priority, index, briefGeneratedAt, wardrobe }: {
  priority: ShoppingBriefPriority;
  index: number;
  briefGeneratedAt: string;
  wardrobe: ReadonlyMap<number, Item>;
}) {
  const reduceMotion = useReducedMotion();
  const edit = useShoppingPriorityEdit(priority, { origin: 'shopping_brief', briefGeneratedAt });
  const label = sentenceCase(priority.label);
  const data = edit.data?.status === 'ready' ? edit.data : undefined;
  const total = data?.targets.reduce((sum, target) => sum + (target.offers?.length ?? 0), 0) ?? 0;

  // Covered on a closer look: the guide says skip it, so there's nothing to shop.
  if (edit.data?.status === 'no_buy') return null;

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(index * 80).duration(320)} style={styles.section}>
      <View style={styles.sectionHead} accessibilityRole="header">
        <Text style={styles.numeral}>{String(index + 1).padStart(2, '0')}</Text>
        <Text style={styles.sectionTitle} numberOfLines={2}>{label}</Text>
        {total ? <Text style={styles.count}>{total}</Text> : null}
      </View>
      {data ? data.targets.map(target => {
        const offers = target.offers ?? [];
        return (
          // One swipeable row per style, in the guide's own chapters and order.
          <View key={target.key} style={styles.style}>
            <View style={styles.styleHead}>
              <Text style={styles.styleTitle} numberOfLines={1}>{target.title}</Text>
              {offers.length ? <Text style={styles.count}>{offers.length}</Text> : null}
            </View>
            <CuratedItemRail
              compact
              editorial
              heading=""
              collectionAction="external"
              previewLimit={Math.max(1, offers.length)}
              offers={offers}
              status={target.offerState?.status ?? (offers.length ? 'ready' : 'empty')}
              browserTitle={target.title}
              reason={target.rationale}
              target={target}
              wardrobe={wardrobe}
              context={{ reference: data.commerceReference, targetKey: target.key, surface: 'shopping_guide' }}
              onRetry={() => void edit.refreshOffers()}
            />
          </View>
        );
      }) : (
        <CuratedItemRail
          compact
          heading=""
          offers={[]}
          status={edit.isError ? 'unavailable' : 'pending'}
          context={{ targetKey: `edit-all-${priority.category}`, surface: 'shopping_guide' }}
          onRetry={() => void edit.refetch()}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: shoppingSurfaces.canvas },
  content: { paddingHorizontal: spacing.page, gap: spacing.xxl },
  header: { marginHorizontal: -spacing.page, paddingHorizontal: spacing.page },
  section: { gap: spacing.xl },
  style: { gap: spacing.md },
  styleHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  styleTitle: { ...typography.text.meta, flex: 1, color: colors.inkSubtle },
  // The edit's own grammar — olive numeral, sentence-case label — set as a
  // hairline-ruled running head rather than a chapter opener.
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  numeral: { ...typography.text.meta, color: shoppingSurfaces.olive.accent, fontVariant: ['tabular-nums'] },
  sectionTitle: { ...typography.text.editorialCompact, flex: 1, color: colors.foreground },
  count: { ...typography.text.meta, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  empty: { ...typography.text.bodySmall, color: colors.mutedForeground },
});
