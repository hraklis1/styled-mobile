/**
 * Field building blocks shared by the Profile sub-screens (Style, Color, Fit,
 * Shopping, Occasions) and the Settings screens. These were extracted from the
 * old single-scroll ProfileScreen unchanged, so the controls look and behave
 * exactly as they did there.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';
import { BrandAutocompleteInput } from '../primitives/BrandAutocompleteInput';
import { SelectionGroup } from '../primitives/SelectionGroup';
import { FASHION_BRANDS } from '../../lib/fashionBrands';
import {
  BUDGET_OPTIONS,
  CATEGORY_BUDGET_KEYS,
  CATEGORY_BUDGET_LABELS,
  PALETTE_OPTIONS,
} from '../../lib/profileOptions';
import type { CategoryBudgetKey, StyleProfileDetails } from '../../types/profile';

export type DetailArrayKey =
  | 'styleAvoids'
  | 'favoriteColors'
  | 'avoidedColors'
  | 'materialLikes'
  | 'materialAvoids'
  | 'patternLikes'
  | 'patternAvoids'
  | 'brandAvoids'
  | 'shoppingPriorities'
  | 'careConstraints';

export type SensitiveArrayKey = 'proportions' | 'coverage' | 'comfort';
export type SizeExtraKey = keyof StyleProfileDetails['sizeExtras'];

export function toggleValue(values: string[], value: string, max?: number): string[] {
  if (values.includes(value)) return values.filter((entry) => entry !== value);
  if (max && values.length >= max) return values;
  return [...values, value];
}

export function uniqueAppend(values: string[], value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return values;
  if (values.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) return values;
  return [...values, trimmed];
}

export function SummaryLine({ values, empty = 'Not set' }: { values: string[]; empty?: string }) {
  const text = values.length ? values.slice(0, 4).join(' · ') : empty;
  return <Text style={styles.summaryLine} numberOfLines={1}>{text}</Text>;
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{children}</Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

/**
 * Both chip groups are now thin wrappers over the shared `SelectionGroup`.
 *
 * They used to be their own implementations, which is how this screen drifted
 * away from the questionnaire it edits — different selected states, no press
 * feedback, and `accessibilityRole` on neither. Keeping the wrappers means the
 * ~20 call sites below did not have to change.
 *
 * `caption` is suppressed by default: this screen is dense, and each field
 * already carries a `FieldLabel` with its own hint. The questionnaire, where
 * the caption is the whole point, passes it through.
 */
export function OptionChips({
  options,
  values,
  onChange,
  max,
  caption = null,
}: {
  options: { value: string; label: string; description?: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  max?: number;
  caption?: string | null;
}) {
  return (
    <SelectionGroup
      mode="multi"
      options={options}
      values={values}
      onChange={onChange}
      max={max}
      layout="pill"
      caption={caption}
    />
  );
}

export function SingleChips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; description?: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SelectionGroup
      mode="single"
      options={options}
      value={value}
      onChange={onChange}
      layout="pill"
      caption={null}
    />
  );
}

