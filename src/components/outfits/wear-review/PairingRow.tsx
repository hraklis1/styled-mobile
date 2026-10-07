import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { needsCheck } from '../../../features/wear-log/reducer';
import type { Resolution, WearDetection } from '../../../features/wear-log/types';
import type { Item } from '../../../types/item';
import { colors, radii, spacing, stroke, typography } from '../../../theme';
import { PieceImage } from './PieceImage';

export const PairingRow = memo(function PairingRow({ detection, resolution, itemsById, sharedWith, wardrobeReady, disabled, onOpen, onRestore }: {
  detection: WearDetection;
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
      <View style={styles.faded}><PieceImage cropUrl={detection.cropUrl} cutoutUrl={detection.cutoutUrl} width={48} height={60} /></View>
      <View style={styles.copy}>
        <Text style={[styles.name, styles.skippedName]} numberOfLines={1}>{detection.attributes.name}</Text>
        <Text style={styles.meta}>Not logging</Text>
      </View>
      <Pressable onPress={onRestore} disabled={disabled} hitSlop={8} style={({ pressed }) => [styles.undo, pressed && styles.undoPressed, disabled && styles.undoDisabled]}
        accessibilityRole="button" accessibilityLabel={`Restore ${detection.attributes.name}`} accessibilityState={{ disabled }}>
        <Ionicons name="arrow-undo" size={13} color={colors.foreground} />
        <Text style={styles.undoText}>Undo</Text>
      </Pressable>
    </View>;
  }
  const item = resolution.kind === 'matched' ? itemsById.get(resolution.itemId) : undefined;
  const missing = resolution.kind === 'matched' && wardrobeReady && !item;
  const uncertain = needsCheck(resolution) || missing;
  const name = uncertain ? detection.attributes.name : resolution.kind === 'new' ? resolution.draft.name || detection.attributes.name : item?.name || detection.attributes.name;
  const brand = resolution.kind === 'new' ? resolution.draft.brand : item?.brand;
  const status = missing ? 'Choose another' : uncertain ? 'Needs review' : resolution.kind === 'new' ? 'New' : 'Matched';
  return <Pressable style={styles.row} onPress={onOpen} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${name}, ${status}`} accessibilityHint="Review or change this piece" accessibilityState={{ disabled }}>
    <PieceImage item={uncertain ? undefined : item} cropUrl={detection.cropUrl} cutoutUrl={detection.cutoutUrl} />
    <View style={styles.copy}>
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
      {brand ? <Text style={styles.meta} numberOfLines={1}>{brand}</Text> : null}
      <View style={[styles.pill, uncertain ? styles.pillAttention : styles.pillQuiet]}>
        <Text style={[styles.pillText, uncertain && styles.pillTextAttention]}>{status}</Text>
      </View>
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
  undo: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: spacing.sm, borderRadius: radii.action, borderWidth: stroke.hairline, borderColor: colors.controlOutline },
  undoPressed: { backgroundColor: colors.surfaceSubtle },
  undoDisabled: { opacity: 0.4 },
  undoText: { ...typography.text.meta, fontWeight: typography.weight.medium, color: colors.foreground },
  pill: { alignSelf: 'flex-start', height: 20, paddingHorizontal: 8, borderRadius: radii.action, justifyContent: 'center', marginTop: 2 },
  pillQuiet: { backgroundColor: colors.surfaceSubtle },
  pillAttention: { borderWidth: stroke.hairline, borderColor: colors.accentInk },
  pillText: { ...typography.text.meta, fontSize: 10, lineHeight: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.mutedForeground },
  pillTextAttention: { color: colors.accentInk },
  skipped: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minHeight: 72 },
  faded: { opacity: 0.4, marginLeft: 8 },
  skippedName: { color: colors.mutedForeground, textDecorationLine: 'line-through' },
});
