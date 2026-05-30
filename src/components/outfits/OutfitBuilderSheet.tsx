import { useState, useMemo, useCallback } from 'react';
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

import { useItems } from '../../hooks/useItems';
import { useCreateOutfit } from '../../hooks/useOutfits';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, spacing, typography, radii } from '../../theme';
import type { Item, ItemCategory } from '../../types/item';
import type { Outfit } from '../../types/outfit';
import * as Haptics from 'expo-haptics';

// ─── Slot config ──────────────────────────────────────────────────────────────

type SlotKey = 'topId' | 'bottomId' | 'shoesId' | 'outerwearId' | 'accessoryId';

type SlotDef = {
  key: SlotKey;
  label: string;
  categories: ItemCategory[];
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const SLOTS: SlotDef[] = [
  { key: 'topId',        label: 'Top / Dress',  categories: ['top', 'full_body'],  icon: 'shirt-outline' },
  { key: 'bottomId',     label: 'Bottom',       categories: ['bottom'],             icon: 'body-outline' },
  { key: 'shoesId',      label: 'Shoes',        categories: ['shoes'],              icon: 'footsteps-outline' },
  { key: 'outerwearId',  label: 'Outerwear',    categories: ['outerwear'],          icon: 'layers-outline' },
  { key: 'accessoryId',  label: 'Accessory',    categories: ['accessory'],          icon: 'watch-outline' },
];

type SlotMap = Partial<Record<SlotKey, Item>>;

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (outfit: Outfit) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function OutfitBuilderSheet({ visible, onClose, onCreated }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const { data: allItems = [] } = useItems();
  const createOutfit = useCreateOutfit();

  // ── Form ───────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<SlotMap>({});

  // ── Picker ─────────────────────────────────────────────────────────────
  const [view, setView] = useState<'form' | 'picker'>('form');
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);

  const isFullBodyTop = slots.topId?.category === 'full_body';

  const pickerItems = useMemo(() => {
    if (!activeSlot) return [];
    const slot = SLOTS.find((s) => s.key === activeSlot);
    if (!slot) return [];
    return allItems.filter(
      (item) => item.category && (slot.categories as string[]).includes(item.category)
    );
  }, [activeSlot, allItems]);

  const openPicker = (slotKey: SlotKey) => {
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
    setOccasion('');
    setTags('');
    setNotes('');
    setSlots({});
    setView('form');
    setActiveSlot(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = () => {
    if (!name.trim() || createOutfit.isPending) return;
    const parsedTags = tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    createOutfit.mutate(
      {
        name: name.trim(),
        event: occasion.trim() || null,
        notes: notes.trim() || null,
        tags: parsedTags,
        topId: slots.topId?.id ?? null,
        bottomId: slots.bottomId?.id ?? null,
        shoesId: slots.shoesId?.id ?? null,
        outerwearId: slots.outerwearId?.id ?? null,
        accessoryId: slots.accessoryId?.id ?? null,
      },
      {
        onSuccess: (outfit) => {
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
      onRequestClose={view === 'picker' ? () => setView('form') : handleClose}
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
                <TextInput
                  style={styles.input}
                  value={occasion}
                  onChangeText={setOccasion}
                  placeholder="e.g. casual, work, dinner"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  returnKeyType="next"
                />

                <Text style={styles.label}>Tags</Text>
                <TextInput
                  style={styles.input}
                  value={tags}
                  onChangeText={setTags}
                  placeholder="summer, linen, minimal (comma-separated)"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  returnKeyType="next"
                />

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
                  onPress={() => setView('form')}
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

              {pickerItems.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Ionicons name="shirt-outline" size={44} color={colors.border} />
                  <Text style={styles.pickerEmptyTitle}>No items yet</Text>
                  <Text style={styles.pickerEmptySubtitle}>
                    Add items to your wardrobe first, then come back to build outfits.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={pickerItems}
                  keyExtractor={(item) => String(item.id)}
                  numColumns={PICKER_COLS}
                  columnWrapperStyle={styles.pickerRow}
                  contentContainerStyle={styles.pickerContent}
                  showsVerticalScrollIndicator={false}
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
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
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

  // ── Picker
  pickerRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pickerContent: {
    paddingTop: spacing.md,
    paddingBottom: 40,
    gap: spacing.sm,
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
});
