import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextLink } from '../../wardrobe/scan-review/atoms';
import { needsCheck } from '../../../features/wear-log/reducer';
import type { Resolution, WearDetection } from '../../../features/wear-log/types';
import type { Item } from '../../../types/item';
import { colors, spacing, typography } from '../../../theme';
import { PieceImage } from './PieceImage';

export const PairingRow = memo(function PairingRow({ detection, quiet = false, resolution, itemsById, sharedWith, wardrobeReady, disabled, onOpen, onRestore }: {
  detection: WearDetection;
  /** The section header already says "To confirm" or "Ready", so the row doesn't repeat it. */
  quiet?: boolean;
  resolution: Resolution;
  itemsById: Map<number, Item>;
  sharedWith: number[];
  wardrobeReady: boolean;
  disabled: boolean;
  onOpen: () => void;
  onRestore: () => void;
}) {
  if (resolution.kind === 'dismissed') {
    return <View style={styles.skipped}>
      <Text style={styles.meta}>{detection.attributes.name} · Not logging</Text>
      <TextLink label="Undo" disabled={disabled} onPress={onRestore} accessibilityLabel={`Restore ${detection.attributes.name}`} />
    </View>;
  }
  const item = resolution.kind === 'matched' ? itemsById.get(resolution.itemId) : undefined;
  const missing = resolution.kind === 'matched' && wardrobeReady && !item;
  const uncertain = needsCheck(resolution) || missing;
  const name = uncertain ? detection.attributes.name : resolution.kind === 'new' ? resolution.draft.name || detection.attributes.name : item?.name || detection.attributes.name;
  const brand = resolution.kind === 'new' ? resolution.draft.brand : item?.brand;
  const status = missing ? 'Choose another piece' : uncertain ? 'Needs review' : resolution.kind === 'new' ? 'New piece' : 'Matched';
  return <Pressable style={styles.row} onPress={onOpen} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${name}, ${status}`} accessibilityHint="Review or change this piece" accessibilityState={{ disabled }}>
    <PieceImage item={uncertain ? undefined : item} cropUrl={detection.cropUrl} cutoutUrl={detection.cutoutUrl} />
    <View style={styles.copy}>
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
      {(() => { const meta = [brand, quiet && (status === 'Needs review' || status === 'Matched') ? null : status].filter(Boolean).join(' · ');
        return meta ? <Text style={[styles.meta, uncertain && !quiet && styles.attention, missing && styles.attention]}>{meta}</Text> : null; })()}
      {sharedWith.length ? <Text style={styles.meta}>Same piece as another row · logged once</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
  </Pressable>;
});
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 96 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  name: { ...typography.text.bodySmall, color: colors.foreground },
  meta: { ...typography.text.meta, color: colors.mutedForeground, flexShrink: 1 },
  attention: { ...typography.text.meta, color: colors.accentInk },
  skipped: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
});
