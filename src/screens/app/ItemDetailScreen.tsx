import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useItems, useCreateItem, useUpdateItem, useDeleteItem, useMarkItemWorn } from '../../hooks/useItems';
import { api } from '../../lib/api';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../../types/item';
import type { ItemCategory } from '../../types/item';
import { getSubcategories, getStyles } from '../../lib/taxonomy';
import type { ItemDetailScreenProps } from '../../navigation/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const SEASONS: { value: string; label: string }[] = [
  { value: 'summer', label: 'Summer' },
  { value: 'winter', label: 'Winter' },
  { value: 'spring_fall', label: 'Spring/Fall' },
  { value: 'all', label: 'All Season' },
];

const OCCASIONS: { value: string; label: string }[] = [
  { value: 'casual', label: 'Casual' },
  { value: 'smart_casual', label: 'Smart Casual' },
  { value: 'business', label: 'Business' },
  { value: 'formal', label: 'Formal' },
  { value: 'party', label: 'Party' },
  { value: 'workout', label: 'Workout' },
];

const FORMALITY_OPTIONS = [
  'Athleisure', 'Lounge', 'Casual', 'Smart Casual',
  'Business Casual', 'Professional', 'Night Out', 'Formal',
];

// Fit options scoped to each garment category
const FIT_OPTIONS_BY_CATEGORY: Record<string, string[]> = {
  top: [
    'Slim Fit', 'Regular Fit', 'Relaxed Fit', 'Oversized',
    'Fitted', 'Tailored', 'Athletic Fit', 'Compression',
    'Boxy', 'Cropped', 'Longline',
  ],
  bottom: [
    'Slim Fit', 'Regular Fit', 'Relaxed Fit',
    'Skinny', 'Straight Leg', 'Tapered', 'Wide Leg', 'Bootcut', 'Flared',
    'Cropped', 'Athletic Fit', 'Compression',
  ],
  full_body: [
    'Slim Fit', 'Regular Fit', 'Relaxed Fit', 'Oversized',
    'Fitted', 'Tailored', 'Bodycon', 'A-Line', 'Wrap',
    'Boxy', 'Cropped', 'Longline',
  ],
  outerwear: [
    'Slim Fit', 'Regular Fit', 'Relaxed Fit', 'Oversized',
    'Fitted', 'Tailored', 'Athletic Fit', 'Boxy', 'Cropped', 'Longline',
  ],
  shoes: [
    'Regular Width', 'Wide Width', 'Narrow Width',
    'Slim', 'Regular',
  ],
  accessory: [],
  valuables: [],
};

// Shown when no category is selected yet
const FIT_OPTIONS_DEFAULT = [
  'Slim Fit', 'Regular Fit', 'Relaxed Fit', 'Oversized', 'Fitted', 'Tailored',
  'Athletic Fit', 'Compression', 'Boxy', 'Cropped', 'Longline',
  'Skinny', 'Straight Leg', 'Tapered', 'Wide Leg', 'Bootcut', 'Flared',
  'A-Line', 'Bodycon', 'Wrap',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeTag(s: string): string {
  return s.trim().toLowerCase().slice(0, 40);
}

function dedupeTags(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    const n = normalizeTag(t);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Chip({ label, color: bg }: { label: string; color?: string }) {
  return (
    <View style={[chipStyles.chip, bg ? { backgroundColor: bg + '22', borderColor: bg + '55' } : null]}>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
});

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.card}>
      <Text style={sectionStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
});

