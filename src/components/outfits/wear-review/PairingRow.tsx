import { memo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { FlagDot, Middot, TextLink } from '../../wardrobe/scan-review/atoms';
import { selectionFeedback } from '../../wardrobe/scan-review/feedback';
import { itemImageContentFit, itemImageUri } from '../../../lib/itemImage';
import { colors, radii, spacing, stroke, typography } from '../../../theme';
import type { Item } from '../../../types/item';
import type { Resolution, WearDetection } from '../../../features/wear-log/types';

const PLATE_W = 76;
const PLATE_H = 100;
const THUMB_W = 52;
const THUMB_H = 68;

export type RowActions = {
  confirm: (detectionId: string, itemId: number) => void;
  findInCloset: (detectionId: string) => void;
  addAsNew: (detectionId: string) => void;
  editNew: (detectionId: string) => void;
  dismiss: (detectionId: string) => void;
  restore: (detectionId: string) => void;
  clear: (detectionId: string) => void;
  focus: (detectionId: string) => void;
};

function wornLine(item: Item): string {
  if (!item.wearCount) return 'Not worn yet';
  return item.wearCount === 1 ? 'Worn once' : `Worn ${item.wearCount} times`;
}

function ItemPlate({ item, width = PLATE_W, height = PLATE_H, selected }: {
  item: Item;
  width?: number;
  height?: number;
  selected?: boolean;
}) {
  return (
    <View style={[styles.plate, { width, height }, selected && styles.plateSelected]}>
      <Image
        source={{ uri: itemImageUri(item) }}
        style={StyleSheet.absoluteFill}
        contentFit={itemImageContentFit(item)}
        cachePolicy="memory-disk"
        recyclingKey={String(item.id)}
      />
    </View>
  );
}

/** The detected garment: the scan's cutout, whole, on a plain plate. */
function DetectedPlate({ detection }: { detection: WearDetection }) {
  return (
    <View style={[styles.plate, styles.detectedPlate]}>
      {detection.cutoutUrl ? (
        <Image source={{ uri: detection.cutoutUrl }} style={styles.cutout} contentFit="contain" cachePolicy="memory-disk" />
      ) : (
        <Ionicons name="shirt-outline" size={22} color={colors.tertiary} />
      )}
    </View>
  );
}

function holdCopy(d: WearDetection, occluder: WearDetection | undefined): string | null {
  if (d.holdReason === 'occluded') return occluder ? `Partly under the ${occluder.attributes.name.toLowerCase()}` : 'Partly hidden';
  if (d.holdReason === 'lookalike') return 'You own a few like this';
  return null;
}

/** A horizontal strip of closet candidates; tapping one decides the row. */
function CandidateStrip({ detection, itemsById, selectedId, onPick }: {
  detection: WearDetection;
  itemsById: Map<number, Item>;
  selectedId: number | null;
  onPick: (itemId: number) => void;
}) {
  const candidates = detection.candidates.map((c) => itemsById.get(c.itemId)).filter((i): i is Item => !!i);
  if (candidates.length < 2 && selectedId != null) return null;
  if (candidates.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {candidates.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => { selectionFeedback(); onPick(item.id); }}
          accessibilityRole="button"
          accessibilityState={{ selected: item.id === selectedId }}
          accessibilityLabel={`${item.name}${item.brand ? `, ${item.brand}` : ''}, ${wornLine(item)}`}
        >
          <ItemPlate item={item} width={THUMB_W} height={THUMB_H} selected={item.id === selectedId} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

export const PairingRow = memo(function PairingRow({
  detection, number, resolution, occluder, itemsById, sharedWith, active, actions,
}: {
  detection: WearDetection;
  number: number;
  resolution: Resolution;
  occluder: WearDetection | undefined;
  itemsById: Map<number, Item>;
  /** Row numbers that point at the same closet item. */
  sharedWith: number[];
  active: boolean;
  actions: RowActions;
}) {
  const swipe = useRef<SwipeableMethods>(null);
  const id = detection.id;
  // Why the match was held back only matters while the match is still in question.
  const hold = resolution.kind === 'unresolved' || (resolution.kind === 'matched' && resolution.source === 'suggested')
    ? holdCopy(detection, occluder)
    : null;
  const indent = detection.occludedBy != null;

  if (resolution.kind === 'dismissed') {
    return (
      <View style={[styles.row, styles.rowDismissed, indent && styles.indent]}>
        <Text style={styles.number}>{number}</Text>
        <Text style={styles.dismissedText} numberOfLines={1}>{detection.attributes.name} · not logged</Text>
        <TextLink label="Undo" onPress={() => actions.restore(id)} accessibilityLabel={`Log ${detection.attributes.name} after all`} />
      </View>
    );
  }

  const matched = resolution.kind === 'matched' ? itemsById.get(resolution.itemId) : undefined;
  const suggested = resolution.kind === 'matched' && resolution.source === 'suggested';

  let right: React.ReactNode;
  if (resolution.kind === 'matched' && matched) {
    right = (
      <View style={styles.side}>
        <View style={styles.matchLine}>
          <ItemPlate item={matched} />
          <View style={styles.matchText}>
            <View style={styles.titleLine}>
              {suggested ? <FlagDot /> : <Ionicons name="checkmark" size={13} color={colors.foreground} />}
              <Text style={styles.itemName} numberOfLines={2}>{matched.name}</Text>
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {[matched.brand, wornLine(matched)].filter(Boolean).join(' · ')}
            </Text>
            {sharedWith.length ? (
              <Text style={styles.warn}>Also matched in {sharedWith.join(', ')} — logged once</Text>
            ) : null}
            <View style={styles.links}>
              {suggested ? (
                <>
                  <TextLink label="Yes, this" onPress={() => { selectionFeedback(); actions.confirm(id, matched.id); }} />
                  <Middot />
                </>
              ) : null}
              <TextLink label="Change" tone="muted" onPress={() => actions.findInCloset(id)} accessibilityLabel={`Change the match for ${detection.attributes.name}`} />
            </View>
          </View>
        </View>
        {suggested ? (
          <CandidateStrip detection={detection} itemsById={itemsById} selectedId={matched.id} onPick={(itemId) => actions.confirm(id, itemId)} />
        ) : null}
      </View>
    );
  } else if (resolution.kind === 'new') {
    const { draft } = resolution;
    right = (
      <View style={styles.side}>
        <View style={styles.matchLine}>
          <View style={[styles.slot, styles.slotNew]}>
            <Ionicons name="add" size={18} color={colors.foreground} />
          </View>
          <View style={styles.matchText}>
            <Text style={styles.itemName} numberOfLines={2}>{draft.name || detection.attributes.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[draft.brand || null, 'New piece'].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.links}>
              <TextLink label="Edit details" onPress={() => actions.editNew(id)} />
              <Middot />
              <TextLink label="Undo" tone="muted" onPress={() => actions.clear(id)} accessibilityLabel={`Don’t add ${draft.name} as new`} />
            </View>
          </View>
        </View>
      </View>
    );
  } else {
    right = (
      <View style={styles.side}>
        <View style={styles.titleLine}>
          <FlagDot />
          <Text style={styles.itemName}>{detection.candidates.length ? 'Is it one of these?' : 'Not in your closet yet'}</Text>
        </View>
        <CandidateStrip detection={detection} itemsById={itemsById} selectedId={null} onPick={(itemId) => actions.confirm(id, itemId)} />
        <View style={styles.links}>
          <TextLink label="Find in closet" onPress={() => actions.findInCloset(id)} />
          <Middot />
          <TextLink label="Add as new" onPress={() => actions.addAsNew(id)} />
          <Middot />
          <TextLink label="Skip" tone="muted" onPress={() => actions.dismiss(id)} accessibilityLabel={`Don’t log ${detection.attributes.name}`} />
        </View>
      </View>
    );
  }

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      rightThreshold={72}
      overshootRight={false}
      renderRightActions={() => (
        <View style={styles.swipeAction}>
          <Text style={styles.swipeText}>Skip</Text>
        </View>
      )}
      onSwipeableOpen={() => { swipe.current?.close(); actions.dismiss(id); }}
    >
      <Pressable
        onPress={() => actions.focus(id)}
        style={[styles.row, active && styles.rowActive, indent && styles.indent]}
        accessibilityHint="Swipe left to skip this piece"
        accessibilityActions={[{ name: 'dismiss', label: 'Skip' }]}
        onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'dismiss') actions.dismiss(id); }}
      >
        <View style={styles.left}>
          <View style={styles.numberLine}>
            <Text style={styles.number}>{number}</Text>
            <Text style={styles.detectedName} numberOfLines={1}>{detection.attributes.name}</Text>
          </View>
          <DetectedPlate detection={detection} />
          {hold ? <Text style={styles.hold} numberOfLines={2}>{hold}</Text> : null}
        </View>
        <View style={styles.rule} />
        {right}
      </Pressable>
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  rowActive: { backgroundColor: colors.surfaceSubtle },
  rowDismissed: { alignItems: 'center', paddingVertical: spacing.xs },
  indent: { paddingLeft: spacing.xxl },
  left: { width: PLATE_W + spacing.lg, gap: spacing.xs },
  numberLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  number: { ...typography.text.meta, color: colors.tertiary, minWidth: 12 },
  detectedName: { ...typography.text.meta, color: colors.mutedForeground, flexShrink: 1 },
  hold: { ...typography.text.meta, fontSize: 11, lineHeight: 14, color: colors.accentInk },
  rule: { width: stroke.hairline, alignSelf: 'stretch', backgroundColor: colors.hairline },
  side: { flex: 1, minWidth: 0, gap: spacing.xs },
  matchLine: { flexDirection: 'row', gap: spacing.md },
  matchText: { flex: 1, minWidth: 0, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  itemName: { ...typography.text.bodySmall, color: colors.foreground, flexShrink: 1 },
  meta: { ...typography.text.meta, color: colors.mutedForeground },
  warn: { ...typography.text.meta, fontSize: 11, color: colors.accentInk },
  links: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  plate: {
    borderRadius: radii.photo,
    overflow: 'hidden',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateSelected: { borderWidth: stroke.fine, borderColor: colors.foreground },
  detectedPlate: { width: PLATE_W, height: PLATE_H, backgroundColor: colors.card },
  cutout: { width: '88%', height: '88%' },
  slot: {
    width: PLATE_W,
    height: PLATE_H,
    borderRadius: radii.photo,
    borderWidth: stroke.fine,
    borderStyle: 'dashed',
    borderColor: colors.controlOutline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotNew: { borderStyle: 'solid', borderColor: colors.foreground },
  strip: { gap: spacing.sm, paddingVertical: spacing.xs },
  dismissedText: { ...typography.text.meta, color: colors.tertiary, flex: 1, textDecorationLine: 'line-through' },
  swipeAction: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSelected,
  },
  swipeText: { ...typography.text.label, color: colors.foreground },
});
