import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { track } from '../../lib/analytics';
import { useItems } from '../../hooks/useItems';
import { useCreateOutfit } from '../../hooks/useOutfits';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, spacing, typography, radii } from '../../theme';
import { OutfitCollage } from './OutfitCollage';
import { OCCASIONS } from '../../lib/occasions';
import type { OccasionId } from '../../lib/occasions';
import { OCCASION_LABELS, SEASON_LABELS } from '../../types/item';
import type { Item, ItemCategory, Occasion, Season } from '../../types/item';
import type { Outfit } from '../../types/outfit';
import * as Haptics from 'expo-haptics';

// ─── Slot config ──────────────────────────────────────────────────────────────

type SlotKey = 'topId' | 'bottomId' | 'shoesId' | 'outerwearId' | 'layerId' | 'headwearId' | 'bagId' | 'accessoryId';

type SlotDef = {
  key: SlotKey;
  label: string;
  categories: ItemCategory[];
  subcategories?: string[];
  excludedSubcategories?: string[];
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const SLOTS: SlotDef[] = [
  { key: 'topId',       label: 'Top / Dress',    categories: ['top', 'full_body'],  icon: 'shirt-outline' },
  { key: 'layerId',     label: 'Layer',          categories: ['top'],               icon: 'layers-outline' },
  { key: 'bottomId',    label: 'Bottom',         categories: ['bottom'],            icon: 'body-outline' },
  { key: 'shoesId',     label: 'Shoes',          categories: ['shoes'],             icon: 'footsteps-outline' },
  { key: 'outerwearId', label: 'Outerwear',      categories: ['outerwear'],         icon: 'trending-up-outline' },
  { key: 'headwearId',  label: 'Hat / Headwear', categories: ['accessory'], subcategories: ['Hats & Headwear'], icon: 'glasses-outline' },
  { key: 'bagId',       label: 'Bag',            categories: ['accessory'], subcategories: ['Bags & Purses'],   icon: 'bag-outline' },
  { key: 'accessoryId', label: 'Accessory',      categories: ['accessory'], excludedSubcategories: ['Hats & Headwear', 'Bags & Purses'], icon: 'watch-outline' },
];

type SlotMap = Partial<Record<SlotKey, Item>>;

type PickerFilterRowProps = {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  getLabel?: (value: string) => string;
};

function PickerFilterRow({
  label,
  values,
  selected,
  onToggle,
  getLabel = (value) => value,
}: PickerFilterRowProps) {
  return (
    <View style={styles.pickerFilterGroup}>
      <Text style={styles.pickerFilterGroupLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pickerFilterChips}
      >
        {values.map((value) => {
          const active = selected.includes(value);
          return (
            <TouchableOpacity
              key={value}
              style={[styles.pickerFilterChip, active && styles.pickerFilterChipActive]}
              onPress={() => onToggle(value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerFilterChipText, active && styles.pickerFilterChipTextActive]}>
                {getLabel(value)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function inferSlotKey(item: Item): SlotKey | null {
  const text = `${item.name} ${item.subcategory ?? ''}`.toLowerCase();
  if (/shoe|sneaker|boot|sandal|heel|loafer|pump|flat|footwear|mule|clog|slipper/i.test(text)) return 'shoesId';
  if (/jacket|coat|blazer|parka|anorak|trench|outerwear/i.test(text)) return 'outerwearId';
  if (/sweater|cardigan|hoodie|pullover|sweatshirt/i.test(text)) return 'layerId';
  if (/dress|jumpsuit|romper|playsuit|overall|dungaree/i.test(text)) return 'topId';
  if (/jeans|pants|trousers|shorts|skirt|legging|chino|bottom/i.test(text)) return 'bottomId';
  if (/top|shirt|blouse|tee|tank|polo|crop|tube/i.test(text)) return 'topId';
  if (/hat|cap|beanie|beret|fedora|snapback|visor|bucket hat/i.test(text)) return 'headwearId';
  if (/bag|purse|clutch|tote|backpack|handbag|satchel/i.test(text)) return 'bagId';
  if (/watch|necklace|ring|bracelet|scarf|belt|earring|sunglasses/i.test(text)) return 'accessoryId';
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (outfit: Outfit) => void;
  initialItems?: Item[];
};

// ─── Component ────────────────────────────────────────────────────────────────

export function OutfitBuilderSheet({ visible, onClose, onCreated, initialItems }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const { data: allItems = [] } = useItems();
  const createOutfit = useCreateOutfit();

  // ── Form ───────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState<OccasionId | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<SlotMap>({});
  const [unmatchedItems, setUnmatchedItems] = useState<Item[]>([]);

  // ── Picker ─────────────────────────────────────────────────────────────
  const [view, setView] = useState<'form' | 'picker'>('form');
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerFiltersOpen, setPickerFiltersOpen] = useState(false);
  const [pickerFavoritesOnly, setPickerFavoritesOnly] = useState(false);
  const [pickerAvailableOnly, setPickerAvailableOnly] = useState(false);
  const [pickerColors, setPickerColors] = useState<string[]>([]);
  const [pickerSeasons, setPickerSeasons] = useState<string[]>([]);
  const [pickerOccasions, setPickerOccasions] = useState<string[]>([]);

  const isFullBodyTop = slots.topId?.category === 'full_body';

  // Synthetic outfit fed to OutfitCollage so it can render a live preview
  const previewOutfit = useMemo<Outfit>(() => ({
    id: -1,
    name: '',
    description: null,
    userId: 0,
    event: null,
    itemIds: Object.values(slots).map((item) => ({ id: item.id, category: item.category ?? '' })),
    tags: [],
    notes: null,
    isDraft: false,
    aiGeneratedImageUrl: null,
    wearCount: 0,
    lastWornAt: null,
    createdAt: '',
  }), [slots]);

  const categoryPickerItems = useMemo(() => {
    if (!activeSlot) return [];
    const slot = SLOTS.find((s) => s.key === activeSlot);
    if (!slot) return [];
    return allItems.filter((item) => {
      if (!item.category || !(slot.categories as string[]).includes(item.category)) return false;
      if (slot.subcategories) {
        return item.subcategory != null &&
          slot.subcategories.some((sc) => item.subcategory!.includes(sc));
      }
      if (slot.excludedSubcategories && item.subcategory != null) {
        if (slot.excludedSubcategories.some((sc) => item.subcategory!.includes(sc))) return false;
      }
      return true;
    });
  }, [activeSlot, allItems]);

  const pickerFilterOptions = useMemo(() => ({
    colors: [...new Set(categoryPickerItems
      .map((item) => item.colorNormalized ?? item.color)
      .filter((value): value is string => !!value))].sort(),
    seasons: [...new Set(categoryPickerItems.flatMap((item) => item.seasons ?? []))].sort(),
    occasions: [...new Set(categoryPickerItems.flatMap((item) => item.occasions ?? []))].sort(),
  }), [categoryPickerItems]);

  const pickerItems = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    const selectedId = activeSlot ? slots[activeSlot]?.id : undefined;
    return categoryPickerItems
      .filter((item) => {
        if (pickerFavoritesOnly && !item.isFavorite) return false;
        if (pickerAvailableOnly && item.laundryStatus && item.laundryStatus !== 'clean') return false;
        const itemColor = item.colorNormalized ?? item.color;
        if (pickerColors.length > 0 && (!itemColor || !pickerColors.includes(itemColor))) return false;
        if (pickerSeasons.length > 0 && !item.seasons?.some((value) => pickerSeasons.includes(value))) return false;
        if (pickerOccasions.length > 0 && !item.occasions?.some((value) => pickerOccasions.includes(value))) return false;
        if (!query) return true;
        return [
          item.name,
          item.brand,
          item.color,
          item.colorNormalized,
          item.subcategory,
          item.style,
          item.material,
          item.pattern,
          ...(item.tags ?? []),
        ].some((value) => value?.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (a.id === selectedId) return -1;
        if (b.id === selectedId) return 1;
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        if (a.wearCount !== b.wearCount) return b.wearCount - a.wearCount;
        const lastWornDiff =
          (b.lastWornAt ? new Date(b.lastWornAt).getTime() : 0) -
          (a.lastWornAt ? new Date(a.lastWornAt).getTime() : 0);
        if (lastWornDiff !== 0) return lastWornDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [
    activeSlot,
    categoryPickerItems,
    pickerAvailableOnly,
    pickerColors,
    pickerFavoritesOnly,
    pickerOccasions,
    pickerSearch,
    pickerSeasons,
    slots,
  ]);

  const pickerActiveFilterCount =
    Number(pickerFavoritesOnly) +
    Number(pickerAvailableOnly) +
    pickerColors.length +
    pickerSeasons.length +
    pickerOccasions.length;

  const clearPickerFilters = useCallback(() => {
    setPickerFavoritesOnly(false);
    setPickerAvailableOnly(false);
    setPickerColors([]);
    setPickerSeasons([]);
    setPickerOccasions([]);
  }, []);

  const resetPickerControls = useCallback(() => {
    setPickerSearch('');
    setPickerFiltersOpen(false);
    clearPickerFilters();
  }, [clearPickerFilters]);

  const togglePickerFilter = useCallback((
    value: string,
    setValues: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setValues((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }, []);

  const openPicker = (slotKey: SlotKey) => {
    resetPickerControls();
    setActiveSlot(slotKey);
    setView('picker');
  };

  const selectItem = (item: Item) => {
    if (!activeSlot) return;
    setSlots((prev) => {
      const next = { ...prev, [activeSlot]: item };
      if (activeSlot === 'topId' && item.category === 'full_body') {
        delete next.bottomId;
      }
      return next;
    });
    resetPickerControls();
    setView('form');
  };

  const clearSlot = useCallback((slotKey: SlotKey) => {
    setSlots((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setName('');
    setOccasion(null);
    setTags([]);
    setTagInput('');
    setNotes('');
    setSlots({});
    setUnmatchedItems([]);
    setView('form');
    setActiveSlot(null);
    resetPickerControls();
  }, [resetPickerControls]);

  // Pre-seed slots when the sheet opens with pre-selected items.
  // Use a ref so the effect only depends on `visible`, not the array identity.
  const initialItemsRef = useRef(initialItems);
  initialItemsRef.current = initialItems;
  useEffect(() => {
    if (!visible) return;
    const items = initialItemsRef.current;
    if (!items || items.length === 0) return;
    const newSlots: SlotMap = {};
    const unmatched: Item[] = [];
    for (const item of items) {
      let placed = false;
      // Primary: match by category (and subcategory when slot requires it)
      for (const slot of SLOTS) {
        const categoryMatch = item.category && (slot.categories as string[]).includes(item.category);
        const subcategoryMatch = !slot.subcategories ||
          (item.subcategory != null && slot.subcategories.some((sc) => item.subcategory!.includes(sc)));
        const isExcluded = slot.excludedSubcategories && item.subcategory != null &&
          slot.excludedSubcategories.some((sc) => item.subcategory!.includes(sc));
        if (categoryMatch && subcategoryMatch && !isExcluded && !newSlots[slot.key]) {
          newSlots[slot.key] = item;
          placed = true;
          break;
        }
      }
      // Fallback: infer slot from item name / subcategory for uncategorized items
      if (!placed) {
        const inferredKey = inferSlotKey(item);
        if (inferredKey && !newSlots[inferredKey]) {
          newSlots[inferredKey] = item;
          placed = true;
        }
      }
      if (!placed) unmatched.push(item);
    }
    setSlots(newSlots);
    setUnmatchedItems(unmatched);
  }, [visible]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const commitTagInput = useCallback((raw: string) => {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed) {
      setTags((prev) => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    }
    setTagInput('');
  }, []);

  const handleSave = () => {
    if (!name.trim() || createOutfit.isPending) return;
    const pendingTag = tagInput.trim().toLowerCase();
    const parsedTags = pendingTag
      ? tags.includes(pendingTag) ? tags : [...tags, pendingTag]
      : tags;
    const outfitItemIds = SLOTS
      .filter((s) => !!slots[s.key])
      .map((s) => ({ id: slots[s.key]!.id, category: slots[s.key]!.category as string }));

    createOutfit.mutate(
      {
        name: name.trim(),
        event: occasion ?? null,
        notes: notes.trim() || null,
        tags: parsedTags,
        itemIds: outfitItemIds,
      },
      {
        onSuccess: (outfit) => {
          track('outfit_created', { item_count: Object.keys(slots).length });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          reset();
          onCreated?.(outfit);
        },
      }
    );
  };

  // ── Picker grid sizing ─────────────────────────────────────────────────
  const PICKER_COLS = 3;
  const PICKER_GAP = spacing.sm;
  const PICKER_H_PAD = spacing.lg;
  const pickerCardWidth =
    (screenWidth - PICKER_H_PAD * 2 - PICKER_GAP * (PICKER_COLS - 1)) / PICKER_COLS;
  const pickerCardHeight = pickerCardWidth * 1.3;

  const activeSlotDef = SLOTS.find((s) => s.key === activeSlot);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={view === 'picker' ? () => {
        resetPickerControls();
        setView('form');
      } : handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>

          {/* ════════════════════════════════════════
              FORM VIEW
          ════════════════════════════════════════ */}
          {view === 'form' && (
            <>
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.headerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Build Outfit</Text>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={!name.trim() || createOutfit.isPending}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {createOutfit.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text
                      style={[
                        styles.headerSave,
                        !name.trim() && styles.headerSaveDisabled,
                      ]}
                    >
                      Save
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Live collage preview — visible once at least one slot is filled */}
                {Object.keys(slots).length > 0 && (
                  <View style={styles.previewRow}>
                    <OutfitCollage outfit={previewOutfit} size={88} borderRadius={radii.lg} />
                    <View style={styles.previewMeta}>
                      <Text style={styles.previewCount}>
                        {Object.keys(slots).length} piece{Object.keys(slots).length !== 1 ? 's' : ''} added
                      </Text>
                      <Text style={styles.previewHint}>Fill more slots below to complete the look</Text>
                    </View>
                  </View>
                )}

                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Sunday Brunch Look"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                  returnKeyType="next"
                  autoFocus
                />

                <Text style={styles.label}>Occasion</Text>
                <View style={styles.occasionChips}>
                  {OCCASIONS.map((o) => (
                    <TouchableOpacity
                      key={o.id}
                      onPress={() => setOccasion(occasion === o.id ? null : o.id)}
                      style={[styles.occasionChip, occasion === o.id && styles.occasionChipActive]}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={o.icon}
                        size={13}
                        color={occasion === o.id ? colors.primaryForeground : colors.mutedForeground}
                      />
                      <Text style={[styles.occasionChipText, occasion === o.id && styles.occasionChipTextActive]}>
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* ── Slots ── */}
                <Text style={[styles.label, styles.piecesLabel]}>Pieces</Text>

                {SLOTS.map((slot) => {
                  const selectedItem = slots[slot.key];
                  const disabled = slot.key === 'bottomId' && isFullBodyTop;
                  const imgUri = selectedItem
                    ? resolveImageUri(selectedItem.imageUrl)
                    : undefined;

                  return (
                    <TouchableOpacity
                      key={slot.key}
                      style={[styles.slotRow, disabled && styles.slotRowDisabled]}
                      onPress={() => !disabled && openPicker(slot.key)}
                      disabled={disabled}
                      activeOpacity={0.7}
                    >
                      {/* Thumbnail */}
                      <View style={[styles.slotThumb, !selectedItem && styles.slotThumbEmpty]}>
                        {selectedItem && imgUri ? (
                          <Image
                            source={{ uri: imgUri }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                          />
                        ) : (
                          <Ionicons
                            name={slot.icon}
                            size={20}
                            color={disabled ? colors.border : colors.mutedForeground}
                          />
                        )}
                        {selectedItem && !imgUri && (
                          <Ionicons name={slot.icon} size={20} color={colors.mutedForeground} />
                        )}
                      </View>

                      {/* Labels */}
                      <View style={styles.slotInfo}>
                        <Text style={[styles.slotLabel, disabled && styles.slotLabelDisabled]}>
                          {slot.label}
                        </Text>
                        <Text
                          style={[
                            styles.slotSub,
                            disabled && styles.slotLabelDisabled,
                            selectedItem && styles.slotSubSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {disabled
                            ? 'N/A — dress/full body selected'
                            : selectedItem
                            ? selectedItem.name
                            : 'Tap to add'}
                        </Text>
                      </View>

                      {/* Right control */}
                      {selectedItem ? (
                        <TouchableOpacity
                          onPress={() => clearSlot(slot.key)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={20}
                            color={colors.mutedForeground}
                          />
                        </TouchableOpacity>
                      ) : !disabled ? (
                        <Ionicons
                          name="chevron-forward-outline"
                          size={18}
                          color={colors.border}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}

                {unmatchedItems.length > 0 && (
                  <>
                    <Text style={[styles.label, styles.piecesLabel]}>Unassigned Pieces</Text>
                    <Text style={styles.unmatchedNote}>
                      {unmatchedItems.length === 1
                        ? 'This item has no category — tap a slot above to add it manually.'
                        : 'These items have no category — tap a slot above to add them manually.'}
                    </Text>
                    {unmatchedItems.map((item) => {
                      const imgUri = resolveImageUri(item.imageUrl);
                      return (
                        <View key={item.id} style={styles.unmatchedRow}>
                          <View style={styles.slotThumb}>
                            {imgUri ? (
                              <Image source={{ uri: imgUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            ) : (
                              <Ionicons name="shirt-outline" size={20} color={colors.mutedForeground} />
                            )}
                          </View>
                          <Text style={styles.unmatchedName} numberOfLines={1}>{item.name}</Text>
                        </View>
                      );
                    })}
                  </>
                )}

                <Text style={styles.label}>Tags</Text>
                <View style={styles.tagContainer}>
                  {tags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.tagChip}
                      onPress={() => setTags((prev) => prev.filter((t) => t !== tag))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.tagChipText}>{tag}</Text>
                      <Ionicons name="close" size={12} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                  <TextInput
                    style={styles.tagInput}
                    value={tagInput}
                    onChangeText={(text) => {
                      if (text.endsWith(',')) {
                        commitTagInput(text.slice(0, -1));
                      } else {
                        setTagInput(text);
                      }
                    }}
                    onSubmitEditing={() => commitTagInput(tagInput)}
                    placeholder={tags.length === 0 ? 'Add a tag…' : ''}
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    returnKeyType="done"
                    blurOnSubmit={false}
                  />
                </View>

                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any styling notes…"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="sentences"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                <View style={{ height: 48 }} />
              </ScrollView>
            </>
          )}

          {/* ════════════════════════════════════════
              PICKER VIEW
          ════════════════════════════════════════ */}
          {view === 'picker' && activeSlot && (
            <>
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={() => {
                    resetPickerControls();
                    setView('form');
                  }}
                  style={styles.backBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="chevron-back-outline"
                    size={20}
                    color={colors.foreground}
                  />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>

                <Text style={styles.headerTitle}>
                  {activeSlotDef?.label ?? 'Pick Item'}
                </Text>

                {slots[activeSlot] ? (
                  <TouchableOpacity
                    onPress={() => {
                      clearSlot(activeSlot);
                      resetPickerControls();
                      setView('form');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.headerClear}>Clear</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 44 }} />
                )}
              </View>

              <View style={styles.pickerSearchRow}>
                <View style={styles.pickerSearchBar}>
                  <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={styles.pickerSearchInput}
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                    placeholder={`Search ${activeSlotDef?.label.toLowerCase() ?? 'items'}…`}
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.pickerFilterButton,
                    pickerActiveFilterCount > 0 && styles.pickerFilterButtonActive,
                  ]}
                  onPress={() => setPickerFiltersOpen((open) => !open)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Filter items"
                  accessibilityState={{ expanded: pickerFiltersOpen }}
                >
                  <Ionicons
                    name="options-outline"
                    size={18}
                    color={pickerActiveFilterCount > 0 ? colors.primaryForeground : colors.foreground}
                  />
                  {pickerActiveFilterCount > 0 && (
                    <View style={styles.pickerFilterBadge}>
                      <Text style={styles.pickerFilterBadgeText}>{pickerActiveFilterCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {pickerFiltersOpen && (
                <View style={styles.pickerFilters}>
                  <View style={styles.pickerFilterHeader}>
                    <Text style={styles.pickerFilterTitle}>Filters</Text>
                    {pickerActiveFilterCount > 0 && (
                      <TouchableOpacity onPress={clearPickerFilters} activeOpacity={0.7}>
                        <Text style={styles.pickerFilterClear}>Clear all</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.pickerFilterChips}
                  >
                    <TouchableOpacity
                      style={[styles.pickerFilterChip, pickerFavoritesOnly && styles.pickerFilterChipActive]}
                      onPress={() => setPickerFavoritesOnly((value) => !value)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={pickerFavoritesOnly ? 'heart' : 'heart-outline'}
                        size={13}
                        color={pickerFavoritesOnly ? colors.primaryForeground : colors.mutedForeground}
                      />
                      <Text style={[styles.pickerFilterChipText, pickerFavoritesOnly && styles.pickerFilterChipTextActive]}>
                        Favorites
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickerFilterChip, pickerAvailableOnly && styles.pickerFilterChipActive]}
                      onPress={() => setPickerAvailableOnly((value) => !value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pickerFilterChipText, pickerAvailableOnly && styles.pickerFilterChipTextActive]}>
                        Available
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>

                  {pickerFilterOptions.colors.length > 0 && (
                    <PickerFilterRow
                      label="Color"
                      values={pickerFilterOptions.colors}
                      selected={pickerColors}
                      onToggle={(value) => togglePickerFilter(value, setPickerColors)}
                    />
                  )}
                  {pickerFilterOptions.seasons.length > 0 && (
                    <PickerFilterRow
                      label="Season"
                      values={pickerFilterOptions.seasons}
                      selected={pickerSeasons}
                      onToggle={(value) => togglePickerFilter(value, setPickerSeasons)}
                      getLabel={(value) => SEASON_LABELS[value as Season] ?? value}
                    />
                  )}
                  {pickerFilterOptions.occasions.length > 0 && (
                    <PickerFilterRow
                      label="Occasion"
                      values={pickerFilterOptions.occasions}
                      selected={pickerOccasions}
                      onToggle={(value) => togglePickerFilter(value, setPickerOccasions)}
                      getLabel={(value) => OCCASION_LABELS[value as Occasion] ?? value}
                    />
                  )}
                </View>
              )}

              <FlatList
                data={pickerItems}
                keyExtractor={(item) => String(item.id)}
                numColumns={PICKER_COLS}
                columnWrapperStyle={styles.pickerRow}
                contentContainerStyle={[
                  styles.pickerContent,
                  pickerItems.length === 0 && styles.pickerEmptyContent,
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListEmptyComponent={
                  <View style={styles.pickerEmpty}>
                    <Ionicons
                      name={pickerSearch.trim() ? 'search-outline' : 'shirt-outline'}
                      size={44}
                      color={colors.border}
                    />
                    <Text style={styles.pickerEmptyTitle}>
                      {pickerSearch.trim() || pickerActiveFilterCount > 0 ? 'No matching items' : 'No items yet'}
                    </Text>
                    <Text style={styles.pickerEmptySubtitle}>
                      {pickerSearch.trim() || pickerActiveFilterCount > 0
                        ? 'Try changing your search or filters.'
                        : 'Add items to your wardrobe first, then come back to build outfits.'}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isSelected = slots[activeSlot]?.id === item.id;
                  const imgUri = resolveImageUri(item.imageUrl);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.pickerCard,
                        { width: pickerCardWidth },
                        isSelected && styles.pickerCardSelected,
                      ]}
                      onPress={() => selectItem(item)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.pickerCardImage,
                          { height: pickerCardHeight },
                        ]}
                      >
                        {imgUri ? (
                          <Image
                            source={{ uri: imgUri }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.pickerCardPlaceholder}>
                            <Ionicons
                              name="shirt-outline"
                              size={24}
                              color={colors.border}
                            />
                          </View>
                        )}
                        {isSelected && (
                          <>
                            <View style={styles.pickerOverlay} />
                            <View style={styles.pickerCheck}>
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color={colors.primaryForeground}
                              />
                            </View>
                          </>
                        )}
                      </View>
                      <Text style={styles.pickerCardName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.pickerCardMeta} numberOfLines={1}>
                        {[item.brand, item.colorNormalized ?? item.color].filter(Boolean).join(' · ') || ' '}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </>
          )}

        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 52,
  },
  headerCancel: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
    minWidth: 44,
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
    minWidth: 44,
    textAlign: 'right',
  },
  headerSaveDisabled: {
    color: colors.mutedForeground,
  },
  headerClear: {
    fontSize: typography.size.md,
    color: colors.error,
    minWidth: 44,
    textAlign: 'right',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 70,
  },
  backText: {
    fontSize: typography.size.md,
    color: colors.foreground,
  },

  // ── Form
  scroll: {
    flex: 1,
  },

  // ── Live preview
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  previewCount: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  previewHint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    lineHeight: typography.size.xs * 1.5,
  },

  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  piecesLabel: {
    marginTop: spacing.xxl,
  },
  occasionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
  },
  occasionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    minHeight: 36,
  },
  occasionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  occasionChipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  occasionChipTextActive: {
    color: colors.primaryForeground,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
  },
  textArea: {
    height: 88,
    paddingTop: spacing.md,
  },

  // ── Slot rows
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 60,
    gap: spacing.md,
  },
  slotRowDisabled: {
    opacity: 0.45,
  },
  slotThumb: {
    width: 44,
    height: 52,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotThumbEmpty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  slotInfo: {
    flex: 1,
  },
  slotLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  slotLabelDisabled: {
    color: colors.border,
  },
  slotSub: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  slotSubSelected: {
    color: colors.foreground,
  },

  // ── Unmatched items
  unmatchedNote: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    lineHeight: typography.size.xs * 1.5,
  },
  unmatchedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    gap: spacing.md,
    opacity: 0.7,
  },
  unmatchedName: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.foreground,
  },

  // ── Picker
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
  pickerSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.foreground,
    paddingVertical: 0,
  },
  pickerFilterButton: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerFilterButtonActive: {
    backgroundColor: colors.primary,
  },
  pickerFilterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.foreground,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerFilterBadgeText: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.background,
    fontVariant: ['tabular-nums'],
  },
  pickerFilters: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  pickerFilterTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  pickerFilterClear: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
  pickerFilterGroup: {
    gap: spacing.xs,
  },
  pickerFilterGroupLabel: {
    paddingHorizontal: spacing.lg,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
  },
  pickerFilterChips: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  pickerFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pickerFilterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  pickerFilterChipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  pickerFilterChipTextActive: {
    color: colors.primaryForeground,
  },
  pickerRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pickerContent: {
    paddingTop: spacing.md,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  pickerEmptyContent: {
    flexGrow: 1,
  },
  pickerCard: {
    marginBottom: 0,
  },
  pickerCardSelected: {
    // selection shown via overlay + check badge on image
  },
  pickerCardImage: {
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  pickerCardPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(149, 109, 81, 0.2)',
  },
  pickerCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCardName: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    marginTop: spacing.xs,
    paddingHorizontal: 2,
  },
  pickerCardMeta: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
    paddingHorizontal: 2,
    textTransform: 'capitalize',
  },
  pickerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  pickerEmptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  pickerEmptySubtitle: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: typography.size.md * 1.5,
  },

  // ── Tag chip input
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    minHeight: 46,
    alignItems: 'center',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  tagChipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
  tagInput: {
    flex: 1,
    minWidth: 80,
    fontSize: typography.size.md,
    color: colors.foreground,
    height: 30,
    padding: 0,
  },
});
