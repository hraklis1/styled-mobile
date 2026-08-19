import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCreateItem, useUpdateItem } from '../../hooks/useItems';
import { colors, spacing, typography, radii } from '../../theme';
import {
  CATEGORY_LABELS, CATEGORY_ORDER, NORMALIZED_COLORS,
  PATTERN_OPTIONS, NECKLINE_OPTIONS_BY_CATEGORY,
  COLOR_TEMPERATURE_OPTIONS, COLOR_TEMPERATURE_LABELS, MATERIAL_OPTIONS, CARE_OPTIONS,
  SEASON_OPTIONS, SEASON_LABELS, OCCASION_OPTIONS, OCCASION_LABELS,
  CONDITION_OPTIONS, CONDITION_LABELS, WARMTH_RATINGS, WARMTH_LABELS,
  FIT_OPTIONS_BY_CATEGORY, FIT_OPTIONS_DEFAULT,
  SLEEVE_LENGTH_OPTIONS, SLEEVE_LENGTH_LABELS,
} from '../../types/item';
import type { ItemCategory, Item, NormalizedColor, ScanResult, SleeveLength } from '../../types/item';
import { getSubcategories, getStyles } from '../../lib/taxonomy';
import { normalizeTag, dedupeTags } from '../../lib/tags';
import { NORMALIZED_COLOR_HEX, isColorLight, normalizedColorDisplayName, parseMaterialString } from '../../lib/colorUtils';
import { EditSection, EditLabel, EditInput, OptionChips } from '../primitives/EditAtoms';
import { FitDropdown } from '../primitives/FitDropdown';
import { BottomSheetDropdown } from '../primitives/BottomSheetDropdown';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEASONS = SEASON_OPTIONS.map((value) => ({ value, label: SEASON_LABELS[value] }));

const OCCASIONS = OCCASION_OPTIONS.map((value) => ({ value, label: OCCASION_LABELS[value] }));

const CONDITIONS = CONDITION_OPTIONS.map((value) => ({ value, label: CONDITION_LABELS[value] }));