// ─── Edit form atoms ──────────────────────────────────────────────────────────

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={editStyles.section}>
      <Text style={editStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function EditLabel({ children }: { children: React.ReactNode }) {
  return <Text style={editStyles.label}>{children}</Text>;
}

function EditInput({
  value, onChangeText, placeholder, multiline, maxLength, autoCapitalize,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  return (
    <TextInput
      style={[editStyles.input, multiline && editStyles.inputMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      multiline={multiline}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      returnKeyType={multiline ? 'default' : 'done'}
    />
  );
}

function OptionChips<T extends string>({
  options,
  value,
  onSelect,
  multi,
  multiValue,
  onMultiToggle,
}: {
  options: { value: T; label: string }[] | string[];
  value?: T | null;
  onSelect?: (v: T) => void;
  multi?: boolean;
  multiValue?: string[];
  onMultiToggle?: (v: string) => void;
}) {
  return (
    <View style={editStyles.optionChipsRow}>
      {(options as any[]).map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const lbl = typeof opt === 'string' ? opt : opt.label;
        const active = multi
          ? (multiValue ?? []).includes(val)
          : value === val;
        return (
          <TouchableOpacity
            key={val}
            style={[editStyles.optionChip, active && editStyles.optionChipActive]}
            onPress={() => {
              if (multi && onMultiToggle) onMultiToggle(val);
              else if (onSelect) onSelect(val as T);
            }}
            activeOpacity={0.7}
          >
            <Text style={[editStyles.optionChipText, active && editStyles.optionChipTextActive]}>
              {lbl}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Fit Dropdown ────────────────────────────────────────────────────────────

function FitDropdown({ value, options, onChange }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const noOptions = options.length === 0;

  return (
    <>
      <TouchableOpacity
        style={[ddStyles.button, noOptions && ddStyles.buttonDisabled]}
        onPress={() => { if (!noOptions) setOpen(true); }}
        activeOpacity={0.7}
        disabled={noOptions}
      >
        <Text style={[ddStyles.buttonText, !value && ddStyles.placeholder]}>
          {noOptions ? 'N/A for this category' : (value || 'Select fit…')}
        </Text>
        {!noOptions && (
          <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={ddStyles.overlay}>
          <TouchableOpacity style={ddStyles.backdrop} onPress={() => setOpen(false)} activeOpacity={1} />
          <View style={[ddStyles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={ddStyles.handle} />
            <Text style={ddStyles.sheetTitle}>Fit</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={ddStyles.list}
            >
              {/* None option */}
              <TouchableOpacity
                style={ddStyles.option}
                onPress={() => { onChange(''); setOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[ddStyles.optionText, ddStyles.optionTextMuted]}>— None —</Text>
                {!value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[ddStyles.option, value === opt && ddStyles.optionSelected]}
                  onPress={() => { onChange(opt); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[ddStyles.optionText, value === opt && ddStyles.optionTextSelected]}>
                    {opt}
                  </Text>
                  {value === opt && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const ddStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.card,
    minHeight: 44,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: typography.size.md,
    color: colors.foreground,
    flex: 1,
  },
  placeholder: {
    color: colors.mutedForeground,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg + 4,
    borderTopRightRadius: radii.lg + 4,
    paddingTop: spacing.sm,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  list: {
    paddingTop: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.muted,
  },
  optionText: {
    fontSize: typography.size.md,
    color: colors.foreground,
  },
  optionTextSelected: {
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  optionTextMuted: {
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function ItemDetailScreen({ route, navigation }: ItemDetailScreenProps) {
  const { itemId, scanData, scanImageUrl } = route.params;
  const isCreateMode = !itemId && !!scanData;

  const { data: items = [] } = useItems();
  const item = items.find((i) => i.id === itemId);

  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const markWorn = useMarkItemWorn();

  const { width } = useWindowDimensions();
  const imageHeight = width * 0.85;
  const insets = useSafeAreaInsets();

  // ── Inline tag state ────────────────────────────────────────────────────────
  const [inlineTagActive, setInlineTagActive] = useState(false);
  const [inlineTagValue, setInlineTagValue] = useState('');
  const inlineTagRef = useRef<TextInput>(null);

  // ── Re-scan state ────────────────────────────────────────────────────────────
  const [rescanning, setRescanning] = useState(false);

  // ── Edit modal state ─────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editCategory, setEditCategory] = useState<ItemCategory | null>(null);
  const [editSubcategory, setEditSubcategory] = useState('');
  const [editStyle, setEditStyle] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editSeason, setEditSeason] = useState('');
  const [editOccasion, setEditOccasion] = useState('');
  const [editPattern, setEditPattern] = useState('');
  const [editFit, setEditFit] = useState('');
  const [editNeckline, setEditNeckline] = useState('');
  const [editFormalityStyles, setEditFormalityStyles] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editMaterial, setEditMaterial] = useState('');
  const [editCare, setEditCare] = useState('');

  const [createModeInitialized, setCreateModeInitialized] = useState(false);

  useEffect(() => {
    if (!isCreateMode || createModeInitialized || !scanData) return;
    // setTimeout(0) lets the navigation transition finish before batching 17 state updates + modal animation
    setTimeout(() => {
      setEditName(scanData.name ?? '');
      setEditBrand(scanData.brand ?? '');
      setEditCategory(scanData.category ?? null);
      setEditSubcategory(scanData.subcategory ?? '');
      setEditStyle(scanData.style ?? '');
      setEditColor(scanData.color ?? '');
      setEditSeason(scanData.season ?? '');
      setEditOccasion(scanData.occasion ?? '');
      setEditPattern(scanData.pattern ?? '');
      setEditFit(scanData.fit ?? '');
      setEditNeckline(scanData.neckline ?? '');
      setEditFormalityStyles(Array.isArray(scanData.formalityStyles) ? [...scanData.formalityStyles] : []);
      setEditTags(Array.isArray(scanData.tags) ? [...scanData.tags] : []);
      setEditMaterial(scanData.material ?? '');
      setEditCare(scanData.care ?? '');
      setEditNotes('');
      setEditTagInput('');
      setEditOpen(true);
      setCreateModeInitialized(true);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally no deps — run once on mount; scanData is stable from nav params
  }, []);

  if (!item && !isCreateMode) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── View mode handlers ───────────────────────────────────────────────────────

  const handleToggleFavorite = () => {
    if (!item) return;
    updateItem.mutate({ id: item.id, isFavorite: !item.isFavorite });
  };

  const handleMarkWorn = () => {
    if (!item) return;
    markWorn.mutate(item.id);
  };

  const handleDelete = () => {
    if (!item) return;
    Alert.alert(
      'Remove item',
      `Remove "${item.name}" from your wardrobe? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            deleteItem.mutate(item.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  // ── Inline tag handlers ──────────────────────────────────────────────────────

  const removeTagInline = (tag: string) => {
    if (!item) return;
    const newTags = (item.tags ?? []).filter((t) => t !== tag);
    updateItem.mutate({ id: item.id, tags: newTags });
  };

  const commitInlineTag = () => {
    if (!item) return;
    const next = normalizeTag(inlineTagValue);
    setInlineTagActive(false);
    setInlineTagValue('');
    if (!next || (item.tags ?? []).includes(next)) return;
    const newTags = dedupeTags([...(item.tags ?? []), next]);
    updateItem.mutate({ id: item.id, tags: newTags });
  };

  // ── Re-scan handler ───────────────────────────────────────────────────────────

  const handleRescan = async (overrideImageData?: string) => {
    if (!item) return;
    const imageData = overrideImageData ?? item.imageUrl;
    if (!imageData) return;
    setRescanning(true);
    try {
      const res = await api.post('/api/items/scan', { imageData });
      const scanned = res.data as any;
      updateItem.mutate({
        id: item.id,
        ...(overrideImageData ? { imageUrl: overrideImageData } : {}),
        name: scanned.name || item.name,
        brand: scanned.brand || item.brand,
        category: scanned.category || item.category,
        color: scanned.color || item.color,
        subcategory: scanned.subcategory || null,
        style: scanned.style || null,
        season: scanned.season || item.season,
        occasion: scanned.occasion || item.occasion,
        pattern: scanned.pattern || null,
        material: scanned.material || null,
        fit: scanned.fit || null,
        neckline: scanned.neckline || null,
        formalityStyles: Array.isArray(scanned.formalityStyles) ? scanned.formalityStyles : [],
        notableDetails: Array.isArray(scanned.notableDetails) ? scanned.notableDetails : [],
        colorPalette: Array.isArray(scanned.colorPalette) ? scanned.colorPalette : [],
      });
    } catch {
      Alert.alert('Scan failed', 'Could not analyse the item. Please try again.');
    } finally {
      setRescanning(false);
    }
  };

  const pickAndChangePhoto = async (source: 'camera' | 'library') => {
    const pickFn =
      source === 'camera'
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

    const result = await pickFn({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${asset.base64}`;
    await handleRescan(dataUrl);
  };

  const handleChangePhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) pickAndChangePhoto('camera');
          if (idx === 2) pickAndChangePhoto('library');
        }
      );
    } else {
      Alert.alert('Change photo', 'Choose a source', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Camera', onPress: () => pickAndChangePhoto('camera') },
        { text: 'Photo Library', onPress: () => pickAndChangePhoto('library') },
      ]);
    }
  };

  // ── Edit modal handlers ───────────────────────────────────────────────────────

  const openEdit = () => {
    if (!item) return;
    setEditName(item.name);
    setEditBrand(item.brand ?? '');
    setEditCategory(item.category);
    setEditSubcategory(item.subcategory ?? '');
    setEditStyle(item.style ?? '');
    setEditColor(item.color ?? '');
    setEditSeason(item.season ?? '');
    setEditOccasion(item.occasion ?? '');
    setEditPattern(item.pattern ?? '');
    setEditFit(item.fit ?? '');
    setEditNeckline(item.neckline ?? '');
    setEditFormalityStyles(Array.isArray(item.formalityStyles) ? [...item.formalityStyles] : []);
    setEditTags(Array.isArray(item.tags) ? [...item.tags] : []);
    setEditTagInput('');
    setEditNotes(item.notes ?? '');
    setEditMaterial(item.material ?? '');
    setEditCare(item.care ?? '');
    setEditOpen(true);
  };

  const handleEditCategoryChange = (cat: ItemCategory) => {
    setEditCategory(cat);
    setEditSubcategory('');
    setEditStyle('');
    // Reset fit if it's no longer valid for the new category
    const nextFitOptions = FIT_OPTIONS_BY_CATEGORY[cat] ?? [];
    if (editFit && nextFitOptions.length > 0 && !nextFitOptions.includes(editFit)) {
      setEditFit('');
    }
  };

  const handleEditSubcategoryChange = (sub: string) => {
    setEditSubcategory(sub === editSubcategory ? '' : sub);
    setEditStyle('');
  };

  const handleEditStyleChange = (s: string) => {
    setEditStyle(s === editStyle ? '' : s);
  };

  const commitEditTag = () => {
    const next = normalizeTag(editTagInput);
    setEditTagInput('');
    if (!next || editTags.includes(next)) return;
    setEditTags((prev) => [...prev, next]);
  };

  const removeEditTag = (tag: string) => {
    setEditTags((prev) => prev.filter((t) => t !== tag));
  };

  const toggleEditFormality = (style: string) => {
    setEditFormalityStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const handleSaveEdit = () => {
    // commit any pending tag input
    const pendingTag = normalizeTag(editTagInput);
    const finalTags = pendingTag && !editTags.includes(pendingTag)
      ? dedupeTags([...editTags, pendingTag])
      : dedupeTags(editTags);

    const necklineValue = (editCategory === 'top' || editCategory === 'outerwear')
      ? (editNeckline.trim() || null)
      : null;

    if (isCreateMode) {
      createItem.mutate(
        {
          name: editName.trim() || 'Untitled',
          brand: editBrand.trim() || null,
          category: editCategory,
          subcategory: editSubcategory || null,
          style: editStyle || null,
          color: editColor.trim() || null,
          season: editSeason || null,
          occasion: editOccasion || null,
          pattern: editPattern.trim() || null,
          fit: editFit.trim() || null,
          neckline: necklineValue,
          formalityStyles: editFormalityStyles,
          tags: finalTags,
          notes: editNotes.trim() || null,
          material: editMaterial.trim() || null,
          care: editCare.trim() || null,
          imageUrl: scanImageUrl ?? null,
          notableDetails: scanData?.notableDetails ?? [],
          colorPalette: scanData?.colorPalette ?? [],
        },
        {
          onSuccess: (newItem) => {
            setEditOpen(false);
            navigation.replace('ItemDetail', { itemId: newItem.id });
          },
          onError: () => Alert.alert('Save failed', 'Could not save the item. Please try again.'),
        }
      );
    } else {
      updateItem.mutate(
        {
          id: item!.id,
          name: editName.trim() || item!.name,
          brand: editBrand.trim() || null,
          category: editCategory,
          subcategory: editSubcategory || null,
          style: editStyle || null,
          color: editColor.trim() || null,
          season: editSeason || null,
          occasion: editOccasion || null,
          pattern: editPattern.trim() || null,
          fit: editFit.trim() || null,
          neckline: necklineValue,
          formalityStyles: editFormalityStyles,
          tags: finalTags,
          notes: editNotes.trim() || null,
          material: editMaterial.trim() || null,
          care: editCare.trim() || null,
        },
        {
          onSuccess: () => setEditOpen(false),
        }
      );
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  // Needed by renderEditModal closure below
  const editSubcats = editCategory ? getSubcategories(editCategory) : [];
  const editStyleOptions = editCategory && editSubcategory
    ? getStyles(editCategory, editSubcategory)
    : [];

  // ── Create mode early return ─────────────────────────────────────────────────
  // Must come BEFORE view-mode variable declarations so item is guaranteed non-null
  // for everything that follows. The edit modal is inlined here (same JSX as below)
  // to avoid the runtime crash from item being undefined while viewItem vars are set.
  if (isCreateMode) {
    return (
      <View style={styles.flex}>
        {scanImageUrl && (
          <View style={styles.createImageContainer}>
            <Image
              source={{ uri: scanImageUrl }}
              style={styles.createImage}
              resizeMode="contain"
            />
          </View>
        )}
        <Modal
          visible={editOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => navigation.goBack()}
        >
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[editStyles.header, { paddingTop: insets.top + spacing.md }]}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={editStyles.headerButton}
                disabled={createItem.isPending}
              >
                <Text style={editStyles.headerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={editStyles.headerTitle}>Review Scan</Text>
              <TouchableOpacity
                onPress={handleSaveEdit}
                style={[editStyles.headerButton, !editName.trim() && editStyles.headerButtonDisabled]}
                disabled={createItem.isPending || !editName.trim()}
              >
                {createItem.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={editStyles.headerSave}>Add to Wardrobe</Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.flex}
              contentContainerStyle={editStyles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <EditSection title="Basic Info">
                <EditLabel>Name *</EditLabel>
                <EditInput value={editName} onChangeText={setEditName} placeholder="e.g. White Linen Shirt" maxLength={120} />
                <View style={editStyles.spacer} />
                <EditLabel>Brand</EditLabel>
                <EditInput value={editBrand} onChangeText={setEditBrand} placeholder="e.g. Zara" maxLength={80} />
              </EditSection>
              <EditSection title="Category">
                <EditLabel>Type</EditLabel>
                <View style={editStyles.optionChipsRow}>
                  {CATEGORY_ORDER.map((cat) => {
                    const active = editCategory === cat;
                    return (
                      <TouchableOpacity key={cat} style={[editStyles.optionChip, active && editStyles.optionChipActive]} onPress={() => handleEditCategoryChange(cat)} activeOpacity={0.7}>
                        <Text style={[editStyles.optionChipText, active && editStyles.optionChipTextActive]}>{CATEGORY_LABELS[cat]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {editSubcats.length > 0 && (
                  <>
                    <View style={editStyles.spacer} />
                    <EditLabel>Sub-category</EditLabel>
                    <View style={editStyles.optionChipsRow}>
                      {editSubcats.map((sub) => {
                        const active = editSubcategory === sub;
                        return (
                          <TouchableOpacity key={sub} style={[editStyles.optionChip, active && editStyles.optionChipActive]} onPress={() => handleEditSubcategoryChange(sub)} activeOpacity={0.7}>
                            <Text style={[editStyles.optionChipText, active && editStyles.optionChipTextActive]}>{sub}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
                {editStyleOptions.length > 0 && (
                  <>
                    <View style={editStyles.spacer} />
                    <EditLabel>Style</EditLabel>
                    <View style={editStyles.optionChipsRow}>
                      {editStyleOptions.map((s) => {
                        const active = editStyle === s;
                        return (
                          <TouchableOpacity key={s} style={[editStyles.optionChip, active && editStyles.optionChipActive]} onPress={() => handleEditStyleChange(s)} activeOpacity={0.7}>
                            <Text style={[editStyles.optionChipText, active && editStyles.optionChipTextActive]}>{s}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </EditSection>
              <EditSection title="Colour & Season">
                <EditLabel>Colour</EditLabel>
                <EditInput value={editColor} onChangeText={setEditColor} placeholder="e.g. Navy Blue" maxLength={80} />
                <View style={editStyles.spacer} />
                <EditLabel>Season</EditLabel>
                <OptionChips options={SEASONS} value={editSeason} onSelect={(v) => setEditSeason(v === editSeason ? '' : v)} />
                <View style={editStyles.spacer} />
                <EditLabel>Occasion</EditLabel>
                <OptionChips options={OCCASIONS} value={editOccasion} onSelect={(v) => setEditOccasion(v === editOccasion ? '' : v)} />
              </EditSection>
              <EditSection title="Fit & Cut">
                <EditLabel>Pattern</EditLabel>
                <EditInput value={editPattern} onChangeText={setEditPattern} placeholder="e.g. Solid, Striped, Floral" maxLength={60} />
                <View style={editStyles.spacer} />
                <EditLabel>Fit</EditLabel>
                <FitDropdown value={editFit} options={editCategory ? (FIT_OPTIONS_BY_CATEGORY[editCategory] ?? []) : FIT_OPTIONS_DEFAULT} onChange={setEditFit} />
                {(editCategory === 'top' || editCategory === 'outerwear') && (
                  <>
                    <View style={editStyles.spacer} />
                    <EditLabel>Neckline</EditLabel>
                    <EditInput value={editNeckline} onChangeText={setEditNeckline} placeholder="e.g. V-neck, Crew neck" maxLength={60} />
                  </>
                )}
              </EditSection>
              <EditSection title="Style Context">
                <OptionChips options={FORMALITY_OPTIONS} multi multiValue={editFormalityStyles} onMultiToggle={toggleEditFormality} />
              </EditSection>
              <EditSection title="Tags">
                <View style={editStyles.tagsBox}>
                  {editTags.map((tag) => (
                    <TouchableOpacity key={tag} style={editStyles.tagChip} onPress={() => removeEditTag(tag)} activeOpacity={0.7}>
                      <Text style={editStyles.tagChipText}>{tag}</Text>
                      <Ionicons name="close" size={11} color={colors.mutedForeground} style={{ marginLeft: 3 }} />
                    </TouchableOpacity>
                  ))}
                  <TextInput
                    style={editStyles.tagInput}
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
              <EditSection title="Notes">
                <EditInput value={editNotes} onChangeText={setEditNotes} placeholder="Fit, fabric, care, anything memorable…" multiline maxLength={500} />
              </EditSection>
              <EditSection title="Fabric & Care">
                <View style={editStyles.row}>
                  <View style={editStyles.rowHalf}>
                    <EditLabel>Material</EditLabel>
                    <EditInput value={editMaterial} onChangeText={setEditMaterial} placeholder="e.g. 100% Cotton" maxLength={120} />
                  </View>
                  <View style={editStyles.rowHalf}>
                    <EditLabel>Care</EditLabel>
                    <EditInput value={editCare} onChangeText={setEditCare} placeholder="e.g. Wash cold" maxLength={120} />
                  </View>
                </View>
              </EditSection>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  // ── View mode: after both early returns, item is guaranteed non-null ────────────
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const viewItem = item!; // TypeScript can't narrow across two separate if-guards above
  const imageUri = resolveImageUri(viewItem.imageUrl);
  const breadcrumb = [
    viewItem.category ? CATEGORY_LABELS[viewItem.category] : null,
    viewItem.subcategory,
    viewItem.style,
  ].filter(Boolean).join(' › ');
  const hasRichProfile = !!(
    viewItem.subcategory || viewItem.style || viewItem.pattern || viewItem.material || viewItem.fit ||
    (viewItem.formalityStyles?.length > 0) || (viewItem.notableDetails?.length > 0)
  );
  const isBusy = updateItem.isPending || markWorn.isPending || deleteItem.isPending;

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image */}
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.imagePlaceholder, { height: imageHeight }]}>
              <Ionicons name="shirt-outline" size={64} color={colors.border} />
            </View>
          )}
          {/* Back button */}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + spacing.sm }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </TouchableOpacity>
          {/* Favourite badge */}
          {viewItem.isFavorite && (
            <View style={[styles.favBadge, { top: insets.top + spacing.sm }]}>
              <Ionicons name="heart" size={14} color={colors.primary} />
            </View>
          )}
          {/* Change photo button */}
          <TouchableOpacity
            style={styles.changePhotoBtn}
            onPress={handleChangePhoto}
            disabled={rescanning}
          >
            {rescanning ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Ionicons name="camera" size={16} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.name}>{viewItem.name}</Text>
            {viewItem.brand ? <Text style={styles.brand}>{viewItem.brand}</Text> : null}
            {breadcrumb ? <Text style={styles.breadcrumb}>{breadcrumb}</Text> : null}
          </View>
        </View>

        {/* Action row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, markWorn.isPending && styles.actionDisabled]}
            onPress={handleMarkWorn}
            disabled={isBusy}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Worn today</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, updateItem.isPending && styles.actionDisabled]}
            onPress={handleToggleFavorite}
            disabled={isBusy}
          >
            <Ionicons
              name={viewItem.isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={viewItem.isFavorite ? colors.primary : colors.foreground}
            />
            <Text style={styles.actionLabel}>{viewItem.isFavorite ? 'Favourited' : 'Favourite'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDelete}
            disabled={isBusy}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.actionLabel, { color: colors.error }]}>Remove</Text>
          </TouchableOpacity>
        </View>

        {/* AI Style Profile */}
        <SectionCard title="AI Style Profile">
          {!hasRichProfile ? (
            <View style={styles.rescanEmpty}>
              <Text style={styles.rescanEmptyText}>
                Detailed stylist profile not yet available.
              </Text>
              <TouchableOpacity
                style={[styles.rescanButton, (rescanning || !viewItem.imageUrl) && styles.actionDisabled]}
                onPress={() => handleRescan()}
                disabled={rescanning || !viewItem.imageUrl}
              >
                {rescanning ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                )}
                <Text style={styles.rescanButtonText}>
                  {rescanning ? 'Analysing…' : 'Re-scan item'}
                </Text>
              </TouchableOpacity>
              {!viewItem.imageUrl && (
                <Text style={styles.rescanHint}>Add a photo first to enable re-scanning.</Text>
              )}
            </View>
          ) : (
            <>
              {/* Re-scan button (small, in top-right of section) */}
              {viewItem.imageUrl && (
                <TouchableOpacity
                  style={styles.rescanMini}
                  onPress={() => handleRescan()}
                  disabled={rescanning}
                >
                  {rescanning ? (
                    <ActivityIndicator size="small" color={colors.mutedForeground} />
                  ) : (
                    <Ionicons name="refresh-outline" size={14} color={colors.mutedForeground} />
                  )}
                  <Text style={styles.rescanMiniText}>Re-scan</Text>
                </TouchableOpacity>
              )}

              {viewItem.colorPalette?.length > 0 && (
                <View style={styles.swatchRow}>
                  {viewItem.colorPalette.map((hex, i) => (
                    <View
                      key={i}
                      style={[styles.swatch, { backgroundColor: hex }]}
                    />
                  ))}
                </View>
              )}
              <View style={styles.chipRow}>
                {viewItem.pattern ? <Chip label={viewItem.pattern} /> : null}
                {viewItem.fit ? <Chip label={viewItem.fit} /> : null}
                {viewItem.neckline ? <Chip label={viewItem.neckline} /> : null}
                {viewItem.formalityStyles?.map((s) => <Chip key={s} label={s} />)}
                {viewItem.notableDetails?.map((d) => <Chip key={d} label={d} />)}
              </View>
            </>
          )}
        </SectionCard>

        {/* Details */}
        <SectionCard title="Details">
          <View style={styles.detailGrid}>
            {viewItem.color && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Colour</Text>
                <Text style={styles.detailValue}>{viewItem.color}</Text>
              </View>
            )}
            {viewItem.season && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Season</Text>
                <Text style={styles.detailValue}>{viewItem.season.replace('_', '/')}</Text>
              </View>
            )}
            {viewItem.occasion && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Occasion</Text>
                <Text style={styles.detailValue}>{viewItem.occasion.replace('_', ' ')}</Text>
              </View>
            )}
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Times worn</Text>
              <Text style={styles.detailValue}>{viewItem.wearCount}</Text>
            </View>
            {viewItem.lastWornAt && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Last worn</Text>
                <Text style={styles.detailValue}>{formatDate(viewItem.lastWornAt)}</Text>
              </View>
            )}
          </View>
        </SectionCard>

        {/* Tags (with inline add/remove) */}
        <SectionCard title="Tags">
          <View style={styles.chipRow}>
            {(viewItem.tags ?? []).map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.tagChip}
                onPress={() => removeTagInline(tag)}
                activeOpacity={0.7}
                disabled={updateItem.isPending}
              >
                <Text style={styles.tagChipText}>{tag}</Text>
                <Ionicons name="close" size={11} color={colors.mutedForeground} style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            ))}

            {inlineTagActive ? (
              <TextInput
                ref={inlineTagRef}
                style={styles.inlineTagInput}
                value={inlineTagValue}
                onChangeText={setInlineTagValue}
                onSubmitEditing={commitInlineTag}
                onBlur={commitInlineTag}
                placeholder="tag name…"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                maxLength={40}
                autoCapitalize="none"
                returnKeyType="done"
              />
            ) : (
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={() => {
                  setInlineTagActive(true);
                  setTimeout(() => inlineTagRef.current?.focus(), 50);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={13} color={colors.mutedForeground} />
                <Text style={styles.addTagText}>Add tag</Text>
              </TouchableOpacity>
            )}
          </View>
          {(viewItem.tags ?? []).length === 0 && !inlineTagActive && (
            <Text style={styles.emptyHint}>No tags yet — tap Add tag to add one.</Text>
          )}
        </SectionCard>

        {/* Fabric & Care */}
        {(viewItem.material || viewItem.care) ? (
          <SectionCard title="Fabric & Care">
            {viewItem.material && (
              <View style={styles.careRow}>
                <Text style={styles.detailLabel}>Material</Text>
                <Text style={[styles.detailValue, { flex: 3 }]}>{viewItem.material}</Text>
              </View>
            )}
            {viewItem.care && (
              <View style={styles.careRow}>
                <Text style={styles.detailLabel}>Care</Text>
                <Text style={[styles.detailValue, { flex: 3 }]}>{viewItem.care}</Text>
              </View>
            )}
          </SectionCard>
        ) : null}

        {/* Notes */}
        {viewItem.notes ? (
          <SectionCard title="Notes">
            <Text style={styles.notes}>{viewItem.notes}</Text>
          </SectionCard>
        ) : null}

        {/* Edit button */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={openEdit}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.foreground} />
          <Text style={styles.editButtonText}>Edit details</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Edit modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={editOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => isCreateMode ? navigation.goBack() : setEditOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Modal header */}
          <View style={[editStyles.header, { paddingTop: insets.top + spacing.md }]}>
            <TouchableOpacity
              onPress={() => isCreateMode ? navigation.goBack() : setEditOpen(false)}
              style={editStyles.headerButton}
              disabled={updateItem.isPending || createItem.isPending}
            >
              <Text style={editStyles.headerCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={editStyles.headerTitle}>{isCreateMode ? 'Review Scan' : 'Edit Item'}</Text>
            <TouchableOpacity
              onPress={handleSaveEdit}
              style={[editStyles.headerButton, !editName.trim() && editStyles.headerButtonDisabled]}
              disabled={updateItem.isPending || createItem.isPending || !editName.trim()}
            >
              {(updateItem.isPending || createItem.isPending) ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={editStyles.headerSave}>
                  {isCreateMode ? 'Add to Wardrobe' : 'Save'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={editStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Basic Info */}
            <EditSection title="Basic Info">
              <EditLabel>Name *</EditLabel>
              <EditInput
                value={editName}
                onChangeText={setEditName}
                placeholder="e.g. White Linen Shirt"
                maxLength={120}
              />
              <View style={editStyles.spacer} />
              <EditLabel>Brand</EditLabel>
              <EditInput
                value={editBrand}
                onChangeText={setEditBrand}
                placeholder="e.g. Zara"
                maxLength={80}
              />
            </EditSection>

            {/* Category */}
            <EditSection title="Category">
              <EditLabel>Type</EditLabel>
              <View style={editStyles.optionChipsRow}>
                {CATEGORY_ORDER.map((cat) => {
                  const active = editCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[editStyles.optionChip, active && editStyles.optionChipActive]}
                      onPress={() => handleEditCategoryChange(cat)}
                      activeOpacity={0.7}
                    >
                      <Text style={[editStyles.optionChipText, active && editStyles.optionChipTextActive]}>
                        {CATEGORY_LABELS[cat]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {editSubcats.length > 0 && (
                <>
                  <View style={editStyles.spacer} />
                  <EditLabel>Sub-category</EditLabel>
                  <View style={editStyles.optionChipsRow}>
                    {editSubcats.map((sub) => {
                      const active = editSubcategory === sub;
                      return (
                        <TouchableOpacity
                          key={sub}
                          style={[editStyles.optionChip, active && editStyles.optionChipActive]}
                          onPress={() => handleEditSubcategoryChange(sub)}
                          activeOpacity={0.7}
                        >
                          <Text style={[editStyles.optionChipText, active && editStyles.optionChipTextActive]}>
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
                  <View style={editStyles.spacer} />
                  <EditLabel>Style</EditLabel>
                  <View style={editStyles.optionChipsRow}>
                    {editStyleOptions.map((s) => {
                      const active = editStyle === s;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[editStyles.optionChip, active && editStyles.optionChipActive]}
                          onPress={() => handleEditStyleChange(s)}
                          activeOpacity={0.7}
                        >
                          <Text style={[editStyles.optionChipText, active && editStyles.optionChipTextActive]}>
                            {s}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </EditSection>

            {/* Colour & Season */}
            <EditSection title="Colour & Season">
              <EditLabel>Colour</EditLabel>
              <EditInput
                value={editColor}
                onChangeText={setEditColor}
                placeholder="e.g. Navy Blue"
                maxLength={80}
              />
              <View style={editStyles.spacer} />
              <EditLabel>Season</EditLabel>
              <OptionChips
                options={SEASONS}
                value={editSeason}
                onSelect={(v) => setEditSeason(v === editSeason ? '' : v)}
              />
              <View style={editStyles.spacer} />
              <EditLabel>Occasion</EditLabel>
              <OptionChips
                options={OCCASIONS}
                value={editOccasion}
                onSelect={(v) => setEditOccasion(v === editOccasion ? '' : v)}
              />
            </EditSection>

            {/* Fit & Cut */}
            <EditSection title="Fit & Cut">
              <EditLabel>Pattern</EditLabel>
              <EditInput
                value={editPattern}
                onChangeText={setEditPattern}
                placeholder="e.g. Solid, Striped, Floral"
                maxLength={60}
              />
              <View style={editStyles.spacer} />
              <EditLabel>Fit</EditLabel>
              <FitDropdown
                value={editFit}
                options={editCategory ? (FIT_OPTIONS_BY_CATEGORY[editCategory] ?? []) : FIT_OPTIONS_DEFAULT}
                onChange={setEditFit}
              />
              {(editCategory === 'top' || editCategory === 'outerwear') && (
                <>
                  <View style={editStyles.spacer} />
                  <EditLabel>Neckline</EditLabel>
                  <EditInput
                    value={editNeckline}
                    onChangeText={setEditNeckline}
                    placeholder="e.g. V-neck, Crew neck"
                    maxLength={60}
                  />
                </>
              )}
            </EditSection>

            {/* Style Context */}
            <EditSection title="Style Context">
              <OptionChips
                options={FORMALITY_OPTIONS}
                multi
                multiValue={editFormalityStyles}
                onMultiToggle={toggleEditFormality}
              />
            </EditSection>

            {/* Tags */}
            <EditSection title="Tags">
              <View style={editStyles.tagsBox}>
                {editTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={editStyles.tagChip}
                    onPress={() => removeEditTag(tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={editStyles.tagChipText}>{tag}</Text>
                    <Ionicons name="close" size={11} color={colors.mutedForeground} style={{ marginLeft: 3 }} />
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={editStyles.tagInput}
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

            {/* Fabric & Care */}
            <EditSection title="Fabric & Care">
              <View style={editStyles.row}>
                <View style={editStyles.rowHalf}>
                  <EditLabel>Material</EditLabel>
                  <EditInput
                    value={editMaterial}
                    onChangeText={setEditMaterial}
                    placeholder="e.g. 100% Cotton"
                    maxLength={120}
                  />
                </View>
                <View style={editStyles.rowHalf}>
                  <EditLabel>Care</EditLabel>
                  <EditInput
                    value={editCare}
                    onChangeText={setEditCare}
                    placeholder="e.g. Wash cold"
                    maxLength={120}
                  />
                </View>
              </View>
            </EditSection>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: spacing.xxxl },

  // ── Create mode scaffold
  createScaffold: {
    flex: 1,
    backgroundColor: colors.background,
  },
  createImageContainer: {
    width: '100%',
    height: 340,
    backgroundColor: colors.foreground,
  },
  createImage: {
    width: '100%',
    height: '100%',
  },

  imageContainer: {
    width: '100%',
    backgroundColor: colors.muted,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  favBadge: {
    position: 'absolute',
    right: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerText: { gap: 4 },
  name: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  brand: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
  },
  breadcrumb: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  actionRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionDisabled: { opacity: 0.5 },
  actionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },

  // Re-scan
  rescanEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rescanEmptyText: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rescanButtonText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
  rescanHint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  rescanMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginBottom: spacing.sm,
  },
  rescanMiniText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },

  // Profile chips
  swatchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // Details
  detailGrid: { gap: spacing.sm },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  careRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.lg,
  },
  detailLabel: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    flex: 1,
  },
  detailValue: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
    flex: 2,
    textAlign: 'right',
    textTransform: 'capitalize',
  },

  // Inline tags
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagChipText: {
    fontSize: typography.size.xs,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  inlineTagInput: {
    height: 30,
    minWidth: 100,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm + 2,
    fontSize: typography.size.xs,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  addTagText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  emptyHint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },

  notes: {
    fontSize: typography.size.md,
    color: colors.foreground,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },

  // Edit button
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.md + 2,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
});

const editStyles = StyleSheet.create({
  // Modal header
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
  headerButton: {
    minWidth: 60,
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
  headerCancel: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
  },
  headerTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  headerSave: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    textAlign: 'right',
  },

  scrollContent: {
    paddingBottom: 60,
  },

  // Section
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: spacing.sm + 2,
  },

  spacer: {
    height: spacing.md,
  },

  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowHalf: {
    flex: 1,
  },

  // Option chips (radio / multi)
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
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
  },
  optionChipTextActive: {
    color: colors.background,
  },

  // Tags box
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
    fontSize: typography.size.xs,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  tagInput: {
    flex: 1,
    minWidth: 120,
    height: 28,
    fontSize: typography.size.sm,
    color: colors.foreground,
    paddingHorizontal: 4,
    marginBottom: spacing.xs,
  },
});
