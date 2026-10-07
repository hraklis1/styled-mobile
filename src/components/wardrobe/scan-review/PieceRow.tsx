import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { shortPieceName } from '../../../lib/pieceNames';
import { NORMALIZED_COLOR_HEX, isColorLight, normalizedColorDisplayName, resolveHex } from '../../../lib/colorUtils';
import type { NormalizedColor } from '../../../types/item';
import { colors, radii, spacing, typography } from '../../../theme';
import { SelectBadge } from './SelectBadge';
import type { ScanReviewPiece } from './types';

const THUMB = 52;

/**
 * One detected piece under the review photo. The body (thumbnail and name)
 * opens the editor; the checkbox only changes inclusion; the brand
 * link only opens brand search. Being the active piece and being included
 * are shown separately: active tints the row, inclusion fills the checkbox.
 */
export function PieceRow({ piece, number, active, note, polished = false, disabled, reduceMotion, onOpen, onToggle, onBrand }: {
  piece: ScanReviewPiece;
  number: number;
  active: boolean;
  /** A quiet status after the colour, e.g. "Worth a look". */
  note: string | null;
  /** Will get a polished cover once added. */
  polished?: boolean;
  disabled: boolean;
  reduceMotion: boolean;
  onOpen: () => void;
  onToggle: () => void;
  /** Opens brand search for this piece alone. */
  onBrand?: () => void;
}) {
  const included = piece.included !== false;
  // The row names the garment; the full descriptive name lives in the detail sheet.
  const name = shortPieceName(piece.name) || 'Unnamed piece';
  const color = rowColor(piece);
  const swatches = rowSwatches(piece);
  const brand = piece.brand.trim();
  // A brand read from shape alone, not a visible logo: shown as a guess.
  const brandGuess = Boolean(brand) && (piece.lowConfidenceFields ?? []).includes('brand');
  // The colour shows as swatches; words are left for the brand and any note.
  const detail = [onBrand ? null : brand || null, note].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, active && styles.rowActive]}>
      <Pressable
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        onPress={onOpen}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={[`${number}`, piece.name || name, color, brand || null, note, included ? 'included' : 'not selected', included && polished ? 'will be polished' : null].filter(Boolean).join(', ')}
        accessibilityHint="Opens the editor"
      >
        <Text style={styles.number}>{number}</Text>
        <View style={[styles.thumb, !included && styles.thumbOff]}>
          {piece.photo ? (
            <Image source={{ uri: piece.photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={reduceMotion ? 0 : 150} cachePolicy="memory-disk" />
          ) : null}
        </View>
        <View style={styles.text}>
          <View style={styles.nameLine}>
            <Text style={[styles.name, !included && styles.nameOff]} numberOfLines={1}>{name}</Text>
            {included && polished ? <Ionicons name="sparkles" size={13} color={colors.foreground} /> : null}
          </View>
          {/* Brand, then colour, each on its own line: neither has to give way to the other. */}
          {onBrand ? <View style={styles.meta}><BrandLink brand={brand} guess={brandGuess} name={name} disabled={disabled} onPress={onBrand} /></View> : null}
          {swatches.length || detail ? (
            <View style={styles.colourLine}>
              {swatches.length ? (
                // Read as one: the colour's name, not each dot.
                <View style={styles.swatches} accessible accessibilityLabel={color ?? undefined}>
                  {swatches.map((hex, index) => <View key={index} style={[styles.swatch, { backgroundColor: hex }, isColorLight(hex) && styles.swatchLight]} />)}
                </View>
              ) : null}
              {detail ? <Text style={[styles.detail, styles.detailFill]} numberOfLines={onBrand ? 1 : 2}>{detail}</Text> : null}
            </View>
          ) : null}
        </View>
      </Pressable>
      <SelectBadge
        checked={included}
        onPress={onToggle}
        disabled={disabled}
        reduceMotion={reduceMotion}
        variant="plain"
        accessibilityLabel={`Include ${name}`}
      />
    </View>
  );
}

/**
 * The colour as a row can hold it: the first colour the description names
 * ("Light Grey" from "Light Grey and Beige"); the full description stays in
 * the detail sheet. The swatch name is only a fallback — it is coarser, and
 * can disagree with what the photo shows.
 */