const WARMTH_OPTIONS = WARMTH_RATINGS.map((value) => ({ value, label: WARMTH_LABELS[value] }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedCareOptions(raw: string | null): { matched: string[]; custom: string } {
  if (!raw) return { matched: [], custom: '' };
  const tokens = raw.split(',').map(t => t.trim()).filter(Boolean);
  const matched = tokens.filter(t => (CARE_OPTIONS as readonly string[]).includes(t));
  const unmatched = tokens.filter(t => !(CARE_OPTIONS as readonly string[]).includes(t));
  return { matched, custom: unmatched.join(', ') };
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  item: Item | null;
  isCreateMode: boolean;
  scanImageUrl?: string | null;
  scanData?: ScanResult | null;
  onClose: () => void;
  onCreateSuccess: (newItemId: number) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function EditItemModal({
  visible,
  item,
  isCreateMode,
  scanImageUrl,
  scanData,
  onClose,
  onCreateSuccess,
}: Props) {
  const insets = useSafeAreaInsets();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();

  // ── Form state ───────────────────────────────────────────────────────────────
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editCategory, setEditCategory] = useState<ItemCategory | null>(null);
  const [editSubcategory, setEditSubcategory] = useState('');
  const [editStyle, setEditStyle] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editSeasons, setEditSeasons] = useState<string[]>([]);
  const [editOccasions, setEditOccasions] = useState<string[]>([]);
  const [editCondition, setEditCondition] = useState('good');
  const [editWarmthRating, setEditWarmthRating] = useState<number | null>(null);
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editPurchaseLocation, setEditPurchaseLocation] = useState('');
  const [editPattern, setEditPattern] = useState('');
  const [editFit, setEditFit] = useState('');
  const [editNeckline, setEditNeckline] = useState('');
  const [editSleeveLength, setEditSleeveLength] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editMaterial, setEditMaterial] = useState('');
  const [editColorNormalized, setEditColorNormalized] = useState<NormalizedColor | null>(null);
  const [editColorTemperature, setEditColorTemperature] = useState<string | null>(null);
  const [editMaterials, setEditMaterials] = useState<string[]>([]);
  const [editCareOptions, setEditCareOptions] = useState<string[]>([]);
  const [editCareCustom, setEditCareCustom] = useState('');

  // ── Seed state when modal opens ───────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (isCreateMode && scanData) {
      setEditName(scanData.name ?? '');
      setEditBrand('');
      setEditCategory(scanData.category ?? null);
      setEditSubcategory(scanData.subcategory ?? '');
      setEditStyle(scanData.style ?? '');
      setEditColor(scanData.color ?? '');
      setEditSeasons(Array.isArray(scanData.seasons) ? [...scanData.seasons] : []);
      setEditOccasions(Array.isArray(scanData.occasions) ? [...scanData.occasions] : []);
      setEditCondition('good');
      setEditWarmthRating(null);
      setEditPurchasePrice('');
      setEditPurchaseDate('');
      setEditPurchaseLocation('');
      setEditPattern(scanData.pattern ?? '');
      setEditFit(scanData.fit ?? '');
      setEditNeckline(scanData.neckline ?? '');
      setEditSleeveLength(scanData.sleeveLength ?? '');
      setEditTags(Array.isArray(scanData.tags) ? [...scanData.tags] : []);
      setEditTagInput('');
      setEditNotes('');
      setEditMaterial(scanData.material ?? '');
      setEditColorNormalized((scanData.colorNormalized as NormalizedColor | null) ?? null);
      setEditColorTemperature(scanData.colorTemperature ?? null);
      setEditMaterials(parseMaterialString(scanData.material ?? ''));
      const careSeeded = seedCareOptions(scanData.care);
      setEditCareOptions(careSeeded.matched);
      setEditCareCustom(careSeeded.custom);
    } else if (item) {
      setEditName(item.name);
      setEditBrand(item.brand ?? '');
      setEditCategory(item.category);
      setEditSubcategory(item.subcategory ?? '');
      setEditStyle(item.style ?? '');
      setEditColor(item.color ?? '');
      setEditSeasons(Array.isArray(item.seasons) ? [...item.seasons] : []);
      setEditOccasions(Array.isArray(item.occasions) ? [...item.occasions] : []);
      setEditCondition(item.condition ?? 'good');
      setEditWarmthRating(item.warmthRating ?? null);
      setEditPurchasePrice(item.purchasePrice != null ? String(item.purchasePrice) : '');
      setEditPurchaseDate((item as any).purchaseDate ?? '');
      setEditPurchaseLocation(item.purchaseLocation ?? '');
      setEditPattern(item.pattern ?? '');
      setEditFit(item.fit ?? '');
      setEditNeckline(item.neckline ?? '');
      setEditSleeveLength(item.sleeveLength ?? '');
      setEditTags(Array.isArray(item.tags) ? [...item.tags] : []);
      setEditTagInput('');
      setEditNotes(item.notes ?? '');
      setEditMaterial(item.material ?? '');
      setEditColorNormalized((item.colorNormalized as NormalizedColor | null) ?? null);
      setEditColorTemperature(item.colorTemperature ?? null);
      setEditMaterials(parseMaterialString(item.material ?? ''));
      const { matched, custom } = seedCareOptions(item.care);
      setEditCareOptions(matched);
      setEditCareCustom(custom);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Intentionally seeds only when visibility changes — not on every item/scanData update
  }, [visible]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const editSubcats = editCategory ? getSubcategories(editCategory) : [];
  const editStyleOptions = editCategory && editSubcategory
    ? getStyles(editCategory, editSubcategory)
    : [];

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleCategoryChange = (cat: ItemCategory) => {
    setEditCategory(cat);
    setEditSubcategory('');
    setEditStyle('');
    const nextFits = FIT_OPTIONS_BY_CATEGORY[cat] ?? [];
    if (editFit && nextFits.length > 0 && !nextFits.includes(editFit)) setEditFit('');
  };

  const handleSubcategoryChange = (sub: string) => {
    setEditSubcategory(sub === editSubcategory ? '' : sub);
    setEditStyle('');
  };

  const handleStyleChange = (s: string) => setEditStyle(s === editStyle ? '' : s);

  const commitEditTag = () => {
    const next = normalizeTag(editTagInput);
    setEditTagInput('');
    if (!next || editTags.includes(next)) return;
    setEditTags((prev) => [...prev, next]);
  };

  const removeEditTag = (tag: string) => setEditTags((prev) => prev.filter((t) => t !== tag));

  const handleSave = () => {
    const pendingTag = normalizeTag(editTagInput);
    const finalTags = pendingTag && !editTags.includes(pendingTag)
      ? dedupeTags([...editTags, pendingTag])
      : dedupeTags(editTags);

    const necklineValue = (editCategory ? NECKLINE_OPTIONS_BY_CATEGORY[editCategory] : undefined)
      ? (editNeckline || null)
      : null;

    const sleeveLengthValue: SleeveLength | null = (editCategory ? NECKLINE_OPTIONS_BY_CATEGORY[editCategory] : undefined)
      ? ((editSleeveLength as SleeveLength) || null)
      : null;

    const parsedPrice = editPurchasePrice.trim() ? parseFloat(editPurchasePrice.trim()) : null;
    const derivedMaterial = editMaterials.length ? editMaterials.join(', ') : null;
    const derivedCare = [...editCareOptions, editCareCustom.trim()].filter(Boolean).join(', ') || null;

    if (isCreateMode) {
      createItem.mutate(
        {
          name: editName.trim() || 'Untitled',
          brand: editBrand.trim() || null,
          category: editCategory,
          subcategory: editSubcategory || null,
          style: editStyle || null,
          color: editColor.trim() || null,
          colorNormalized: editColorNormalized,
          colorTemperature: editColorTemperature,
          seasons: editSeasons,
          occasions: editOccasions,
          condition: editCondition || null,
          warmthRating: editWarmthRating,
          purchasePrice: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : null,
          purchaseDate: editPurchaseDate.trim() || null,
          purchaseLocation: editPurchaseLocation.trim() || null,
          pattern: editPattern || null,
          fit: editFit.trim() || null,
          neckline: necklineValue,
          sleeveLength: sleeveLengthValue,
          tags: finalTags,
          notes: editNotes.trim() || null,
          material: derivedMaterial,
          care: derivedCare,
          imageUrl: scanImageUrl ?? null,
          notableDetails: scanData?.notableDetails ?? [],
          colorPalette: scanData?.colorPalette ?? [],
        },
        {
          onSuccess: (newItem) => onCreateSuccess(newItem.id),
          onError: () => Alert.alert('Save failed', 'Could not save the item. Please try again.'),
        }
      );
    } else if (item) {
      updateItem.mutate(
        {
          id: item.id,
          name: editName.trim() || item.name,
          brand: editBrand.trim() || null,
          category: editCategory,
          subcategory: editSubcategory || null,
          style: editStyle || null,
          color: editColor.trim() || null,
          colorNormalized: editColorNormalized,
          colorTemperature: editColorTemperature,
          seasons: editSeasons,
          occasions: editOccasions,
          condition: editCondition || null,
          warmthRating: editWarmthRating,
          purchasePrice: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : null,
          purchaseDate: editPurchaseDate.trim() || null,
          purchaseLocation: editPurchaseLocation.trim() || null,
          pattern: editPattern || null,
          fit: editFit.trim() || null,
          neckline: necklineValue,
          sleeveLength: sleeveLengthValue,
          tags: finalTags,
          notes: editNotes.trim() || null,
          material: derivedMaterial,
          care: derivedCare,
        },
        { onSuccess: onClose }
      );
    }
  };

  const isSaving = createItem.isPending || updateItem.isPending;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerButton}
            disabled={isSaving}
          >
            <Text style={styles.headerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isCreateMode ? 'Review Scan' : 'Edit Item'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.headerButton, !editName.trim() && styles.headerButtonDisabled]}
            disabled={isSaving || !editName.trim()}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.headerSave}>
                {isCreateMode ? 'Add to Wardrobe' : 'Save'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Basic Info */}
          <EditSection title="Basic Info">
            <EditLabel>Name *</EditLabel>
            <EditInput value={editName} onChangeText={setEditName} placeholder="e.g. White Linen Shirt" maxLength={120} />
            <View style={styles.spacer} />
            <EditLabel>Brand</EditLabel>
            <EditInput value={editBrand} onChangeText={setEditBrand} placeholder="e.g. Zara" maxLength={80} />
          </EditSection>

          {/* Category */}
          <EditSection title="Category">
            <EditLabel>Type</EditLabel>
            <View style={styles.optionChipsRow}>
              {CATEGORY_ORDER.map((cat) => {
                const active = editCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.optionChip, active && styles.optionChipActive]}
                    onPress={() => handleCategoryChange(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {editSubcats.length > 0 && (
              <>
                <View style={styles.spacer} />
                <EditLabel>Sub-category</EditLabel>
                <View style={styles.optionChipsRow}>
                  {editSubcats.map((sub) => {
                    const active = editSubcategory === sub;
                    return (
                      <TouchableOpacity
                        key={sub}
                        style={[styles.optionChip, active && styles.optionChipActive]}
                        onPress={() => handleSubcategoryChange(sub)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                          {sub}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {editStyleOptions.length > 0 && (
              <>
                <View style={styles.spacer} />
                <EditLabel>Style</EditLabel>
                <View style={styles.optionChipsRow}>
                  {editStyleOptions.map((s) => {
                    const active = editStyle === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.optionChip, active && styles.optionChipActive]}
                        onPress={() => handleStyleChange(s)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </EditSection>

          {/* Fit & Cut */}
          <EditSection title="Fit & Cut">
            <EditLabel>Pattern</EditLabel>
            <OptionChips
              options={[...PATTERN_OPTIONS]}
              value={editPattern as any}
              onSelect={(v: any) => setEditPattern(editPattern === v ? '' : v)}
            />
            <View style={styles.spacer} />
            <EditLabel>Fit</EditLabel>
            <FitDropdown
              value={editFit}
              options={[...(editCategory ? (FIT_OPTIONS_BY_CATEGORY[editCategory] ?? []) : FIT_OPTIONS_DEFAULT)]}
              onChange={setEditFit}
            />
            {(editCategory ? NECKLINE_OPTIONS_BY_CATEGORY[editCategory] : undefined) && (
              <>
                <View style={styles.spacer} />
                <EditLabel>Neckline</EditLabel>
                <BottomSheetDropdown
                  title="Neckline"
                  options={[...((editCategory ? NECKLINE_OPTIONS_BY_CATEGORY[editCategory] : undefined) ?? [])]}
                  value={editNeckline}
                  onChange={setEditNeckline}
                  placeholder="Select neckline…"
                />
                <View style={styles.spacer} />
                <EditLabel>Sleeve Length</EditLabel>
                <OptionChips
                  options={[...SLEEVE_LENGTH_OPTIONS].map(v => ({ value: v, label: SLEEVE_LENGTH_LABELS[v] }))}
                  value={editSleeveLength as any}
                  onSelect={(v) => setEditSleeveLength(v === editSleeveLength ? '' : v)}
                />
              </>
            )}
          </EditSection>

          {/* Colour & Season */}
          <EditSection title="Colour & Season">
            <EditLabel>Colour</EditLabel>
            <View style={styles.swatchGrid}>
              {NORMALIZED_COLORS.map((nc) => {
                const hex = NORMALIZED_COLOR_HEX[nc];
                const isSelected = editColorNormalized === nc;
                const light = isColorLight(hex);
                return (
                  <TouchableOpacity
                    key={nc}
                    style={[styles.swatch, { backgroundColor: hex }, isSelected && styles.swatchSelected]}
                    onPress={() => { setEditColorNormalized(nc); setEditColor(normalizedColorDisplayName(nc)); }}
                    activeOpacity={0.75}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color={light ? '#28231F' : '#FFFFFF'} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.spacer} />
            <EditLabel>Custom colour name (optional)</EditLabel>
            <EditInput
              value={editColor}
              onChangeText={(v) => { setEditColor(v); if (!v.trim()) setEditColorNormalized(null); }}
              placeholder="e.g. Dusty Rose"
              maxLength={80}
            />
            <View style={styles.spacer} />
            <EditLabel>Colour temperature</EditLabel>
            <OptionChips
              options={COLOR_TEMPERATURE_OPTIONS.map((value) => ({ value, label: COLOR_TEMPERATURE_LABELS[value] }))}
              value={editColorTemperature as any}
              onSelect={(v: any) => setEditColorTemperature(editColorTemperature === v ? null : v)}
            />
            <View style={styles.spacer} />
            <EditLabel>Season (select all that apply)</EditLabel>
            <OptionChips
              options={SEASONS}
              multi
              multiValue={editSeasons}
              onMultiToggle={(v) => setEditSeasons((prev) => prev.includes(v) ? prev.filter((s) => s !== v) : [...prev, v])}
            />
            <View style={styles.spacer} />
            <EditLabel>Occasion (select all that apply)</EditLabel>
            <OptionChips
              options={OCCASIONS}
              multi
              multiValue={editOccasions}
              onMultiToggle={(v) => setEditOccasions((prev) => prev.includes(v) ? prev.filter((o) => o !== v) : [...prev, v])}
            />
          </EditSection>

          {/* Condition & Warmth (edit mode only) */}
          {!isCreateMode && (
            <EditSection title="Condition & Warmth">
              <EditLabel>Condition</EditLabel>
              <OptionChips
                options={CONDITIONS}
                value={editCondition as any}
                onSelect={(v) => setEditCondition(v)}
              />
              <View style={styles.spacer} />
              <EditLabel>Warmth Rating</EditLabel>
              <OptionChips
                options={WARMTH_OPTIONS.map((w) => ({ value: String(w.value), label: w.label }))}
                value={editWarmthRating != null ? String(editWarmthRating) : null}
                onSelect={(v) => setEditWarmthRating(editWarmthRating === Number(v) ? null : Number(v))}
              />
            </EditSection>
          )}

          {/* Fabric & Care */}
          <EditSection title="Fabric & Care">
            <EditLabel>Fabric</EditLabel>
            <BottomSheetDropdown
              title="Fabric"
              options={[...MATERIAL_OPTIONS]}
              multi
              multiValue={editMaterials}
              onMultiToggle={(v) => setEditMaterials((prev) => prev.includes(v) ? prev.filter((m) => m !== v) : [...prev, v])}
              placeholder="Select fabrics…"
              searchable
            />
            <View style={styles.spacer} />
            <EditLabel>Care instructions</EditLabel>
            <OptionChips
              options={[...CARE_OPTIONS]}
              multi
              multiValue={editCareOptions}
              onMultiToggle={(v) => setEditCareOptions((prev) => prev.includes(v) ? prev.filter((c) => c !== v) : [...prev, v])}
            />
            <View style={styles.spacer} />
            <EditLabel>Additional care notes</EditLabel>
            <EditInput
              value={editCareCustom}
              onChangeText={setEditCareCustom}
              placeholder="Any other care instructions…"
              maxLength={120}
            />
          </EditSection>

          {/* Purchase Info (edit mode only) */}
          {!isCreateMode && (
            <EditSection title="Purchase Info">
              <EditLabel>Purchase Price</EditLabel>
              <EditInput
                value={editPurchasePrice}
                onChangeText={setEditPurchasePrice}
                placeholder="e.g. 89.99"
                maxLength={12}
              />
              <View style={styles.spacer} />
              <EditLabel>Purchase Date</EditLabel>
              <EditInput
                value={editPurchaseDate}
                onChangeText={setEditPurchaseDate}
                placeholder="YYYY-MM-DD"
                maxLength={10}
              />
              <View style={styles.spacer} />
              <EditLabel>Purchase Location</EditLabel>
              <EditInput
                value={editPurchaseLocation}
                onChangeText={setEditPurchaseLocation}
                placeholder="e.g. New York, Paris"
                maxLength={100}
              />
            </EditSection>
          )}

          {/* Tags */}
          <EditSection title="Tags">
            <View style={styles.tagsBox}>
              {editTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tagChip}
                  onPress={() => removeEditTag(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <Ionicons name="close" size={11} color={colors.mutedForeground} style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              ))}
              <TextInput
                style={styles.tagInput}
                value={editTagInput}
                onChangeText={setEditTagInput}
                onSubmitEditing={commitEditTag}
                onBlur={commitEditTag}
                placeholder={editTags.length === 0 ? 'Add a tag (Enter to add)…' : 'Add tag…'}
                placeholderTextColor={colors.mutedForeground}
                maxLength={40}
                autoCapitalize="none"
                returnKeyType="done"
                blurOnSubmit={false}
              />
            </View>
          </EditSection>

          {/* Notes */}
          <EditSection title="Notes">
            <EditInput
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Fit, fabric, care, anything memorable…"
              multiline
              maxLength={500}
            />
          </EditSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerButton: { minWidth: 60 },
  headerButtonDisabled: { opacity: 0.4 },
  headerCancel: {
    fontSize: typography.text.body.fontSize,
    color: colors.mutedForeground,
  },
  headerTitle: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  headerSave: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    textAlign: 'right',
  },

  scrollContent: { paddingBottom: 60 },
  spacer: { height: spacing.md },

  // Category chips
  optionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  optionChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionChipActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  optionChipText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  optionChipTextActive: { color: colors.background },

  // Colour swatches
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: 2,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 2.5,
    borderColor: colors.primary,
  },

  // Tags
  tagsBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.card,
    minHeight: 44,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagChipText: {
    fontSize: typography.text.caption.fontSize,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  tagInput: {
    flex: 1,
    minWidth: 120,
    height: 28,
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.foreground,
    paddingHorizontal: 4,
    marginBottom: spacing.xs,
  },
});
