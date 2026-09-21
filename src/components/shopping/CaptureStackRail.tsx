import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';
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

// Tiles carry their own metadata (number badge, photo count, stacked-card
// offset) instead of caption lines beneath them, so the rail stays one
// thumbnail tall and the viewfinder above keeps the space.
export function CaptureStackRail({ stacks, priceLabels, activeGroupId, showEmptyItem, disabled, onSelect }: {
  stacks: CaptureStack[];
  /** Per item, the price read so far ("$90"), "?" when it needs a tap, or nothing. */
  priceLabels?: Map<string, string | null>;
  activeGroupId: string | null;
  showEmptyItem: boolean;
  disabled: boolean;
  onSelect: (groupId: string | null) => void;
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
        return (
          <Animated.View key={stack.groupId} entering={reducedMotion ? undefined : ZoomIn.duration(220)}>
            <TouchableOpacity disabled={disabled} onPress={() => onSelect(stack.groupId)}
              onLayout={(event) => positions.current.set(stack.groupId, event.nativeEvent.layout.x)}
              style={styles.item} accessibilityRole="button" accessibilityState={{ selected: active, disabled }}
              accessibilityLabel={`Item ${index + 1}, ${stack.previews.length} photo${stack.previews.length === 1 ? '' : 's'}${priceLabel === '?' ? ', confirm price' : priceLabel ? `, ${priceLabel}` : ''}`}
              accessibilityHint="Select this item to add photos">
              {multi ? <View style={[styles.card, styles.cardBack]} /> : null}
              {multi ? <View style={[styles.card, styles.cardMid]} /> : null}
              <View style={[styles.frame, active && styles.activeFrame]}>
                <Image source={{ uri: cover.previewUri ?? cover.localFileUri }} style={styles.cover} contentFit="cover" />
                {multi ? (
                  <View style={[styles.countPill, priceLabel ? styles.countPillTop : null]}><Text style={styles.countText}>{stack.previews.length}</Text></View>
                ) : null}
                {priceLabel ? (
                  <View style={styles.pricePill}><Text style={styles.priceText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{priceLabel}</Text></View>
                ) : null}
              </View>
              <View style={[styles.numBadge, active && styles.numBadgeActive]}>
                <Text style={[styles.numText, active && styles.numTextActive]}>{index + 1}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
      {showEmptyItem && (
        <TouchableOpacity disabled={disabled} onPress={() => onSelect(null)} style={styles.item}
          onLayout={(event) => positions.current.set('empty', event.nativeEvent.layout.x)}
          accessibilityRole="button" accessibilityState={{ selected: activeKey === 'empty', disabled }}
          accessibilityLabel={`New item ${stacks.length + 1}, empty`}>
          <View style={[styles.frame, styles.emptyFrame, activeKey === 'empty' && styles.activeFrame]}>
            <Text style={styles.plus}>+</Text>
          </View>
          <View style={[styles.numBadge, activeKey === 'empty' && styles.numBadgeActive]}>
            <Text style={[styles.numText, activeKey === 'empty' && styles.numTextActive]}>{stacks.length + 1}</Text>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const FRAME_W = 52;
const FRAME_H = 68;

const styles = StyleSheet.create({
  viewport: { width: '100%', flexGrow: 0 },
  rail: { flexGrow: 1, justifyContent: 'center', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  // Padding leaves room for the number badge (top-left) and the offset cards
  // (top-right) so neither is clipped by the scroll view.
  item: { paddingTop: 6, paddingLeft: 6, paddingRight: 6, position: 'relative' },
  frame: { width: FRAME_W, height: FRAME_H, borderWidth: 1.5, borderColor: 'transparent', borderRadius: radii.photo, borderCurve: 'continuous', overflow: 'hidden' },
  activeFrame: { borderColor: cameraColors.selection, backgroundColor: cameraColors.selectionSubtle },
  cover: { width: '100%', height: '100%' },
  card: { position: 'absolute', top: 6, left: 6, width: FRAME_W, height: FRAME_H, borderRadius: radii.photo, borderCurve: 'continuous' },
  cardMid: { transform: [{ translateX: 3 }, { translateY: -3 }], backgroundColor: 'rgba(255, 252, 247, 0.30)' },
  cardBack: { transform: [{ translateX: 6 }, { translateY: -6 }], backgroundColor: 'rgba(255, 252, 247, 0.14)' },
  emptyFrame: { alignItems: 'center', justifyContent: 'center', backgroundColor: cameraColors.controlSubtle },
  plus: { color: cameraColors.onCamera, fontSize: 28, fontWeight: '300' },
  numBadge: { position: 'absolute', top: 0, left: 0, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: cameraColors.onCamera },
  numBadgeActive: { backgroundColor: colors.primary },
  numText: { ...typography.text.caption, fontSize: 11, lineHeight: 13, fontWeight: typography.weight.semibold, color: cameraColors.backdrop, fontVariant: ['tabular-nums'] },
  numTextActive: { color: cameraColors.onCamera },
  countPill: { position: 'absolute', right: 3, bottom: 3, height: 16, paddingHorizontal: 5, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: cameraColors.control },
  countPillTop: { bottom: undefined, top: 3 },
  // Sits on the bottom edge inside the frame so the rail stays one thumbnail tall.
  pricePill: { position: 'absolute', left: 2, right: 2, bottom: 2, height: 16, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: cameraColors.onCamera },
  priceText: { ...typography.text.caption, fontSize: 10, lineHeight: 12, fontWeight: typography.weight.semibold, color: cameraColors.backdrop, fontVariant: ['tabular-nums'] },
  countText: { ...typography.text.caption, fontSize: 10, lineHeight: 12, fontWeight: typography.weight.semibold, color: cameraColors.onCamera, fontVariant: ['tabular-nums'] },
});
