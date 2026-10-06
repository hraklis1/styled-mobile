import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { View as ViewType } from 'react-native';
import { Image } from 'expo-image';
import Animated, { ZoomIn, useAnimatedStyle, useReducedMotion, withSpring } from 'react-native-reanimated';
import type { ShoppingVisitPreview } from '../../stores/useShoppingSessionStore';
import { cameraColors, colors, radii, spacing, typography } from '../../theme';

export type CaptureStack = { groupId: string; previews: ShoppingVisitPreview[] };

export function buildCaptureStacks(previews: ShoppingVisitPreview[]): CaptureStack[] {
  const stacks: CaptureStack[] = [];
  const byGroup = new Map<string, CaptureStack>();
  for (const preview of previews) {
    const existing = byGroup.get(preview.captureGroupId);
    if (existing) existing.previews.push(preview);
    else {
      const stack = { groupId: preview.captureGroupId, previews: [preview] };
      byGroup.set(stack.groupId, stack);
      stacks.push(stack);
    }
  }
  return stacks;
}

export function stackCover(stack: CaptureStack): ShoppingVisitPreview {
  return stack.previews.find((preview) => preview.captureRole === 'garment') ?? stack.previews[0];
}

// Tiles carry their own metadata instead of caption lines beneath them, so the
// rail stays one thumbnail tall and the viewfinder above keeps the space. The
// item number is the only numeral; how many photos an item holds is read from
// the cards fanned out behind it.

/** Lifts the item the next photo will join so it reads as "selected" at a
 *  glance, not just by its thin border. */
