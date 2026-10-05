import { useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";
import { track } from "../../lib/analytics";
import {
  humanizeInlineTokens,
  splitPriceRange,
  targetOutfitIdeas,
  type ShoppingPriorityTarget,
} from "../../lib/shoppingPriorityEdit";
import type { Item } from "../../types/item";
import {
  colors,
  radii,
  spacing,
  typography,
} from "../../theme";
import { SegmentedControl } from "../primitives/Editorial";
import { ShoppingStyleVisual } from "./ShoppingStyleVisual";
import { ShoppingOutfitPreview } from "./ShoppingOutfitPreview";
import { ShoppingRetailerLinks } from "./ShoppingRetailerLinks";
import { ShoppingOfferRail } from "./ShoppingOfferRail";

type Tab = "wear" | "details" | "shop";

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
  offerContext?: import("../../types/commerce").OfferContext;
  onRetryOffers?: () => void;
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
  offerContext,
  onRetryOffers,
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
        target.silhouette &&
          `Shape: ${humanizeInlineTokens(target.silhouette)}`,
      ].filter((note): note is string => !!note);
  const hasShop = !!(
    target.offerState ||
    offers.length ||
    target.productUrl ||
    target.retailerExamples?.length
  );
  const tabs: { value: Tab; label: string }[] = [
    ...(hasShop ? [{ value: "shop" as const, label: "Shop" }] : []),
    ...(looks.length ? [{ value: "wear" as const, label: "Wear it" }] : []),
    { value: "details" as const, label: "Details" },
  ];
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);
  const tab =
    chosenTab && tabs.some((t) => t.value === chosenTab)
      ? chosenTab
      : tabs[0].value;
  const selectTab = (next: Tab) => {
    if (next === tab) return;
    track("shopping_brief_tab_selected", { targetKey: target.key, tab: next });
    setChosenTab(next);
  };
  const toggle = () => {
    if (!expanded && !tracked.current) {
      tracked.current = true;
      track("shopping_brief_direction_expanded", {
        targetKey: target.key,
        index,
      });
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
        accessibilityLabel={`${title}. ${target.rationale}. ${price.compact ? `Suggested budget ${price.compact} ${price.currency ?? ""}.` : ""}`}
        accessibilityHint={
          expanded
            ? "Collapses this style"
            : "Shows pieces, outfit ideas, and shopping guidance"
        }
        style={({ pressed }) => [
          styles.summary,
          fontScale >= 1.5 && styles.largeSummary,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.visual, fontScale >= 1.5 && styles.largeVisual]}>
          <ShoppingStyleVisual target={target} />
        </View>
        <View style={[styles.headingBody, fontScale >= 1.5 && { flex: 0 }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy} numberOfLines={expanded ? undefined : 2}>
            {humanizeInlineTokens(target.rationale)}
          </Text>
          <View style={styles.footer}>
            {price.compact ? (
              <Text style={styles.price}>{price.compact}</Text>
            ) : (
              <View />
            )}
            <View style={styles.disclosure}>
              <Text style={styles.action}>
                {expanded
                  ? "Close"
                  : hasShop ? "Explore pieces" : "Style details"}
              </Text>
              <Animated.View
                style={{
                  transform: [{ rotate: expanded ? "180deg" : "0deg" }],
                  transitionProperty: "transform",
                  transitionDuration: reduceMotion ? 0 : 180,
                }}
              >
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={colors.inkSubtle}
                />
              </Animated.View>
            </View>
          </View>
        </View>
      </Pressable>
      {expanded ? (
        <Animated.View
          style={styles.body}
          entering={reduceMotion ? undefined : FadeIn.duration(150)}
        >
          {tabs.length > 1 ? (
            <SegmentedControl
              variant="tabs"
              value={tab}
              options={tabs}
              onChange={selectTab}
            />
          ) : null}
          <Animated.View
            key={tab}
            style={styles.panel}
            entering={reduceMotion ? undefined : FadeIn.duration(150)}
          >
            {tab === "wear"
              ? looks.map((look, i) => (
                  <ShoppingOutfitPreview
                    key={`${target.key}-${i}`}
                    look={look}
                    target={target}
                    wardrobe={wardrobe}
                  />
                ))
              : null}
            {tab === "details" ? (
              <>
                <Text style={styles.sectionTitle}>What to look for</Text>
                {notes.length ? (
                  <View style={styles.chips}>
                    {notes.map((note, i) => (
                      <View key={i} style={styles.chip}>
                        <Text selectable style={styles.chipText}>
                          {note}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.copy}>
                    {humanizeInlineTokens(target.rationale)}
                  </Text>
                )}
              </>
            ) : null}
            {tab === "shop" ? (
              <>
                {target.offerState || offers.length ? (
                  <ShoppingOfferRail
                    offers={offers}
                    status={target.offerState?.status}
                    context={offerContext}
                    onRetry={onRetryOffers}
                    targetKey={target.key}
                    targetTitle={target.title}
                    target={target}
                    wardrobe={wardrobe}
                  />
                ) : (
                  <ShoppingRetailerLinks target={target} />
                )}
                {!offers.length &&
                target.offerState &&
                target.offerState.status !== "pending" ? (
                  <ShoppingRetailerLinks target={target} />
                ) : null}
              </>
            ) : null}
          </Animated.View>
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
  summary: { flexDirection: "row", gap: spacing.lg },
  largeSummary: { flexDirection: "column" },
  pressed: { opacity: 0.7 },
  visual: { width: 112 },
  largeVisual: { width: 160 },
  headingBody: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  copy: { ...typography.text.bodySmall, color: colors.inkSubtle },
  footer: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  price: {
    ...typography.text.label,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  action: { ...typography.text.caption, color: colors.inkSubtle },
  disclosure: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  body: { paddingTop: spacing.lg, gap: spacing.lg },
  panel: { gap: spacing.lg },
  sectionTitle: { ...typography.text.eyebrow, color: colors.inkSubtle },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.controlOutline,
  },
  chipText: { ...typography.text.bodySmall, color: colors.foreground },
});
