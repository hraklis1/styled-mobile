import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { CATEGORY_LABELS, type ItemCategory } from '../../../types/item';
import { colors, radii, spacing, stroke, typography } from '../../../theme';
import { PrimaryButton } from './ActionBar';
import { WorkspaceSheet } from './WorkspaceSheet';
import type { ScanReviewPiece } from './types';

/** The preview never gets squatter or taller than this, so shoes stay large and trousers stay whole. */
const MIN_RATIO = 0.8;
const MAX_RATIO = 1.4;

/**
 * One piece, up close. Every edit here is saved the moment it's made (type
 * and brand come back from their own sheets, the crop from the crop
 * editor), so Done, the close button and a swipe-down all mean the same
 * thing: back to the list.
 */
export function PieceEditorSheet({ piece, dismissed, reduceMotion, onClose, onDone, onCrop, onType, onBrand }: {
  piece: ScanReviewPiece;
  dismissed: boolean;
  reduceMotion: boolean;
  onClose: () => void;
  onDone: () => void;
  onCrop?: () => void;
  onType: () => void;
  onBrand: () => void;
}) {
  const brand = piece.brand.trim();
  const category = piece.category && piece.category in CATEGORY_LABELS ? CATEGORY_LABELS[piece.category as ItemCategory] : null;

  return (
    <WorkspaceSheet
      title={piece.name || 'Unnamed piece'}
      detent="large"
      reduceMotion={reduceMotion}
      dismissed={dismissed}
      onClose={onClose}
      headerAction={<SheetClose onPress={onDone} />}
      footer={<PrimaryButton label="Done" onPress={onDone} />}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CropPreview uri={piece.photo} name={piece.name} reduceMotion={reduceMotion} />
        {onCrop ? <AdjustCropButton onPress={onCrop} /> : null}

        <View style={styles.rows}>
          <EditorRow label="Type" value={category ?? 'Choose'} muted={!category} onPress={onType} />
          <View style={styles.rule} />
          <EditorRow label="Brand" optional value={brand || 'Add'} muted={!brand} onPress={onBrand} />
        </View>
      </ScrollView>
    </WorkspaceSheet>
  );
}

/** The sheet's close control: the same as Done, since every edit is already saved. */
export function SheetClose({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={4}>
      <Ionicons name="close" size={24} color={colors.foreground} />
    </Pressable>
  );
}

/**
 * A piece's crop, framed to its own shape: the frame follows the crop's
 * aspect within limits, and never takes so much height that the rows under
 * it fall out of view.
 */
export function CropPreview({ uri, name, reduceMotion }: { uri: string | null; name: string; reduceMotion: boolean }) {
  const { width, height } = useWindowDimensions();
  const [ratio, setRatio] = useState(1);
  const previewWidth = width - spacing.lg * 2;
  const frameRatio = Math.max(MIN_RATIO, Math.min(MAX_RATIO, ratio));
  return (
    <View style={[styles.preview, { width: previewWidth, height: Math.min(previewWidth / frameRatio, height * 0.36) }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={reduceMotion ? 0 : 150}
          cachePolicy="memory-disk"
          onLoad={event => { if (event.source.height > 0) setRatio(event.source.width / event.source.height); }}
          accessibilityLabel={`Current crop of ${name || 'this piece'}`}
        />
      ) : null}
    </View>
  );
}

export function AdjustCropButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.cropPill} onPress={onPress} accessibilityRole="button" activeOpacity={0.7}>
      <Ionicons name="crop-outline" size={17} color={colors.foreground} />
      <Text style={styles.cropText}>Adjust crop</Text>
    </TouchableOpacity>
  );
}

function EditorRow({ label, optional, value, muted, onPress }: { label: string; optional?: boolean; value: string; muted: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}${optional ? ', optional' : ''}, ${value}`} activeOpacity={0.7}>
      <Text style={styles.rowLabel}>{label}{optional ? <Text style={styles.optional}> · Optional</Text> : null}</Text>
      <Text style={[styles.rowValue, muted && styles.rowValueMuted]} numberOfLines={1}>{value}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  close: { minWidth: 44, minHeight: 44, marginTop: -8, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg, alignItems: 'center' },
  preview: { borderRadius: radii.lg, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  cropPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minHeight: 44, paddingHorizontal: spacing.lg,
    borderRadius: 22, borderWidth: stroke.fine, borderColor: colors.hairline, backgroundColor: colors.card,
  },
  cropText: { ...typography.text.label, color: colors.foreground },
  rows: { alignSelf: 'stretch', borderRadius: radii.lg, borderCurve: 'continuous', borderWidth: stroke.hairline, borderColor: colors.hairline, backgroundColor: colors.card },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: spacing.lg },
  rowLabel: { ...typography.text.body, color: colors.foreground, flex: 1 },
  optional: { color: colors.mutedForeground },
  rowValue: { ...typography.text.body, color: colors.foreground, maxWidth: '55%' },
  rowValueMuted: { color: colors.mutedForeground },
});
