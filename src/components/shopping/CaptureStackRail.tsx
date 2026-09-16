import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import type { ShoppingVisitPreview } from '../../stores/useShoppingSessionStore';
import { cameraColors, radii, spacing, typography } from '../../theme';

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

export function CaptureStackRail({ stacks, activeGroupId, showEmptyItem, disabled, onSelect }: {
  stacks: CaptureStack[];
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
        return (
          <TouchableOpacity key={stack.groupId} disabled={disabled} onPress={() => onSelect(stack.groupId)}
            onLayout={(event) => positions.current.set(stack.groupId, event.nativeEvent.layout.x)}
            style={styles.item} accessibilityRole="button" accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={`Item ${index + 1}, ${stack.previews.length} photos`}
            accessibilityHint="Select this item to add photos">
            <View style={[styles.frame, active && styles.activeFrame]}>
              <Image source={{ uri: cover.previewUri ?? cover.localFileUri }} style={styles.cover} contentFit="cover" />
            </View>
            <Text style={[styles.label, active && styles.activeLabel]}>Item {index + 1}</Text>
            <Text style={styles.count}>{stack.previews.length} photo{stack.previews.length === 1 ? '' : 's'}</Text>
          </TouchableOpacity>
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
          <Text style={styles.label}>Item {stacks.length + 1}</Text>
          <Text style={styles.count}>Empty</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  viewport: { width: '100%', flexGrow: 0 },
  rail: { flexGrow: 1, justifyContent: 'center', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  item: { alignItems: 'center', gap: spacing.xs / 2, minWidth: 64 },
  frame: { width: 60, height: 80, borderWidth: 1.5, borderColor: 'transparent', borderRadius: radii.photo, borderCurve: 'continuous' },
  activeFrame: { borderColor: cameraColors.selection, backgroundColor: cameraColors.selectionSubtle },
  cover: { width: '100%', height: '100%', borderRadius: radii.photo },
  emptyFrame: { alignItems: 'center', justifyContent: 'center', backgroundColor: cameraColors.controlSubtle },
  plus: { color: cameraColors.onCamera, fontSize: 28, fontWeight: '300' },
  label: { ...typography.text.caption, color: cameraColors.onCameraMuted, fontWeight: typography.weight.medium, fontVariant: ['tabular-nums'] },
  activeLabel: { color: cameraColors.onCamera, fontWeight: typography.weight.semibold },
  count: { ...typography.text.caption, color: cameraColors.onCameraMuted, fontSize: 11, lineHeight: 15, fontVariant: ['tabular-nums'] },
});
