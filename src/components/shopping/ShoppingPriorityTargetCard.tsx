import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { track } from '../../lib/analytics';
import {
  humanizeInlineTokens,
  splitPriceRange,
  targetOutfitIdeas,
  type ShoppingPriorityTarget,
} from '../../lib/shoppingPriorityEdit';
import type { Item } from '../../types/item';
import { colors, shoppingSurfaces, spacing, typography } from '../../theme';
import { ShoppingStyleVisual } from './ShoppingStyleVisual';
import { ShoppingOutfitPreview } from './ShoppingOutfitPreview';
import { ShoppingRetailerLinks } from './ShoppingRetailerLinks';
import { ShoppingOfferRail } from './ShoppingOfferRail';

type Props = {
  target: ShoppingPriorityTarget;
  index: number;
  wardrobe: ReadonlyMap<number, Item>;
  displayTitle?: string;
  isLast?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onSaveFind?: () => void;
};
export function ShoppingPriorityTargetCard({
  target,
  index,
  wardrobe,
  displayTitle,
  isLast,
  defaultExpanded = false,
  expanded: controlled,
  onToggle,
  onSaveFind,
}: Props) {
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const expanded = controlled ?? localExpanded;
  const tracked = useRef(false);
  const reduceMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const looks = targetOutfitIdeas(target).filter((look) =>
    look.itemIds.some((id) => wardrobe.has(id)),
  );
  const offers = target.offers ?? [];
  const price = splitPriceRange(target.priceRange);
  const title = displayTitle || target.title;
  const notes = target.shoppingNotes?.length
    ? target.shoppingNotes
    : [
        target.material && `Material: ${humanizeInlineTokens(target.material)}`,
        target.silhouette && `Shape: ${humanizeInlineTokens(target.silhouette)}`,
      ].filter((note): note is string => !!note);
  const toggle = () => {
    if (!expanded && !tracked.current) {
      tracked.current = true;
      track('shopping_brief_direction_expanded', { targetKey: target.key, index });
    }
    if (onToggle) onToggle();
    else setLocalExpanded(!expanded);
  };
  return (
    <Animated.View
      style={[styles.card, isLast && styles.last]}
      layout={reduceMotion ? undefined : LinearTransition.duration(200)}
    >
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}. ${target.editorialLabel ?? ''}. ${target.rationale}. ${price.compact ? `Suggested budget ${price.compact} ${price.currency ?? ''}.` : ''}`}
        accessibilityHint={
          expanded ? 'Collapses this style' : 'Shows outfit ideas and shopping guidance'
        }
        style={({ pressed }) => [
          styles.summary,
          fontScale >= 1.5 && styles.largeSummary,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.visual}>
          <ShoppingStyleVisual target={target} />
        </View>
        <View style={[styles.headingBody, fontScale >= 1.5 && { flex: 0 }]}>
          <Text style={styles.title}>{title}</Text>
          {target.editorialLabel ? (
            <Text style={styles.annotation}>{target.editorialLabel}</Text>
          ) : null}
          <Text style={styles.copy}>{humanizeInlineTokens(target.rationale)}</Text>
          {price.compact ? (
            <Text style={styles.budget}>
              Suggested budget {price.compact}
              {price.currency ? ` ${price.currency}` : ''}
            </Text>
          ) : null}
          <View style={styles.disclosure}>
            <Text style={styles.action}>
              {expanded ? 'Show less' : looks.length ? 'See how to wear it' : 'See style details'}
            </Text>
            <Animated.View
              style={{
                transform: [{ rotate: expanded ? '180deg' : '0deg' }],
                transitionProperty: 'transform',
                transitionDuration: reduceMotion ? 0 : 180,
              }}
            >
              <Ionicons name="chevron-down" size={16} color={colors.inkSubtle} />
            </Animated.View>
          </View>
        </View>
      </Pressable>
      {expanded ? (
        <Animated.View
          style={styles.body}
          entering={reduceMotion ? undefined : FadeIn.duration(150)}
        >
          {looks.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Wear it with</Text>
              {looks.map((look, i) => (
                <ShoppingOutfitPreview
                  key={`${target.key}-${i}`}
                  look={look}
                  target={target}
                  wardrobe={wardrobe}
                />
              ))}
            </View>
          ) : null}
          {notes.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What to look for</Text>
              {notes.map((note, i) => (
                <Text key={i} selectable style={styles.copy}>
                  {note}
                </Text>
              ))}
            </View>
          ) : null}
          {offers.length || target.productUrl || target.retailerExamples?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Where to look</Text>
              {offers.length ? (
                <ShoppingOfferRail
                  offers={offers}
                  targetKey={target.key}
                  targetTitle={target.title}
                />
              ) : (
                <ShoppingRetailerLinks target={target} />
              )}
            </View>
          ) : null}
          {onSaveFind ? (
            <Pressable
              onPress={onSaveFind}
              accessibilityRole="button"
              accessibilityLabel={`Found ${title}? Save it to your shortlist`}
              style={({ pressed }) => [styles.save, pressed && styles.pressed]}
            >
              <Text style={styles.action}>Found one? Save it to your shortlist →</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  last: { borderBottomWidth: 0 },
  summary: { flexDirection: 'row', gap: spacing.lg },
  largeSummary: { flexDirection: 'column' },
  pressed: { backgroundColor: colors.surfaceSelected },
  visual: { width: 64 },
  headingBody: { flex: 1, minWidth: 0, gap: spacing.sm },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  annotation: { ...typography.text.bodySmall, color: shoppingSurfaces.olive.accent },
  copy: { ...typography.text.body, color: colors.inkSubtle },
  budget: { ...typography.text.bodySmall, color: colors.foreground },
  action: { ...typography.text.label, color: shoppingSurfaces.olive.accent },
  disclosure: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  body: { paddingTop: spacing.xl, gap: spacing.xxl },
  section: { gap: spacing.md },
  sectionTitle: { ...typography.text.label, color: colors.foreground },
  save: { minHeight: 44, justifyContent: 'center' },
});
