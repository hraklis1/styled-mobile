import { useState, useMemo, useCallback, useRef } from 'react';
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
import { useCreateOutfitLog, useScanOutfitLog, type OutfitScanResult } from '../../hooks/useOutfitLogs';
import { useCameraLaunch, useLibraryLaunch } from '../../hooks/useCameraLaunch';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';
import { colors, spacing, typography, radii } from '../../theme';
import type { Item } from '../../types/item';

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
  onClose: () => void;
  onSaved?: () => void;
  onAddToWardrobe?: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LogOutfitSheet({ visible, onClose, onSaved, onAddToWardrobe }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const { data: allItems = [] } = useItems();
  const createLog = useCreateOutfitLog();
  const scanOutfit = useScanOutfitLog();
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

  // View
  const [view, setView] = useState<SheetView>('form');
  const [search, setSearch] = useState('');

  // Scan state
  const [scanResults, setScanResults] = useState<OutfitScanResult[] | null>(null);
  const [scanSel, setScanSel] = useState<Set<number>>(new Set());

  const notesRef = useRef<TextInput>(null);

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

  const runScan = useCallback(async (source: 'camera' | 'library') => {
    const image =
      source === 'camera'
        ? await launchCamera({ maxDim: 1600 })
        : await launchLibrary({ maxDim: 1600 });
    if (!image) return;

    try {
      const results = await scanOutfit.mutateAsync(image.dataUrl);
      const preSelected = new Set(
        results
          .filter((r) => r.match_id !== null && r.confidence !== 'Low')
          .map((r) => r.match_id as number),
      );
      setScanSel(preSelected);
      setScanResults(results);
      setView('scan-review');
    } catch {
      Alert.alert('Scan failed', 'Could not analyze the photo. Please try again.');
    }
  }, [launchCamera, launchLibrary, scanOutfit]);

  const handleScanPress = useCallback(() => {
    Alert.alert('Scan Worn Outfit', 'Choose a photo source', [
      { text: 'Camera', onPress: () => runScan('camera') },
      { text: 'Photo Library', onPress: () => runScan('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [runScan]);

  const applyScanResults = useCallback(() => {
    setSelectedIds((prev) => Array.from(new Set([...prev, ...scanSel])));
    setScanResults(null);
    setScanSel(new Set());
    setView('form');
  }, [scanSel]);

  const toggleScanSel = useCallback((id: number) => {
    setScanSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    setView('form');
    setSearch('');
    setScanResults(null);
    setScanSel(new Set());
  }, []);

  const handleClose = () => {
    reset();
    onClose();
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
    onAddToWardrobe?.();
  };

  // ── Picker grid sizing ────────────────────────────────────────────────────────

  const PICKER_COLS = 3;
  const PICKER_H_PAD = spacing.lg;
  const PICKER_GAP = spacing.sm;
  const pickerCardWidth =
    (screenWidth - PICKER_H_PAD * 2 - PICKER_GAP * (PICKER_COLS - 1)) / PICKER_COLS;
  const pickerCardHeight = pickerCardWidth * 1.3;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

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
                <Text style={styles.headerTitle}>Log Outfit</Text>
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

                {/* ── Items ────────────────────────────────────────────── */}
                <Text style={[styles.label, styles.itemsLabel]}>What you wore</Text>

                {selectedItems.length > 0 && (
                  <View style={styles.selectedList}>
                    {selectedItems.map((item) => (
                      <SelectedItemRow
                        key={item.id}
                        item={item}
                        onRemove={() => toggleItem(item.id)}
                      />
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.addItemsBtn, styles.scanBtn]}
                  onPress={handleScanPress}
                  disabled={scanOutfit.isPending}
                  activeOpacity={0.7}
                >
                  {scanOutfit.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="camera-outline" size={20} color={colors.primary} />
                  )}
                  <Text style={styles.addItemsBtnText}>
                    {scanOutfit.isPending ? 'Scanning photo…' : 'Scan worn outfit photo'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addItemsBtn}
                  onPress={() => {
                    setSearch('');
                    setView('picker');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.addItemsBtnText}>
                    {selectedItems.length > 0 ? 'Add more items' : 'Add items from wardrobe'}
                  </Text>
                </TouchableOpacity>

                {/* ── Location ─────────────────────────────────────── */}
                <Text style={[styles.label, styles.itemsLabel]}>Location</Text>
                <LocationAutocompleteInput
                  value={location}
                  onChangeText={setLocation}
                  onSelect={setLocation}
                  placeholder="Where did you wear this?"
                  containerStyle={{ marginHorizontal: spacing.lg }}
                />

                {/* ── Rating ───────────────────────────────────────── */}
                <Text style={[styles.label, styles.itemsLabel]}>How did it go?</Text>
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

                {/* ── Notes ────────────────────────────────────────── */}
                <Text style={[styles.label, styles.itemsLabel]}>Notes</Text>
                <View style={[styles.textFieldRow, styles.notesField]}>
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
                  onPress={() => setView('form')}
                  style={styles.backBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back-outline" size={20} color={colors.foreground} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Select Items</Text>
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
                  placeholder="Search wardrobe…"
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
                        Add items to your wardrobe, then come back to log your outfit.
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
                    <Text style={styles.addToWardrobeBtnText}>+ Add a missing item to wardrobe</Text>
                  </TouchableOpacity>
                }
                renderItem={({ item }) => {
                  const isSelected = selectedIds.includes(item.id);
                  const imgUri = resolveImageUri(item.imageUrl);
                  return (
                    <TouchableOpacity
                      style={[styles.pickerCard, { width: pickerCardWidth }]}
                      onPress={() => toggleItem(item.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.pickerCardImage, { height: pickerCardHeight }]}>
                        {imgUri ? (
                          <Image
                            source={{ uri: imgUri }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
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

          {/* ════════════════════════════════════════
              SCAN REVIEW VIEW
          ════════════════════════════════════════ */}
          {view === 'scan-review' && scanResults !== null && (
            <>
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={() => { setScanResults(null); setScanSel(new Set()); setView('form'); }}
                  style={styles.backBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back-outline" size={20} color={colors.foreground} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Detected Items</Text>
                <TouchableOpacity
                  onPress={applyScanResults}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.headerSave, scanSel.size === 0 && styles.headerSaveDisabled]}>
                    {scanSel.size > 0 ? `Add ${scanSel.size}` : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scanReviewContent}
                showsVerticalScrollIndicator={false}
              >
                {scanResults.length === 0 ? (
                  <View style={styles.scanEmpty}>
                    <Ionicons name="shirt-outline" size={44} color={colors.border} />
                    <Text style={styles.scanEmptyTitle}>No items detected</Text>
                    <Text style={styles.scanEmptySubtitle}>
                      Try a clearer photo with good lighting and visible clothing.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.scanHint}>
                      Select items you wore. High and Medium confidence matches are pre-selected.
                    </Text>
                    {scanResults.map((result, idx) => {
                      const matched = result.match_id !== null
                        ? allItems.find((it) => it.id === result.match_id) ?? null
                        : null;
                      const isSelected = result.match_id !== null && scanSel.has(result.match_id);
                      const isMatchable = result.match_id !== null;
                      const imgUri = matched ? resolveImageUri(matched.imageUrl) : null;

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.scanRow, !isMatchable && styles.scanRowDim]}
                          onPress={() => isMatchable && toggleScanSel(result.match_id!)}
                          activeOpacity={isMatchable ? 0.7 : 1}
                        >
                          <View style={styles.scanThumb}>
                            {imgUri ? (
                              <Image
                                source={{ uri: imgUri }}
                                style={StyleSheet.absoluteFill}
                                resizeMode="cover"
                              />
                            ) : (
                              <Ionicons name="shirt-outline" size={20} color={colors.mutedForeground} />
                            )}
                          </View>

                          <View style={styles.scanInfo}>
                            <Text style={styles.scanItemName} numberOfLines={1}>
                              {matched ? matched.name : result.detected_type}
                            </Text>
                            <View style={styles.scanBadgeRow}>
                              {matched ? (
                                <Text style={styles.scanCategory}>{matched.category}</Text>
                              ) : (
                                <Text style={styles.scanNotInWardrobe}>Not in wardrobe</Text>
                              )}
                              <View style={[
                                styles.scanConfBadge,
                                result.confidence === 'High' && styles.scanConfHigh,
                                result.confidence === 'Medium' && styles.scanConfMed,
                                result.confidence === 'Low' && styles.scanConfLow,
                              ]}>
                                <Text style={styles.scanConfText}>{result.confidence}</Text>
                              </View>
                            </View>
                          </View>

                          {isMatchable && (
                            <View style={[styles.scanCheck, isSelected && styles.scanCheckActive]}>
                              {isSelected && (
                                <Ionicons name="checkmark" size={14} color={colors.primaryForeground} />
                              )}
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <View style={{ height: 32 }} />
                  </>
                )}
              </ScrollView>
            </>
          )}

        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── SelectedItemRow ──────────────────────────────────────────────────────────

function SelectedItemRow({ item, onRemove }: { item: Item; onRemove: () => void }) {
  const imgUri = resolveImageUri(item.imageUrl);
  return (
    <View style={styles.selectedRow}>
      <View style={styles.selectedThumb}>
        {imgUri ? (
          <Image source={{ uri: imgUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
  itemsLabel: {
    marginTop: spacing.xxl,
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
    fontSize: typography.size.sm,
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
  selectedList: {
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  selectedCat: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
    marginTop: 2,
  },

  // ── Location / Notes text fields
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
  fieldIcon: {
    flexShrink: 0,
  },
  textField: {
    flex: 1,
    fontSize: typography.size.md,
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
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
    borderStyle: 'dashed',
  },
  addItemsBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },

  // ── Picker
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
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
  pickerCard: {},
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
    paddingVertical: spacing.xxxl,
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

  // ── Scan button variant
  scanBtn: {
    borderColor: `${colors.primary}30`,
    backgroundColor: `${colors.primary}08`,
    marginBottom: spacing.sm,
  },

  // ── Scan review
  scanReviewContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  scanHint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    lineHeight: typography.size.xs * 1.5,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 60,
  },
  scanRowDim: {
    opacity: 0.5,
  },
  scanThumb: {
    width: 44,
    height: 52,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scanInfo: {
    flex: 1,
  },
  scanItemName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  scanBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  scanCategory: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  scanNotInWardrobe: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  scanConfBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  scanConfHigh: {
    backgroundColor: '#dcfce7',
  },
  scanConfMed: {
    backgroundColor: '#fef9c3',
  },
  scanConfLow: {
    backgroundColor: '#fee2e2',
  },
  scanConfText: {
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  scanCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scanCheckActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scanEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxxl,
  },
  scanEmptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  scanEmptySubtitle: {
    fontSize: typography.size.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: typography.size.md * 1.5,
  },

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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
});