export function PalettePicker({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <View style={styles.paletteRow}>
      {PALETTE_OPTIONS.map((palette) => {
        const selected = values.includes(palette.value);
        return (
          <TouchableOpacity
            key={palette.value}
            style={styles.paletteItem}
            onPress={() => onChange(toggleValue(values, palette.value))}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${palette.label} palette`}
          >
            <View style={[styles.swatchRing, selected && styles.swatchRingSel]}>
              <View style={styles.swatchInner}>
                {palette.colors.map((color) => (
                  <View key={color} style={[styles.swatchSeg, { backgroundColor: color }]} />
                ))}
              </View>
            </View>
            <Text style={[styles.paletteLabel, selected && styles.paletteLabelSel]}>{palette.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function TextTagInput({
  label,
  placeholder,
  value,
  onChangeText,
  tags,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  tags: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="done"
          onSubmitEditing={() => onAdd(value)}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(value)} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
      <TagList tags={tags} onRemove={onRemove} />
    </View>
  );
}

export function BrandTagInput({
  label,
  placeholder,
  value,
  onChangeText,
  tags,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  tags: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.inputRow}>
        <BrandAutocompleteInput
          value={value}
          onChangeText={onChangeText}
          onSelect={onAdd}
          suggestions={FASHION_BRANDS.filter((brand) => !tags.includes(brand))}
          placeholder={placeholder}
          style={styles.brandInput}
          containerStyle={{ flex: 1 }}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(value)} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
      <TagList tags={tags} onRemove={onRemove} />
    </View>
  );
}

export function TagList({ tags, onRemove }: { tags: string[]; onRemove: (tag: string) => void }) {
  if (!tags.length) return null;
  return (
    <View style={styles.tagWrap}>
      {tags.map((tag) => (
        <View key={tag} style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
          <TouchableOpacity onPress={() => onRemove(tag)} style={styles.tagX} accessibilityLabel={`Remove ${tag}`}>
            <Ionicons name="close" size={11} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export function planTierLabel(tier: string | null | undefined): string {
  if (tier === 'premium') return 'Premium';
  if (tier === 'beta') return 'Beta Tester';
  return 'Free';
}

export function CreditPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.creditPill}>
      <Text style={styles.creditPillValue}>{value}</Text>
      <Text style={styles.creditPillLabel}>{label}</Text>
    </View>
  );
}

export function CategoryBudgets({
  budgets,
  onChange,
}: {
  budgets: Partial<Record<CategoryBudgetKey, string | null>>;
  onChange: (key: CategoryBudgetKey, value: string) => void;
}) {
  return (
    <View style={styles.categoryBudgetGrid}>
      {CATEGORY_BUDGET_KEYS.map((key) => (
        <View key={key} style={styles.categoryBudgetRow}>
          <Text style={styles.categoryBudgetLabel}>{CATEGORY_BUDGET_LABELS[key]}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.budgetPills}>
            {BUDGET_OPTIONS.map((option) => {
              const selected = budgets[key] === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.miniChip, selected && styles.chipSel]}
                  onPress={() => onChange(key, selected ? '' : option.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.miniChipText, selected && styles.chipTextSel]}>{option.label.replace(' / thrift', '').replace(' ($)', '')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: {
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPhoto: { width: 58, height: 58, borderRadius: radii.lg },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  avatarText: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.bold, color: colors.primary },
  headerInfo: { flex: 1, gap: 4 },
  headerTitle: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.bold, color: colors.foreground, letterSpacing: typography.tracking.none },
  progressTrack: { height: 4, backgroundColor: colors.muted, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%' as any, backgroundColor: colors.primary, borderRadius: 2 },
  summaryMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  styleSummary: { flex: 1, fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  progressLabel: { ...typography.text.caption, color: colors.primary, fontWeight: typography.weight.semibold },
  scroll: { flex: 1 },
  stickyFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  saveFooterBtn: {
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveFooterBtnActive: { backgroundColor: colors.primary },
  saveFooterBtnText: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  saveFooterBtnTextActive: { color: colors.primaryForeground },
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  hint: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  summaryLine: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  planHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  planBadgeText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.primary, letterSpacing: typography.tracking.compact, textTransform: 'uppercase' },
  upgradeBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.primary },
  upgradeBtnText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  creditsBlock: { gap: spacing.sm },
  creditsTotalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  creditsTotalLabel: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  creditsTotalValue: { fontSize: typography.text.pageTitle.fontSize, fontWeight: typography.weight.bold, color: colors.foreground },
  creditsBreakdownRow: { flexDirection: 'row', gap: spacing.sm },
  creditPill: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.muted },
  creditPillValue: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  creditPillLabel: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  freeUsageBlock: { gap: spacing.sm },
  divTop: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 0,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.foreground,
  },
  brandInput: {
    height: 44,
    borderWidth: 0,
    backgroundColor: colors.surfaceSubtle,
    fontSize: typography.text.bodySmall.fontSize,
  },
  textarea: { minHeight: 76, textAlignVertical: 'top', paddingTop: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 44, justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  chipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDim: { opacity: 0.35 },
  chipText: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  chipTextSel: { color: colors.white },
  chipSubgroup: { gap: spacing.xs },
  chipSubgroupLabel: { ...typography.text.caption, color: colors.mutedForeground, fontWeight: typography.weight.semibold },
  miniChip: { minHeight: 44, justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  miniChipText: { ...typography.text.caption, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  paletteItem: { alignItems: 'center', gap: 4 },
  swatchRing: { width: 46, height: 46, borderRadius: 23, padding: 2, borderWidth: 2.5, borderColor: 'transparent' },
  swatchRingSel: { borderColor: colors.primary },
  swatchInner: { flex: 1, borderRadius: 20, overflow: 'hidden', flexDirection: 'row' },
  swatchSeg: { flex: 1 },
  paletteLabel: { ...typography.text.caption, color: colors.mutedForeground },
  paletteLabelSel: { color: colors.primary, fontWeight: typography.weight.semibold },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: { minHeight: 44, justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  pillSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  pillTextSel: { color: colors.white },
  twoCol: { flexDirection: 'row', alignItems: 'stretch' },
  twoColDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  twoColFields: { gap: spacing.lg },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondary,
    borderRadius: radii.full,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs + 2,
    paddingVertical: spacing.xs,
  },
  tagText: { fontSize: typography.text.caption.fontSize, color: colors.secondaryForeground, fontWeight: typography.weight.medium },
  tagX: { width: 44, height: 44, borderRadius: radii.full, backgroundColor: `${colors.border}80`, alignItems: 'center', justifyContent: 'center' },
  addLink: { minHeight: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs },
  addLinkText: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  removeLink: { fontSize: typography.text.caption.fontSize, color: colors.error },
  advToggle: { minHeight: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  advToggleText: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  sizeExtrasGrid: { gap: spacing.md },
  sizeExtraField: { gap: spacing.xs },
  sizeExtraLabel: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontWeight: typography.weight.semibold },
  categoryBudgetGrid: { gap: spacing.sm },
  categoryBudgetRow: { gap: spacing.xs },
  categoryBudgetLabel: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground, fontWeight: typography.weight.semibold },
  budgetPills: { gap: spacing.xs, paddingVertical: 2 },
  segRow: { flexDirection: 'row', borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', alignSelf: 'flex-start' },
  seg: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2, backgroundColor: colors.background },
  segSel: { backgroundColor: colors.primary },
  segText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  segTextSel: { color: colors.white },
  voiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  voiceCard: {
    width: '47%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
    gap: 2,
  },
  voiceCardSel: { backgroundColor: `${colors.primary}12`, borderColor: colors.primary },
  voiceName: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  voiceNameSel: { color: colors.primary },
  voiceDesc: { ...typography.text.caption, color: colors.mutedForeground },
  subTitle: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.muted, borderRadius: radii.md, marginTop: spacing.xs },
  emailKey: { fontSize: typography.text.caption.fontSize, color: colors.mutedForeground },
  emailVal: { fontSize: typography.text.caption.fontSize, color: colors.foreground, fontWeight: typography.weight.medium },
  outlineBtn: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  outlineBtnText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  restoreBtnText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.error}30`,
  },
  signOutText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.error },
  legalSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, gap: spacing.sm },
  legalLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legalLinkText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.medium, color: colors.primary },
  dangerZone: { borderTopWidth: 1, borderTopColor: `${colors.error}25`, paddingTop: spacing.lg, gap: spacing.sm },
  dangerTitle: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.error },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.error}35`,
  },
  deleteBtnText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.error },
});

export const dm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.card, borderRadius: radii.xl, padding: spacing.xl, width: '100%' },
  title: { fontSize: typography.text.sectionTitle.fontSize, fontWeight: typography.weight.bold, color: colors.foreground, marginBottom: spacing.sm },
  body: { fontSize: typography.text.bodySmall.fontSize, color: colors.mutedForeground, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.muted, alignItems: 'center' },
  cancelText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  confirmBtn: { flex: 1, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.error, alignItems: 'center' },
  confirmText: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.white },
});