function ActiveLift({ active, children }: { active: boolean; children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const spring = { damping: 16, stiffness: 220 };
    const scale = active ? 1.1 : 1;
    const lift = active ? -4 : 0;
    return {
      transform: [
        { translateY: reducedMotion ? lift : withSpring(lift, spring) },
        { scale: reducedMotion ? scale : withSpring(scale, spring) },
      ],
    };
  }, [active, reducedMotion]);
  return <Animated.View style={[style, active && styles.lifted]}>{children}</Animated.View>;
}
export function CaptureStackRail({ stacks, priceLabels, activeGroupId, showEmptyItem, disabled, onSelect, registerDropTarget, dropTargetKey }: {
  stacks: CaptureStack[];
  /** Per item, the price read so far ("$90"), "?" when it needs a tap, or nothing. */
  priceLabels?: Map<string, string | null>;
  activeGroupId: string | null;
  showEmptyItem: boolean;
  disabled: boolean;
  onSelect: (groupId: string | null) => void;
  /** Hands the screen each tile's view (keyed by group id, or 'empty') so a
   *  dragged photo can be hit-tested against it. */
  registerDropTarget?: (key: string, view: ViewType | null) => void;
  /** The tile a dragged photo is hovering, drawn as a drop highlight. */
  dropTargetKey?: string | null;
}) {
  const rail = useRef<ScrollView>(null);
  const positions = useRef(new Map<string, number>());
  const reducedMotion = useReducedMotion();
  const activeKey = stacks.some((stack) => stack.groupId === activeGroupId) ? activeGroupId! : 'empty';
  const revealActive = useCallback(() => rail.current?.scrollTo({
    x: Math.max(0, (positions.current.get(activeKey) ?? 0) - 16), animated: !reducedMotion,
  }), [activeKey, reducedMotion]);
  useEffect(() => {
    const frame = requestAnimationFrame(revealActive);
    return () => cancelAnimationFrame(frame);
  }, [revealActive]);

  return (
    <ScrollView ref={rail} horizontal showsHorizontalScrollIndicator={false}
      style={styles.viewport} contentContainerStyle={styles.rail} onContentSizeChange={revealActive}>
      {stacks.map((stack, index) => {
        const active = stack.groupId === activeGroupId;
        const cover = stackCover(stack);
        const multi = stack.previews.length > 1;
        const priceLabel = priceLabels?.get(stack.groupId) ?? null;
        const dropping = dropTargetKey === stack.groupId;
        return (
          <Animated.View key={stack.groupId} entering={reducedMotion ? undefined : ZoomIn.duration(220)}>
            <ActiveLift active={active}>
            <TouchableOpacity disabled={disabled} onPress={() => onSelect(stack.groupId)}
              ref={(view) => registerDropTarget?.(stack.groupId, view)}
              onLayout={(event) => positions.current.set(stack.groupId, event.nativeEvent.layout.x)}
              style={styles.item} accessibilityRole="button" accessibilityState={{ selected: active, disabled }}
              accessibilityLabel={`Item ${index + 1}, ${stack.previews.length} photo${stack.previews.length === 1 ? '' : 's'}${priceLabel === '?' ? ', confirm price' : priceLabel ? `, ${priceLabel}` : ''}`}
              accessibilityHint="Select this item to add photos">
              {stack.previews.length > 2 ? <View style={[styles.card, styles.cardBack]} /> : null}
              {multi ? <View style={[styles.card, styles.cardMid]} /> : null}
              <View style={[styles.frame, active && styles.activeFrame, dropping && styles.dropFrame]}>
                <Image source={{ uri: cover.previewUri ?? cover.localFileUri }} style={styles.cover} contentFit="cover" />
                {priceLabel ? (
                  <View style={styles.pricePill}>
                    <Text style={styles.priceText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{priceLabel}</Text>
                  </View>
                ) : null}
              </View>
              <View style={[styles.numBadge, active && styles.numBadgeActive]}>
                <Text style={[styles.numText, active && styles.numTextActive]}>{index + 1}</Text>
              </View>
            </TouchableOpacity>
            </ActiveLift>
          </Animated.View>
        );
      })}
      {showEmptyItem && (
        <ActiveLift active={activeKey === 'empty'}>
        <TouchableOpacity disabled={disabled} onPress={() => onSelect(null)} style={styles.item}
          ref={(view) => registerDropTarget?.('empty', view)}
          onLayout={(event) => positions.current.set('empty', event.nativeEvent.layout.x)}
          accessibilityRole="button" accessibilityState={{ selected: activeKey === 'empty', disabled }}
          accessibilityLabel={`New item ${stacks.length + 1}, empty`}>
          <View style={[styles.frame, styles.emptyFrame, activeKey === 'empty' && styles.activeFrame, dropTargetKey === 'empty' && styles.dropFrame]}>
            <Text style={styles.plus}>+</Text>
          </View>
          <View style={[styles.numBadge, activeKey === 'empty' && styles.numBadgeActive]}>
            <Text style={[styles.numText, activeKey === 'empty' && styles.numTextActive]}>{stacks.length + 1}</Text>
          </View>
        </TouchableOpacity>
        </ActiveLift>
      )}
    </ScrollView>
  );
}

const FRAME_W = 52;
const FRAME_H = 68;

const styles = StyleSheet.create({
  viewport: { width: '100%', flexGrow: 0 },
  rail: { flexGrow: 1, justifyContent: 'center', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  // Padding leaves room for the number badge (top-left) and the offset cards
  // (top-right) so neither is clipped by the scroll view.
  item: { paddingTop: 6, paddingLeft: 6, paddingRight: 6, position: 'relative' },
  frame: { width: FRAME_W, height: FRAME_H, borderWidth: 1.5, borderColor: 'transparent', borderRadius: radii.photo, borderCurve: 'continuous', overflow: 'hidden' },
  activeFrame: { borderColor: cameraColors.selection, borderWidth: 2, backgroundColor: cameraColors.selectionSubtle },
  lifted: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  dropFrame: { borderColor: cameraColors.onCamera, borderWidth: 2, transform: [{ scale: 1.08 }] },
  cover: { width: '100%', height: '100%' },
  card: { position: 'absolute', top: 6, left: 6, width: FRAME_W, height: FRAME_H, borderRadius: radii.photo, borderCurve: 'continuous' },
  // Real card edges, not tints: each sits a few points up and right of the
  // one in front, with a hairline so it reads as paper against the dark rail.
  cardMid: { transform: [{ translateX: 3 }, { translateY: -3 }], backgroundColor: '#5B5751', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 252, 247, 0.45)' },
  cardBack: { transform: [{ translateX: 6 }, { translateY: -6 }], backgroundColor: '#3E3B37', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 252, 247, 0.28)' },
  emptyFrame: { alignItems: 'center', justifyContent: 'center', backgroundColor: cameraColors.controlSubtle },
  plus: { color: cameraColors.onCamera, fontSize: 28, fontWeight: '300' },
  numBadge: { position: 'absolute', top: 0, left: 0, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: cameraColors.onCamera },
  numBadgeActive: { backgroundColor: colors.primary },
  numText: { ...typography.text.caption, fontSize: 11, lineHeight: 13, fontWeight: typography.weight.semibold, color: cameraColors.backdrop, fontVariant: ['tabular-nums'] },
  numTextActive: { color: cameraColors.onCamera },
  // Sits on the bottom edge inside the frame so the rail stays one thumbnail tall.
  pricePill: { position: 'absolute', left: 2, right: 2, bottom: 2, height: 16, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: cameraColors.onCamera },
  priceText: { ...typography.text.caption, fontSize: 10, lineHeight: 12, fontWeight: typography.weight.semibold, color: cameraColors.backdrop, fontVariant: ['tabular-nums'] },
});