function rowColor(piece: Pick<ScanReviewPiece, 'color' | 'colorNormalized'>): string | null {
  const color = piece.color?.trim();
  if (color && color.toLocaleLowerCase() !== 'unknown') return color.split(/\s+(?:and|&|with)\s+|,|\//i)[0].trim();
  return piece.colorNormalized ? normalizedColorDisplayName(piece.colorNormalized as NormalizedColor) : null;
}

/**
 * One swatch per colour the description names ("Brown and Cream" is two),
 * at most three. A name no swatch recognises falls back to the canonical
 * colour rather than a meaningless grey dot.
 */
function rowSwatches(piece: Pick<ScanReviewPiece, 'color' | 'colorNormalized'>): string[] {
  const description = piece.color?.trim().toLocaleLowerCase();
  const fallback = piece.colorNormalized ? NORMALIZED_COLOR_HEX[piece.colorNormalized as NormalizedColor] ?? null : null;
  if (!description || description === 'unknown') return fallback ? [fallback] : [];
  const UNKNOWN = '#9CA3AF';
  // "Navy Blue with Gum Sole" and "Oatmeal with Charcoal Stripes" name two colours too.
  const hexes = description.split(/\s+(?:and|&|with)\s+|,|\//).map(part => part.trim()).filter(Boolean)
    .map(part => resolveHex(part)).filter(hex => hex !== UNKNOWN);
  const unique = [...new Set(hexes)].slice(0, 3);
  return unique.length ? unique : fallback ? [fallback] : [];
}

/** A piece named in a sheet header: its thumbnail beside its short name. */
export function PieceTag({ piece }: { piece: ScanReviewPiece }) {
  return (
    <View style={styles.tag}>
      <View style={styles.tagThumb}>
        {piece.photo ? <Image source={{ uri: piece.photo }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : null}
      </View>
      <Text style={styles.tagName} numberOfLines={1}>{shortPieceName(piece.name) || 'Unnamed piece'}</Text>
    </View>
  );
}

/**
 * "Add brand" while empty — an offer, never a requirement — then the brand
 * itself, which reopens the search. Its own target: it never opens the editor.
 */
function BrandLink({ brand, guess, name, disabled, onPress }: { brand: string; guess: boolean; name: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      // Text-sized to stay quiet; the slop brings the target up to 44pt.
      // With room between the lines, the slop brings the target to about 44pt.
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 24 }}
      style={({ pressed }) => [styles.brandLink, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={brand ? `Brand ${brand}${guess ? ', a guess' : ''}. Change` : `Add a brand to ${name}`}
    >
      <Text style={brand ? [styles.brandSet, guess && styles.brandGuess] : styles.brandAdd} numberOfLines={1}>{brand ? (guess ? `${brand}?` : brand) : 'Add brand'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  rowActive: { backgroundColor: colors.surfaceSelected },
  body: { flex: 1, minWidth: 0, minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  pressed: { opacity: 0.6 },
  number: { ...typography.text.priorityNumeral, color: colors.mutedForeground, width: 16, textAlign: 'center' },
  thumb: { width: THUMB, height: THUMB, borderRadius: radii.md, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  // Not selected: the picture recedes, the words stay readable.
  thumbOff: { opacity: 0.45 },
  text: { flex: 1, minWidth: 0, gap: 5 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, ...typography.text.body, fontWeight: typography.weight.medium, color: colors.foreground },
  nameOff: { color: colors.mutedForeground },
  meta: { flexDirection: 'row' },
  detail: { ...typography.text.caption, color: colors.mutedForeground, flexShrink: 1 },
  colourLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 14 },
  swatches: { flexDirection: 'row', gap: 4 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  // Pale swatches get a hairline so they don't vanish into the cream.
  swatchLight: { borderWidth: 0.5, borderColor: 'rgba(36,36,34,0.2)' },
  detailFill: { flex: 1 },
  brandLink: { flexShrink: 1, minWidth: 0 },
  brandAdd: { ...typography.text.caption, color: colors.inkSubtle, textDecorationLine: 'underline', textDecorationColor: colors.hairline },
  brandSet: { ...typography.text.caption, fontWeight: typography.weight.medium, color: colors.foreground },
  // Muted, not warned: the question mark already says "check me".
  brandGuess: { color: colors.mutedForeground },
  tag: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tagThumb: { width: 28, height: 28, borderRadius: radii.sm, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  tagName: { ...typography.text.bodySmall, color: colors.mutedForeground, flexShrink: 1 },
});
