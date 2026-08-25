import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import type { ShoppingVisitPreview } from '../../stores/useShoppingSessionStore';
import { radii, spacing, typography } from '../../theme';

export type CaptureStack = {
  groupId: string;
  previews: ShoppingVisitPreview[];
};

/**
 * One entry per capture group, in the order the groups were started. The rail
 * shows items, not photos: a stack of three angles reads as a single find with
 * a "3" on it, which is the fact the shopper needs while the camera is still
 * up. The previous rail drew every photo separately with a 2px rule between
 * groups — information that was present but unreadable at thumbnail size.
 */
export function buildCaptureStacks(previews: ShoppingVisitPreview[]): CaptureStack[] {
  const stacks: CaptureStack[] = [];
  const byGroup = new Map<string, CaptureStack>();

  for (const preview of previews) {
    const existing = byGroup.get(preview.captureGroupId);
    if (existing) {
      existing.previews.push(preview);
      continue;
    }
    const stack: CaptureStack = { groupId: preview.captureGroupId, previews: [preview] };
    byGroup.set(preview.captureGroupId, stack);
    stacks.push(stack);
  }

  return stacks;
}

/** The photo that represents a stack: its garment shot, else its first photo. */
export function stackCover(stack: CaptureStack): ShoppingVisitPreview {
  return stack.previews.find((preview) => preview.captureRole === 'garment') ?? stack.previews[0];
}

function PreviewTile({
  preview,
  count,
  isNewest,
  onPress,
  accessibilityLabel,
}: {
  preview: ShoppingVisitPreview;
  count: number;
  isNewest: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.tileWrap}>
      {count > 1 ? <View style={styles.stackEdgeBack} /> : null}
      {count > 1 ? <View style={styles.stackEdgeFront} /> : null}
      <TouchableOpacity
        style={[styles.thumb, isNewest && styles.thumbNewest]}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
      >
        <Image
          source={{ uri: preview.previewUri ?? preview.localFileUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={preview.id}
        />
        {count > 1 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ) : (
          <View style={styles.roleBadge}>
            {preview.ocrStatus === 'processing' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name={preview.captureRole === 'tag' ? 'pricetag' : 'shirt-outline'}
                size={11}
                color="#FFFFFF"
              />
            )}
          </View>
        )}
        {preview.syncStatus === 'pending' ? <View style={styles.pendingDot} /> : null}
      </TouchableOpacity>
    </View>
  );
}

export function CaptureStackRail({
  stacks,
  expandedGroupId,
  onToggleStack,
  onPressPhoto,
  railRef,
}: {
  stacks: CaptureStack[];
  expandedGroupId: string | null;
  onToggleStack: (groupId: string) => void;
  onPressPhoto: (previewId: string) => void;
  railRef?: React.Ref<ScrollView>;
}) {
  const renderStack = useCallback((stack: CaptureStack, index: number) => {
    const isExpanded = stack.groupId === expandedGroupId;
    const isNewest = index === stacks.length - 1;
    const position = `Item ${index + 1} of ${stacks.length}`;

    // An expanded stack fans out in place so a mis-attached tag can be found
    // and pulled back out without leaving the camera.
    if (isExpanded) {
      return (
        <View key={stack.groupId} style={styles.expandedGroup}>
          {stack.previews.map((preview) => (
            <PreviewTile
              key={preview.id}
              preview={preview}
              count={1}
              isNewest={false}
              onPress={() => onPressPhoto(preview.id)}
              accessibilityLabel={`${position}, ${preview.captureRole === 'tag' ? 'tag' : 'garment'} photo, open`}
            />
          ))}
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={() => onToggleStack(stack.groupId)}
            accessibilityLabel={`Collapse ${position}`}
          >
            <Ionicons name="chevron-back" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      );
    }

    const cover = stackCover(stack);
    return (
      <PreviewTile
        key={stack.groupId}
        preview={cover}
        count={stack.previews.length}
        isNewest={isNewest}
        onPress={() => (stack.previews.length > 1
          ? onToggleStack(stack.groupId)
          : onPressPhoto(cover.id))}
        accessibilityLabel={stack.previews.length > 1
          ? `${position}, ${stack.previews.length} photos, expand`
          : `${position}, 1 photo, open`}
      />
    );
  }, [expandedGroupId, onPressPhoto, onToggleStack, stacks.length]);

  if (stacks.length === 0) return null;

  return (
    <ScrollView
      ref={railRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      accessibilityLabel={`${stacks.length} item${stacks.length === 1 ? '' : 's'} in this shopping visit`}
    >
      {stacks.map(renderStack)}
    </ScrollView>
  );
}

const THUMB = 54;

const styles = StyleSheet.create({
  rail: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  expandedGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tileWrap: { width: THUMB, height: THUMB, justifyContent: 'center' },
  // Two offset edges behind the cover read as depth — the count badge says how
  // many, these say "there is more than one" before the number is even read.
  stackEdgeBack: {
    position: 'absolute',
    left: 6,
    top: 5,
    right: -6,
    bottom: 5,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  stackEdgeFront: {
    position: 'absolute',
    left: 3,
    top: 2.5,
    right: -3,
    bottom: 2.5,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  thumbNewest: { borderColor: '#FFFFFF', transform: [{ scale: 1.05 }] },
  countBadge: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    minWidth: 20,
    minHeight: 20,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  countText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.bold,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  roleBadge: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    minWidth: 20,
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.66)',
  },
  pendingDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFD166',
  },
  collapseButton: {
    width: 28,
    height: THUMB,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
