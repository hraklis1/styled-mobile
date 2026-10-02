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
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { track } from '../../lib/analytics';
import { useItems } from '../../hooks/useItems';
import { useCreateOutfitLog } from '../../hooks/useOutfitLogs';
import { useCameraLaunch, useLibraryLaunch, type CapturedImage } from '../../hooks/useCameraLaunch';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';
import { PhotoSourceSheet } from '../primitives/PhotoSourceSheet';
import { colors, spacing, typography, radii } from '../../theme';
import type { Item } from '../../types/item';
import type { OutfitLoggerLaunch } from '../../contexts/GlobalOutfitLoggerContext';
import { mergeUniqueItemIds } from '../../lib/outfit-log-scan';
import { WearReviewWorkspace } from './wear-review/WearReviewWorkspace';
import { discardWearFlow, startWearScan } from '../../features/wear-log/runner';
import { useWearLogStore } from '../../features/wear-log/store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNoon(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function todayNoon(): Date {
  return toNoon(new Date());
}

function yesterdayNoon(): Date {
  const d = todayNoon();
  d.setDate(d.getDate() - 1);
  return d;
}

// YYYY-MM-DD for the API
function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function displayLogDate(d: Date): string {
  const today = todayNoon();
  const yesterday = yesterdayNoon();
  const target = toNoon(d);
  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DateMode = 'today' | 'yesterday' | 'custom';
type SheetView = 'form' | 'picker' | 'scan-review';

type Props = {
  visible: boolean;
  /** ISO `yyyy-mm-dd` to pre-select, e.g. when logging from a calendar day. */
  initialDate?: string;
  /** Bumped by the opener each time it requests a date. See the seeding effect. */
  initialDateRequestId?: number;
  /** Optional quick-start action selected from the Home capture chooser. */
  initialLaunch?: OutfitLoggerLaunch;
  /** Image already selected by the Home quick-start native picker. */
  initialImage?: CapturedImage;
  /** Optional initial logger view selected from the Home capture chooser. */
  initialView?: 'picker' | 'scan-review';
  onClose: () => void;
  onSaved?: () => void;
  onAddToWardrobe?: (onItemsSaved: (items: Item[]) => void) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LogOutfitSheet({
  visible,
  initialDate,
  initialDateRequestId = 0,
  initialLaunch,
  initialImage,
  initialView,
  onClose,
  onSaved,
  onAddToWardrobe,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const { data: allItems = [] } = useItems();
  const createLog = useCreateOutfitLog();
  const wearStatus = useWearLogStore((s) => s.flow.status);
  const launchCamera = useCameraLaunch();
  const launchLibrary = useLibraryLaunch();

  // Date
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [customDate, setCustomDate] = useState<Date>(() => {
    const d = todayNoon();
    d.setDate(d.getDate() - 2);
    return d;
  });

  // Items
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Notes, location & rating
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // View
  const [view, setView] = useState<SheetView>('form');
  const [search, setSearch] = useState('');

  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [autoLaunchPending, setAutoLaunchPending] = useState(false);

  const notesRef = useRef<TextInput>(null);
  const autoLaunchRef = useRef<OutfitLoggerLaunch | undefined>(undefined);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const logDate = useMemo(() => {
    if (dateMode === 'today') return todayNoon();
    if (dateMode === 'yesterday') return yesterdayNoon();
    return customDate;
  }, [dateMode, customDate]);

  const selectedItems = useMemo(
    () => allItems.filter((it) => selectedIds.includes(it.id)),
    [allItems, selectedIds]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.category?.toLowerCase().includes(q) ||
        it.color?.toLowerCase().includes(q)
    );
  }, [allItems, search]);

  // Seed the date when the sheet is opened for a specific day. Keyed on the
  // request id rather than `visible` so returning from the add-clothes detour
  // (which re-shows the sheet) doesn't clobber a date the user has since changed.
  useEffect(() => {
    if (!initialDateRequestId || !initialDate) return;
    const target = toNoon(new Date(`${initialDate}T12:00:00`));
    if (Number.isNaN(target.getTime())) return;

    const today = todayNoon();
    const yesterday = yesterdayNoon();
    if (target.getTime() >= today.getTime()) { setDateMode('today'); return; }
    if (target.getTime() === yesterday.getTime()) { setDateMode('yesterday'); return; }
    setCustomDate(target);
    setDateMode('custom');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDateRequestId]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const enterCustomMode = useCallback(() => {
    const d = todayNoon();
    d.setDate(d.getDate() - 2);
    setCustomDate(d);
    setDateMode('custom');
  }, []);

  const shiftCustomDate = useCallback((days: number) => {
    setCustomDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);

      const today = todayNoon();
      const yesterday = yesterdayNoon();

      // Promote back to pill modes when navigating forward
      if (next.getTime() >= today.getTime()) {
        setDateMode('today');
        return todayNoon();
      }
      if (next.getTime() === yesterday.getTime()) {
        setDateMode('yesterday');
        return yesterdayNoon();
      }
      return toNoon(next);
    });
  }, []);

  const toggleItem = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const processScanImage = useCallback(async (image: CapturedImage) => {
    startWearScan(image, toISODate(logDate));
    setView('scan-review');
    track('outfit_scan_started', {});
  }, [logDate]);

  const runScan = useCallback(async (source: 'camera' | 'library') => {
    let image: Awaited<ReturnType<typeof launchCamera>>;
    try {
      image = source === 'camera'
        ? await launchCamera({ maxDim: 1600 })
        : await launchLibrary({ maxDim: 1600 });
    } catch {
      Alert.alert(
        source === 'camera' ? 'Couldn’t open the camera' : 'Couldn’t open your photo library',
        'Please try again.',
      );
      if (initialLaunch) onClose();
      return;
    }
    if (!image) {
      // A quick-start cancel should return to Home rather than strand the user
      // in an empty full logger form.
      if (initialLaunch) onClose();
      return;
    }

    await processScanImage(image);
  }, [initialLaunch, launchCamera, launchLibrary, onClose, processScanImage]);

  // Close the chooser before the camera/library picker opens: on iOS a native
  // picker presented while another modal is still dismissing never appears.
  const pickSource = useCallback((source: 'camera' | 'library') => {
    setSourcePickerOpen(false);
    setTimeout(() => runScan(source), 300);
  }, [runScan]);

  useEffect(() => {
    if (!visible) {
      autoLaunchRef.current = undefined;
      setAutoLaunchPending(false);
    }
  }, [visible]);

  const handleModalShow = useCallback(() => {
    if (!initialLaunch || initialLaunch === 'closet' || autoLaunchRef.current === initialLaunch) return;

    autoLaunchRef.current = initialLaunch;
    setAutoLaunchPending(true);
    const launch = initialImage
      ? processScanImage(initialImage)
      : runScan(initialLaunch);
    void launch.finally(() => setAutoLaunchPending(false));
  }, [initialImage, initialLaunch, processScanImage, runScan]);

  useEffect(() => {
    if (visible && initialView === 'picker') setView('picker');
    if (visible && initialView === 'scan-review') setView('scan-review');
  }, [initialView, visible]);

  const reset = useCallback(() => {
    setDateMode('today');
    setCustomDate(() => {
      const d = todayNoon();
      d.setDate(d.getDate() - 2);
      return d;
    });
    setSelectedIds([]);
    setNotes('');
    setLocation('');
    setRating(null);
    setDetailsExpanded(false);
    setView('form');
    setSearch('');
    setSourcePickerOpen(false);
    setAutoLaunchPending(false);
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [reset, visible]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePickerBack = () => {
    // Home quick-start is a self-contained session. Back/cancel should return
    // to Home, not expose the full logger form that launched the picker.
    if (initialLaunch || initialView === 'picker') {
      handleClose();
      return;
    }
    setView('form');
  };

  const handleSave = () => {
    if (selectedIds.length === 0 || createLog.isPending) return;
    createLog.mutate(
      {
        itemIds: selectedIds,
        date: toISODate(logDate),
        notes: notes.trim() || undefined,
        location: location.trim() || undefined,
        rating: rating ?? undefined,
      },
      {
        onSuccess: () => {
          track('outfit_logged', { item_count: selectedIds.length });
          reset();
          onSaved?.();
          onClose();
        },
      }
    );
  };

  const handleAddToWardrobe = () => {
    setView('form');
    onAddToWardrobe?.((items) => {
      setSelectedIds((prev) => mergeUniqueItemIds(prev, items.map((item) => item.id)));
    });
  };

  // ── Picker grid sizing ────────────────────────────────────────────────────────

  const PICKER_COLS = 3;
  const PICKER_H_PAD = spacing.lg;
  const PICKER_GAP = spacing.sm;
  const pickerCardWidth =
    (screenWidth - PICKER_H_PAD * 2 - PICKER_GAP * (PICKER_COLS - 1)) / PICKER_COLS;
  const pickerCardHeight = pickerCardWidth * 1.3;
  const resumable = wearStatus === 'reviewing' || wearStatus === 'processing' || wearStatus === 'failed';
  const showAutoLaunchState = Boolean(
    initialLaunch &&
    view === 'form' &&
    wearStatus === 'idle' &&
    (autoLaunchPending || autoLaunchRef.current === undefined),
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={handleModalShow}
      onRequestClose={view === 'picker' ? handlePickerBack : handleClose}
    >
      {view === 'scan-review' && wearStatus !== 'idle' ? (
        <WearReviewWorkspace
          onClose={handleClose}
          // Plain close: the !visible effect resets the form after the sheet
          // has gone, so it doesn't flash the form on the way out.
          onMinimize={onClose}
          onLogged={() => {
            reset();
            onSaved?.();
            onClose();
          }}
          onPickManually={() => {
            discardWearFlow();
            setSearch('');
            setView('picker');
          }}
        />
      ) : (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>

          {/* ════════════════════════════════════════
              FORM VIEW
          ════════════════════════════════════════ */}
          {showAutoLaunchState ? (
            <View style={styles.autoLaunchState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.autoLaunchTitle}>
                {initialLaunch === 'camera' ? 'Opening camera…' : 'Opening photo library…'}
              </Text>
            </View>
          ) : view === 'form' && (
            <>
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.headerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>What Did You Wear?</Text>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={selectedIds.length === 0 || createLog.isPending}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {createLog.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text
                      style={[
                        styles.headerSave,
                        selectedIds.length === 0 && styles.headerSaveDisabled,
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

                {/* ── Date ─────────────────────────────────────────────── */}
                <Text style={styles.label}>When</Text>

                <View style={styles.datePillRow}>
                  <TouchableOpacity
                    style={[styles.datePill, dateMode === 'today' && styles.datePillActive]}
                    onPress={() => setDateMode('today')}
                  >
                    <Text
                      style={[
                        styles.datePillText,
                        dateMode === 'today' && styles.datePillTextActive,
                      ]}
                    >
                      Today
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.datePill, dateMode === 'yesterday' && styles.datePillActive]}
                    onPress={() => setDateMode('yesterday')}
                  >
                    <Text
                      style={[
                        styles.datePillText,
                        dateMode === 'yesterday' && styles.datePillTextActive,
                      ]}
                    >
                      Yesterday
                    </Text>
                  </TouchableOpacity>

                  {/* Custom date navigator — appears in place of "Earlier" once active */}
                  {dateMode === 'custom' ? (
                    <View style={[styles.datePill, styles.datePillActive, styles.dateNavPill]}>
                      <TouchableOpacity
                        onPress={() => shiftCustomDate(-1)}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Ionicons name="chevron-back" size={14} color={colors.primaryForeground} />
                      </TouchableOpacity>
                      <Text style={[styles.datePillText, styles.datePillTextActive]}>
                        {displayLogDate(customDate)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => shiftCustomDate(1)}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      >
                        <Ionicons name="chevron-forward" size={14} color={colors.primaryForeground} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.datePill}
                      onPress={enterCustomMode}
                    >
                      <Text style={styles.datePillText}>Earlier…</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* ── Outfit source ───────────────────────────────────── */}
                <Text style={[styles.label, styles.itemsLabel]}>Add your outfit</Text>

                <Text style={styles.introText}>
                  Snap a photo and we’ll match the pieces to your closet, or choose them yourself.
                </Text>

                {selectedItems.length > 0 && (
                  <>
                    <View style={styles.selectedHeader}>
                      <Text style={styles.selectedHeaderTitle}>Selected pieces</Text>
                      <Text style={styles.selectedHeaderCount}>{selectedItems.length}</Text>
                    </View>
                    <View style={styles.selectedList}>
                      {selectedItems.map((item) => (
                        <SelectedItemRow
                          key={item.id}
                          item={item}
                          onRemove={() => toggleItem(item.id)}
                        />
                      ))}
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.addItemsBtn, styles.scanBtn]}
                  onPress={() => (resumable ? setView('scan-review') : setSourcePickerOpen(true))}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={resumable ? 'Continue reviewing your outfit photo' : 'Match your outfit from a photo'}
                >
                  <Ionicons name={resumable ? 'images-outline' : 'camera-outline'} size={20} color={colors.primary} />
                  <View style={styles.addItemsBtnCopy}>
                    <Text style={styles.addItemsBtnText}>
                      {resumable ? 'Continue your photo' : 'Match from a photo'}
                    </Text>
                    <Text style={styles.addItemsBtnSubtext}>
                      {resumable
                        ? 'Pick up the review where you left it'
                        : 'Take a selfie or choose a photo from your library'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
                {resumable ? (
                  <TouchableOpacity onPress={() => { discardWearFlow(); setSourcePickerOpen(true); }} style={styles.newPhotoLink}>
                    <Text style={styles.addItemsBtnSubtext}>Use a different photo</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={styles.addItemsBtn}
                  onPress={() => {
                    setSearch('');
                    setView('picker');
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={selectedItems.length > 0 ? 'Add more pieces from your closet' : 'Choose pieces from your closet'}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <View style={styles.addItemsBtnCopy}>
                    <Text style={styles.addItemsBtnText}>
                      {selectedItems.length > 0 ? 'Add more from your closet' : 'Choose from your closet'}
                    </Text>
                    <Text style={styles.addItemsBtnSubtext}>Select the pieces you wore yourself</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </TouchableOpacity>

                {selectedItems.length > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.detailsToggle}
                      onPress={() => setDetailsExpanded((current) => !current)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: detailsExpanded }}
                      accessibilityLabel={detailsExpanded ? 'Hide outfit details' : 'Add outfit details'}
                    >
                      <View style={styles.detailsToggleCopy}>
                        <Text style={styles.detailsToggleTitle}>Add details</Text>
                        <Text style={styles.detailsToggleSubtitle}>Location, rating, or a note</Text>
                      </View>
                      <Ionicons
                        name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.primary}
                      />
                    </TouchableOpacity>

                    {detailsExpanded && (
                      <View style={styles.detailsContent}>
                        <Text style={styles.detailLabel}>Location</Text>
                        <LocationAutocompleteInput
                          value={location}
                          onChangeText={setLocation}
                          onSelect={setLocation}
                          placeholder="Where did you wear this?"
                          containerStyle={{ marginHorizontal: 0 }}
                        />

                        <Text style={styles.detailLabel}>How did it go?</Text>
                        <View style={styles.ratingRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity
                              key={star}
                              onPress={() => setRating(rating === star ? null : star)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={rating != null && rating >= star ? 'star' : 'star-outline'}
                                size={28}
                                color={rating != null && rating >= star ? '#F59E0B' : colors.border}
                              />
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={styles.detailLabel}>Notes</Text>
                        <View style={[styles.textFieldRow, styles.notesField, styles.detailsField]}>
                          <TextInput
                            ref={notesRef}
                            style={[styles.textField, styles.notesInput]}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="How did it feel? Any styling tips…"
                            placeholderTextColor={colors.mutedForeground}
                            multiline
                            returnKeyType="default"
                            autoCapitalize="sentences"
                            maxLength={1000}
                            textAlignVertical="top"
                          />
                        </View>
                      </View>
                    )}
                  </>
                )}

                <View style={{ height: 48 }} />
              </ScrollView>
            </>
          )}

          {/* ════════════════════════════════════════
              PICKER VIEW
          ════════════════════════════════════════ */}
          {view === 'picker' && (
            <>
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={handlePickerBack}
                  style={styles.backBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {initialLaunch || initialView === 'picker' ? (
                    <Text style={styles.headerCancel}>Cancel</Text>
                  ) : (
                    <>
                      <Ionicons name="chevron-back-outline" size={20} color={colors.foreground} />
                      <Text style={styles.backText}>Back</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Select from Your Closet</Text>
                <TouchableOpacity
                  onPress={() => setView('form')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={[
                      styles.headerSave,
                      selectedIds.length === 0 && styles.headerSaveDisabled,
                    ]}
                  >
                    {selectedIds.length > 0 ? `Done (${selectedIds.length})` : 'Done'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Search bar */}
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search your closet…"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
              </View>

              <FlatList
                data={filteredItems}
                keyExtractor={(item) => String(item.id)}
                numColumns={PICKER_COLS}
                columnWrapperStyle={styles.pickerRow}
                contentContainerStyle={styles.pickerContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.pickerEmpty}>
                    <Ionicons name="shirt-outline" size={44} color={colors.border} />
                    <Text style={styles.pickerEmptyTitle}>
                      {search.trim() ? 'No matching items' : 'No items yet'}
                    </Text>
                    {!search.trim() && (
                      <Text style={styles.pickerEmptySubtitle}>
                        Add clothes to your closet, then return to this wear record.
                      </Text>
                    )}
                  </View>
                }
                ListFooterComponent={
                  <TouchableOpacity
                    style={styles.addToWardrobeBtn}
                    onPress={handleAddToWardrobe}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                    <Text style={styles.addToWardrobeBtnText}>Add new clothes to your closet</Text>
                  </TouchableOpacity>
                }
                renderItem={({ item }) => {
                  const isSelected = selectedIds.includes(item.id);
                  const imgUri = itemImageUri(item);
                  return (
                    <TouchableOpacity
                      style={[styles.pickerCard, isSelected && styles.pickerCardSelected, { width: pickerCardWidth }]}
                      onPress={() => toggleItem(item.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${isSelected ? 'Remove' : 'Select'} ${item.name}`}
                    >
                      <View style={[styles.pickerCardImage, isSelected && styles.pickerCardImageSelected, { height: pickerCardHeight }]}>
                        {imgUri ? (
                          <Image
                            source={{ uri: imgUri }}
                            style={StyleSheet.absoluteFill}
                            resizeMode={itemImageContentFit(item)}
                          />
                        ) : (
                          <View style={styles.pickerCardPlaceholder}>
                            <Ionicons name="shirt-outline" size={24} color={colors.border} />
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
            </>
          )}

        </SafeAreaView>
      </KeyboardAvoidingView>
      )}

      <PhotoSourceSheet
        visible={sourcePickerOpen}
        title="Add an outfit photo"
        subtitle="We’ll match the visible pieces to your closet."
        cameraLabel="Take a selfie"
        cameraHint="Use your camera right now"
        libraryLabel="From your photos"
        libraryHint="Pick a photo from your camera roll"
        onCamera={() => pickSource('camera')}
        onLibrary={() => pickSource('library')}
        onCancel={() => setSourcePickerOpen(false)}
      />
    </Modal>
  );
}

// ─── SelectedItemRow ──────────────────────────────────────────────────────────

function SelectedItemRow({ item, onRemove }: { item: Item; onRemove: () => void }) {
  const imgUri = itemImageUri(item);
  return (
    <View style={styles.selectedRow}>
      <View style={styles.selectedThumb}>
        {imgUri ? (
          <Image source={{ uri: imgUri }} style={StyleSheet.absoluteFill} resizeMode={itemImageContentFit(item)} />
        ) : (
          <Ionicons name="shirt-outline" size={16} color={colors.mutedForeground} />
        )}
      </View>
      <View style={styles.selectedInfo}>
        <Text style={styles.selectedName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.selectedCat}>{item.category}</Text>
      </View>
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  newPhotoLink: { alignSelf: 'center', paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  autoLaunchState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  autoLaunchTitle: {
    fontSize: typography.text.body.fontSize,
    color: colors.mutedForeground,
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
    fontSize: typography.text.body.fontSize,
    color: colors.mutedForeground,
    minWidth: 44,
  },
  headerTitle: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    letterSpacing: typography.tracking.whisper,
  },
  headerSave: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    minWidth: 44,
    textAlign: 'right',
  },
  headerSaveDisabled: {
    color: colors.mutedForeground,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 70,
  },
  backText: {
    fontSize: typography.text.body.fontSize,
    color: colors.foreground,
  },

  // ── Form
  scroll: {
    flex: 1,
  },
  label: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wide,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  itemsLabel: {
    marginTop: spacing.xxl,
  },
  introText: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontSize: typography.text.body.fontSize,
    lineHeight: 22,
    color: colors.mutedForeground,
  },

  // ── Date pills
  datePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  datePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  datePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  datePillText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  datePillTextActive: {
    color: colors.primaryForeground,
  },
  // Custom date pill with inline back/forward arrows
  dateNavPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  // ── Selected items list
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  selectedHeaderTitle: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wide,
  },
  selectedHeaderCount: {
    minWidth: 22,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSelected,
    color: colors.primary,
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  selectedList: {
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  selectedThumb: {
    width: 40,
    height: 48,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  selectedCat: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
    marginTop: 2,
  },

  // ── Location / Notes text fields
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  detailsToggleCopy: {
    gap: 2,
  },
  detailsToggleTitle: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  detailsToggleSubtitle: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
  },
  detailsContent: {
    marginHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  detailLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wide,
  },
  textFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#C5B8AC',
    minHeight: 48,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  notesField: {
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    minHeight: 96,
  },
  detailsField: {
    marginHorizontal: 0,
  },
  textField: {
    flex: 1,
    fontSize: typography.text.body.fontSize,
    color: colors.foreground,
    paddingVertical: 0,
  },
  notesInput: {
    minHeight: 68,
  },

  // ── Add items button
  addItemsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  addItemsBtnText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  addItemsBtnCopy: {
    flex: 1,
    gap: 2,
  },
  addItemsBtnSubtext: {
    fontSize: typography.text.caption.fontSize,
    lineHeight: 17,
    color: colors.mutedForeground,
  },

  // ── Picker
  searchBar: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    height: 38,
    paddingVertical: 0,
    fontSize: typography.text.body.fontSize,
    lineHeight: typography.inputLineHeight(typography.text.body.fontSize),
    color: colors.foreground,
  },
  pickerRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pickerContent: {
    paddingTop: spacing.xs,
    paddingBottom: 16,
    gap: spacing.sm,
  },
  pickerCard: {
    paddingBottom: spacing.xs,
  },
  pickerCardSelected: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceSelected,
  },
  pickerCardImage: {
    borderRadius: radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pickerCardImageSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
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
    backgroundColor: 'rgba(111, 89, 72, 0.12)',
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
    fontSize: typography.text.caption.fontSize,
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
    paddingVertical: spacing.xxxl,
  },
  pickerEmptyTitle: {
    fontSize: typography.text.sectionTitle.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  pickerEmptySubtitle: {
    fontSize: typography.text.body.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: typography.text.body.fontSize * 1.5,
  },

  // ── Scan button variant
  scanBtn: {
    borderColor: `${colors.primary}35`,
    backgroundColor: `${colors.primary}0D`,
    marginBottom: spacing.sm,
  },

  // ── Scan review

  // ── "Add to wardrobe" footer in picker
  addToWardrobeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    borderStyle: 'dashed',
  },
  addToWardrobeBtnText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
});
