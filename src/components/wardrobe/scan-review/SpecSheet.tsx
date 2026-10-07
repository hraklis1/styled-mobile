import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { SizeProfileInput } from '../../primitives/SizeProfileInput';
import { getStyles } from '../../../lib/taxonomy';
import { NORMALIZED_COLOR_HEX, getSwatchColor, isColorLight, normalizedColorDisplayName } from '../../../lib/colorUtils';
import type { ReviewField } from '../../../lib/scan-review';
import {
  CATEGORY_LABELS,
  FIT_OPTIONS_BY_CATEGORY,
  FIT_OPTIONS_DEFAULT,
  NORMALIZED_COLORS,
  SEASON_LABELS,
  SEASON_OPTIONS,
  type ItemCategory,
  type NormalizedColor,
} from '../../../types/item';
import { colors, radii, spacing, stroke, typography } from '../../../theme';
import { ChipRow, FlagDot } from './atoms';
import { isReviewStage, type PiecePatch, type ScanReviewPiece, type ScanReviewStage } from './types';

export type ExpandableRow = 'color' | 'details';
export type SheetKind = 'brand' | 'material' | 'category';

const SEASON_CHIPS = SEASON_OPTIONS.map((value) => ({ value, label: SEASON_LABELS[value] }));

/** "Minimal · Fall/Winter · Relaxed Fit", or null when there is nothing yet. */
export function detailsSummary(piece: Pick<ScanReviewPiece, 'style' | 'seasons' | 'fit'>): string | null {
  const seasons = piece.seasons.length === SEASON_OPTIONS.length
    ? 'All seasons'
    : SEASON_OPTIONS.filter((season) => piece.seasons.includes(season)).map((season) => SEASON_LABELS[season]).join('/');
  const parts = [piece.style, seasons, piece.fit].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function categoryValue(piece: Pick<ScanReviewPiece, 'category' | 'subcategory'>): string | null {
  const label = piece.category ? CATEGORY_LABELS[piece.category as ItemCategory] ?? piece.category : null;
  if (label && piece.subcategory) return `${label} · ${piece.subcategory}`;
  return label;
}

/** The server's "no idea" colour reads as empty, not as a colour called Unknown. */
function colourValue(color: string | null): string | null {
  return color && color.toLocaleLowerCase() !== 'unknown' ? color : null;
}

/**
 * A product page's "details" list rather than a form: label left, value
 * right, hairline rules between. Only the name is typed; everything else is
 * picked, inline when the choices are few, in a sheet when they need search.
 */
export function SpecSheet({ piece, stage, flags, expandedRow, disabled, compact = false, onExpand, onUpdate, onOpenSheet }: {
  piece: ScanReviewPiece;
  /** Fold Material and Details behind "More details" until asked for (quick capture, e.g. logging a wear). */
  compact?: boolean;
  stage: ScanReviewStage;
  flags: readonly ReviewField[];
  expandedRow: ExpandableRow | null;
  disabled: boolean;
  onExpand: (row: ExpandableRow | null) => void;
  onUpdate: (patch: PiecePatch) => void;
  onOpenSheet: (kind: SheetKind) => void;
}) {
  const review = isReviewStage(stage);
  const flagged = (field: ReviewField) => review && flags.includes(field);
  const toggle = (row: ExpandableRow) => onExpand(expandedRow === row ? null : row);
  const colour = colourValue(piece.color);
  const details = detailsSummary(piece);
  const [more, setMore] = useState(!compact || !!piece.material || !!details);

  return (
    <View style={styles.root}>
      <View style={styles.identity}>
        <EditableTitle
          value={piece.name}
          flagged={flagged('name')}
          disabled={disabled}
          onChange={(name) => onUpdate({ name })}
        />
        <BrandEyebrow brand={piece.brand} flagged={flagged('brand')} disabled={disabled} onPress={() => onOpenSheet('brand')} />
        {!review && !piece.brand ? (
          <Text style={styles.hint}>Optional. A brand helps us read the details.</Text>
        ) : piece.extractFailed ? (
          <Text style={styles.hint}>We couldn’t read the details for this piece. Add what you know, or retry above.</Text>
        ) : null}
      </View>

      {review ? (
        <View style={styles.rows}>
          <SpecRow
            label="Category"
            value={categoryValue(piece)}
            placeholder="Choose a category"
            flagged={flagged('category')}
            disabled={disabled}
            onPress={() => onOpenSheet('category')}
          />
          <SpecRow
            label="Colour"
            value={colour}
            placeholder="Add colour"
            flagged={flagged('color')}
            swatch={colour ? getSwatchColor(colour).primary : null}
            expanded={expandedRow === 'color'}
            disabled={disabled}
            onPress={() => toggle('color')}
          >
            <SwatchRow
              selected={(piece.colorNormalized as NormalizedColor | null | undefined) ?? null}
              disabled={disabled}
              onPick={(key) => onUpdate({ color: normalizedColorDisplayName(key), colorNormalized: key })}
            />
          </SpecRow>
          {more ? <>
          <SpecRow
            label="Material"
            value={piece.material}
            placeholder="Add material"
            flagged={flagged('material')}
            disabled={disabled}
            onPress={() => onOpenSheet('material')}
          />
          <SpecRow
            label="Details"
            value={details}
            placeholder="Style, season, fit"
            flagged={flagged('fit')}
            expanded={expandedRow === 'details'}
            disabled={disabled}
            onPress={() => toggle('details')}
          >
            <DetailsPanel piece={piece} disabled={disabled} onUpdate={onUpdate} />
          </SpecRow>
          </> : (
            <TouchableOpacity style={styles.moreRow} onPress={() => setMore(true)} disabled={disabled} accessibilityRole="button" accessibilityLabel="More details: material, style, season, fit">
              <Text style={styles.moreText}>More details</Text>
              <Text style={styles.moreHint}>Material, style, season, fit</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

function BrandEyebrow({ brand, flagged, disabled, onPress }: {
  brand: string;
  flagged: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.brandRow}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={brand ? `Brand, ${brand}` : 'Add a brand, optional'}
      accessibilityHint={flagged ? 'Worth checking' : undefined}
    >
      {brand ? (
        <Text style={styles.brand} numberOfLines={1}>{brand}</Text>
      ) : (
        <Text style={styles.brandEmpty}>+ Add brand</Text>
      )}
      {flagged ? <FlagDot /> : null}
    </TouchableOpacity>
  );
}

function EditableTitle({ value, flagged, disabled, onChange }: {
  value: string;
  flagged: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.titleRow}>
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => { setFocused(true); }}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoCapitalize="words"
        returnKeyType="done"
        blurOnSubmit
        placeholder="Name this piece"
        placeholderTextColor={colors.tertiary}
        multiline={false}
        style={[styles.title, focused && styles.titleFocused]}
        accessibilityLabel="Item name"
        accessibilityHint={flagged ? 'Worth checking' : undefined}
      />
      {flagged ? <FlagDot style={styles.titleFlag} /> : null}
    </View>
  );
}

function SpecRow({ label, value, placeholder, flagged, swatch, italicValue, expanded, disabled, onPress, children }: {
  label: string;
  value: string | null;
  placeholder: string;
  flagged: boolean;
  swatch?: string | null;
  italicValue?: boolean;
  expanded?: boolean;
  disabled: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  const expandable = children !== undefined;
  return (
    <Animated.View layout={LinearTransition.duration(200)} style={styles.row}>
      <TouchableOpacity
        style={styles.rowPress}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value ?? 'not set'}`}
        accessibilityHint={flagged ? 'Worth checking' : undefined}
        accessibilityState={expandable ? { expanded: Boolean(expanded) } : undefined}
      >
        <View style={styles.rowLabelWrap}>
          <Text style={styles.rowLabel}>{label}</Text>
          {flagged ? <FlagDot /> : null}
        </View>
        <View style={styles.rowValueWrap}>
          {swatch ? <View style={[styles.valueSwatch, { backgroundColor: swatch }]} /> : null}
          <Text
            style={[styles.rowValue, (!value || italicValue) && styles.rowValueItalic, !value && styles.rowValueEmpty]}
            numberOfLines={1}
          >
            {value ?? placeholder}
          </Text>
          <Ionicons
            name={expandable ? (expanded ? 'chevron-up' : 'chevron-down') : 'chevron-forward'}
            size={14}
            color={colors.tertiary}
          />
        </View>
      </TouchableOpacity>
      {expanded && children ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.rowBody}>{children}</Animated.View>
      ) : null}
    </Animated.View>
  );
}

function SwatchRow({ selected, disabled, onPick }: {
  selected: NormalizedColor | null;
  disabled: boolean;
  onPick: (color: NormalizedColor) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches} keyboardShouldPersistTaps="handled">
      {NORMALIZED_COLORS.map((key) => {
        const hex = NORMALIZED_COLOR_HEX[key];
        const on = selected === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onPick(key)}
            disabled={disabled}
            style={[styles.swatchRing, on && styles.swatchRingOn]}
            accessibilityRole="button"
            accessibilityLabel={normalizedColorDisplayName(key)}
            accessibilityState={{ selected: on }}
          >
            <View style={[styles.swatch, { backgroundColor: hex }, isColorLight(hex) && styles.swatchLight]} />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function DetailsPanel({ piece, disabled, onUpdate }: {
  piece: ScanReviewPiece;
  disabled: boolean;
  onUpdate: (patch: PiecePatch) => void;
}) {
  const styleOptions = piece.category && piece.subcategory ? getStyles(piece.category, piece.subcategory) : [];
  const withCurrent = (options: readonly string[], current: string | null) =>
    current && !options.includes(current) ? [current, ...options] : [...options];
  const fitOptions = piece.category
    ? FIT_OPTIONS_BY_CATEGORY[piece.category as ItemCategory] ?? FIT_OPTIONS_DEFAULT
    : FIT_OPTIONS_DEFAULT;

  return (
    <View style={styles.details}>
      <ChipRow
        label="Style"
        options={withCurrent(styleOptions, styleOptions.length > 0 ? piece.style : null).map((value) => ({ value, label: value }))}
        isSelected={(value) => piece.style === value}
        onToggle={(value) => onUpdate({ style: piece.style === value ? null : value })}
        disabled={disabled}
      />
      <ChipRow
        label="Season"
        options={SEASON_CHIPS}
        isSelected={(value) => piece.seasons.includes(value)}
        onToggle={(value) => onUpdate({
          seasons: piece.seasons.includes(value)
            ? piece.seasons.filter((season) => season !== value)
            : [...piece.seasons, value],
        })}
        disabled={disabled}
      />
      <ChipRow
        label="Fit"
        options={withCurrent(fitOptions, fitOptions.length > 0 ? piece.fit : null).map((value) => ({ value, label: value }))}
        isSelected={(value) => piece.fit === value}
        onToggle={(value) => onUpdate({ fit: piece.fit === value ? null : value })}
        disabled={disabled}
      />
      <SizeProfileInput
        category={piece.category}
        subcategory={piece.subcategory}
        style={piece.style}
        formalityValues={piece.occasions}
        value={piece.sizeProfile}
        onChange={(sizeProfile) => onUpdate({ sizeProfile })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginHorizontal: spacing.lg, gap: spacing.md },
  identity: { gap: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', minHeight: 36, marginVertical: 4, paddingHorizontal: spacing.md, borderRadius: radii.full, borderWidth: stroke.fine, borderColor: colors.controlOutline },
  brand: { ...typography.text.eyebrow, color: colors.foreground },
  moreRow: { minHeight: 52, justifyContent: 'center', gap: 2 },
  moreText: { ...typography.text.bodySmall, color: colors.foreground },
  moreHint: { ...typography.text.meta, color: colors.mutedForeground },
  brandEmpty: { ...typography.text.eyebrow, color: colors.tertiary },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    minHeight: 44,
    ...typography.text.editorialSection,
    flex: 1,
    color: colors.foreground,
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: 'transparent',
  },
  titleFocused: { borderBottomWidth: stroke.fine, borderBottomColor: colors.foreground },
  titleFlag: { marginTop: 2 },
  hint: { ...typography.text.bodySmall, color: colors.mutedForeground, paddingTop: spacing.xs },
  rows: { borderTopWidth: stroke.hairline, borderTopColor: colors.hairline },
  row: { borderBottomWidth: stroke.hairline, borderBottomColor: colors.hairline },
  rowPress: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: 96 },
  rowLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  rowValueWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  rowValue: { ...typography.text.body, fontSize: 15, color: colors.foreground, flexShrink: 1, textAlign: 'right' },
  rowValueItalic: { ...typography.text.editorialItalic, fontSize: 16 },
  rowValueEmpty: { color: colors.tertiary },
  valueSwatch: { width: 12, height: 12, borderRadius: 6, borderWidth: stroke.hairline, borderColor: colors.ghostStroke },
  rowBody: { paddingBottom: spacing.lg },
  swatches: { gap: spacing.sm, paddingVertical: 2 },
  swatchRing: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: stroke.fine, borderColor: 'transparent' },
  swatchRingOn: { borderColor: colors.foreground },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  swatchLight: { borderWidth: stroke.hairline, borderColor: colors.ghostStroke },
  details: { gap: spacing.lg },
});
