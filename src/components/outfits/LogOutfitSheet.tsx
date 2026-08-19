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
import { useCreateItem, useItems } from '../../hooks/useItems';
import { useCreateOutfitLog, useScanOutfitLog, type OutfitScanResult } from '../../hooks/useOutfitLogs';
import { useCameraLaunch, useLibraryLaunch, type CapturedImage } from '../../hooks/useCameraLaunch';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';
import { PhotoSourceSheet } from '../primitives/PhotoSourceSheet';
import { colors, spacing, typography, radii } from '../../theme';
import { CATEGORY_LABELS, CATEGORY_ORDER, type Item, type ItemCategory } from '../../types/item';
import type { OutfitLoggerLaunch } from '../../contexts/GlobalOutfitLoggerContext';
import {
  buildNewClosetItemInput,
  initialScanSelections,
  mergeUniqueItemIds,
  resolvedScanItemIds,
  scanResolutionCounts,
  unresolvedScanIndexes,
  type ScanSelections,
} from '../../lib/outfit-log-scan';

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

type NewItemDraft = {
  name: string;
  brand: string;
  category: ItemCategory;
  color: string;
};

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
  initialView?: 'picker';
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
  const createItem = useCreateItem();
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
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // View
  const [view, setView] = useState<SheetView>('form');
  const [search, setSearch] = useState('');

  // Scan state
  const [scanResults, setScanResults] = useState<OutfitScanResult[] | null>(null);
  const [scanSelections, setScanSelections] = useState<ScanSelections>({});
  const [scanSkipped, setScanSkipped] = useState<Set<number>>(new Set());
  const [scanCreated, setScanCreated] = useState<Set<number>>(new Set());
  const [scanFailed, setScanFailed] = useState<Set<number>>(new Set());
  const [scanTreatAsNew, setScanTreatAsNew] = useState<Set<number>>(new Set());
  const [savingNewIndexes, setSavingNewIndexes] = useState<Set<number>>(new Set());
  const [reviewingNew, setReviewingNew] = useState(false);
  const [editingMatchIndex, setEditingMatchIndex] = useState<number | null>(null);
  const [newItemDrafts, setNewItemDrafts] = useState<Record<number, NewItemDraft>>({});
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

  const scanCounts = useMemo(
    () => scanResults
      ? scanResolutionCounts(scanResults, scanSelections, scanSkipped, scanCreated)
      : null,
    [scanCreated, scanResults, scanSelections, scanSkipped],
  );

  const unresolvedIndexes = useMemo(
    () => scanResults ? unresolvedScanIndexes(scanResults, scanSelections, scanSkipped) : [],
    [scanResults, scanSelections, scanSkipped],
  );

  const newScanIndexes = useMemo(
    () => unresolvedIndexes.filter((index) => (
      scanTreatAsNew.has(index) || scanResults?.[index]?.potential_match_ids.length === 0
    )),
    [scanResults, scanTreatAsNew, unresolvedIndexes],
  );

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
    try {
      const results = await scanOutfit.mutateAsync(image.dataUrl);
      const selections = initialScanSelections(results);
      setScanSelections(selections);
      setScanSkipped(new Set());
      setScanCreated(new Set());
      setScanFailed(new Set());
      setScanTreatAsNew(new Set());
      setSavingNewIndexes(new Set());
      setReviewingNew(false);
      setEditingMatchIndex(null);
      setNewItemDrafts({});
      setScanResults(results);
      setView('scan-review');
      track('outfit_scan_completed', {
        detected_count: results.length,
        matched_count: Object.keys(selections).length,
        unresolved_count: results.length - Object.keys(selections).length,
      });
    } catch {
      Alert.alert('Scan failed', 'Could not analyze the photo. Please try again.');
    }
  }, [scanOutfit]);

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
  }, [initialView, visible]);

  const finishScanReview = useCallback((
    selections: ScanSelections = scanSelections,
    createdIndexes: Set<number> = scanCreated,
    failedCount = scanFailed.size,
  ) => {
    const counts = scanResults
      ? scanResolutionCounts(scanResults, selections, scanSkipped, createdIndexes)
      : { matched: 0, new: 0, skipped: 0, unresolved: 0 };
    if (counts.unresolved > 0) return;
    setSelectedIds((prev) => mergeUniqueItemIds(prev, resolvedScanItemIds(selections, scanSkipped)));
    track('outfit_scan_review_completed', {
      matched_count: counts.matched,
      new_count: counts.new,
      skipped_count: counts.skipped,
      failed_count: failedCount,
    });
    setScanResults(null);
    setScanSelections({});
    setScanSkipped(new Set());
    setScanCreated(new Set());
    setScanFailed(new Set());
    setScanTreatAsNew(new Set());
    setSavingNewIndexes(new Set());
    setReviewingNew(false);
    setEditingMatchIndex(null);
    setNewItemDrafts({});
    setView('form');
  }, [scanCreated, scanFailed.size, scanResults, scanSelections, scanSkipped]);

  const chooseScanMatch = useCallback((index: number, itemId: number) => {
    setScanSelections((prev) => ({ ...prev, [index]: itemId }));
    setScanSkipped((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setScanFailed((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setScanTreatAsNew((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setEditingMatchIndex(null);
  }, []);

  const skipScanResult = useCallback((index: number) => {
    setScanSkipped((prev) => new Set(prev).add(index));
    setScanFailed((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setEditingMatchIndex(null);
  }, []);

  const restoreScanResult = useCallback((index: number) => {
    setScanSkipped((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const updateNewItemDraft = useCallback((index: number, patch: Partial<NewItemDraft>) => {
    if (!scanResults) return;
    const result = scanResults[index];
    if (!result) return;
    setNewItemDrafts((prev) => {
      const current = prev[index] ?? {
        name: result.suggested_metadata.name || result.detected_type,
        brand: '',
        category: buildNewClosetItemInput(result).category ?? 'top',
        color: result.suggested_metadata.color || '',
      };
      return { ...prev, [index]: { ...current, ...patch } };
    });
  }, [scanResults]);

  const createNewScanItems = useCallback(async (
    indexes: number[],
    useDrafts: boolean,
    finishWhenComplete: boolean,
  ) => {
    if (!scanResults || indexes.length === 0) return;
    setSavingNewIndexes((prev) => new Set([...prev, ...indexes]));
    const nextSelections = { ...scanSelections };
    const nextCreated = new Set(scanCreated);
    const failures: number[] = [];
    let addedCount = 0;

    for (const index of indexes) {
      if (nextSelections[index] !== undefined) continue;
      const result = scanResults[index];
      if (!result) continue;
      const draft = useDrafts ? newItemDrafts[index] : undefined;
      try {
        const created = await createItem.mutateAsync(buildNewClosetItemInput(result, draft));
        nextSelections[index] = created.id;
        nextCreated.add(index);
        addedCount += 1;
      } catch {
        failures.push(index);
      }
    }

    setScanSelections(nextSelections);
    setScanCreated(nextCreated);
    setScanFailed((prev) => {
      const next = new Set(prev);
      indexes.forEach((index) => next.delete(index));
      failures.forEach((index) => next.add(index));
      return next;
    });
    setSavingNewIndexes(new Set());
    track('outfit_scan_new_items_added', {
      requested_count: indexes.length,
      added_count: addedCount,
      failed_count: failures.length,
    });

    if (finishWhenComplete && failures.length === 0) {
      const counts = scanResolutionCounts(scanResults, nextSelections, scanSkipped, nextCreated);
      if (counts.unresolved === 0) finishScanReview(nextSelections, nextCreated, failures.length);
    }
  }, [createItem, finishScanReview, newItemDrafts, scanCreated, scanResults, scanSelections, scanSkipped]);

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
    setScanResults(null);
    setScanSelections({});
    setScanSkipped(new Set());
    setScanCreated(new Set());
    setScanFailed(new Set());
    setScanTreatAsNew(new Set());
    setSavingNewIndexes(new Set());
    setReviewingNew(false);
    setEditingMatchIndex(null);
    setNewItemDrafts({});
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
  const showAutoLaunchState = Boolean(
    initialLaunch &&
    view === 'form' &&
    scanResults === null &&
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
                  onPress={() => setSourcePickerOpen(true)}
                  disabled={scanOutfit.isPending}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Match your outfit from a photo"
                >
                  {scanOutfit.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="camera-outline" size={20} color={colors.primary} />
                  )}
                  <View style={styles.addItemsBtnCopy}>
                    <Text style={styles.addItemsBtnText}>
                      {scanOutfit.isPending ? 'Matching photo…' : 'Match from a photo'}
                    </Text>
                    {!scanOutfit.isPending && (
                      <Text style={styles.addItemsBtnSubtext}>
                        Take a selfie or choose a photo from your library
                      </Text>
                    )}
                  </View>
                  {!scanOutfit.isPending && <Ionicons name="chevron-forward" size={16} color={colors.primary} />}
                </TouchableOpacity>

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

          {/* ════════════════════════════════════════
              SCAN REVIEW VIEW
          ════════════════════════════════════════ */}
          {view === 'scan-review' && scanResults !== null && (
            <>
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={() => {
                    setScanResults(null);
                    setScanSelections({});
                    setScanSkipped(new Set());
                    setScanCreated(new Set());
                    setScanFailed(new Set());
                    setScanTreatAsNew(new Set());
                    setSavingNewIndexes(new Set());
                    setReviewingNew(false);
                    setEditingMatchIndex(null);
                    setNewItemDrafts({});
                    setView('form');
                  }}
                  style={styles.backBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back-outline" size={20} color={colors.foreground} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Check Your Matches</Text>
                <TouchableOpacity
                  onPress={() => finishScanReview()}
                  disabled={(scanCounts?.unresolved ?? 0) > 0}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[
                    styles.headerSave,
                    (scanCounts?.unresolved ?? 0) > 0 && styles.headerSaveDisabled,
                  ]}>
                    Done
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
                    <View style={styles.scanSummary}>
                      <Text style={styles.scanSummaryTitle}>
                        We found {scanResults.length} {scanResults.length === 1 ? 'piece' : 'pieces'}
                      </Text>
                      <Text style={styles.scanSummaryText}>
                        {scanCounts?.matched ?? 0} matched · {scanCounts?.new ?? 0} new · {scanCounts?.unresolved ?? 0} to review
                      </Text>
                    </View>
                    <Text style={styles.scanHint}>
                      Confirm each match before saving this outfit.
                    </Text>
                    {scanResults.map((result, idx) => {
                      const selectedId = scanSelections[idx];
                      const matched = selectedId !== undefined
                        ? allItems.find((it) => it.id === selectedId) ?? null
                        : null;
                      const isSkipped = scanSkipped.has(idx);
                      const isCreated = scanCreated.has(idx);
                      const isFailed = scanFailed.has(idx);
                      const isSaving = savingNewIndexes.has(idx);
                      const isEditingMatch = editingMatchIndex === idx;
                      const imgUri = matched ? itemImageUri(matched) : result.crop;
                      const candidateIds = result.potential_match_ids.length > 0
                        ? result.potential_match_ids
                        : allItems
                          .filter((item) => item.category === result.suggested_metadata.category && item.id !== selectedId)
                          .slice(0, 5)
                          .map((item) => item.id);
                      const treatAsNew = scanTreatAsNew.has(idx);
                      const showCandidates = !treatAsNew && !isSkipped && (selectedId === undefined || isEditingMatch) && candidateIds.length > 0;
                      const isNewPiece = (treatAsNew || candidateIds.length === 0) && selectedId === undefined && !isSkipped;
                      const draft = newItemDrafts[idx] ?? {
                        name: result.suggested_metadata.name || result.detected_type,
                        brand: '',
                        category: buildNewClosetItemInput(result).category ?? 'top',
                        color: result.suggested_metadata.color || '',
                      };

                      return (
                        <View
                          key={idx}
                          style={[styles.scanCard, isSkipped && styles.scanCardSkipped]}
                        >
                          <View style={styles.scanCardHeader}>
                            <View style={styles.scanThumb}>
                              {imgUri ? (
                                <Image
                                  source={{ uri: imgUri }}
                                  style={StyleSheet.absoluteFill}
                                  resizeMode={matched ? itemImageContentFit(matched) : 'contain'}
                                />
                              ) : (
                                <Ionicons name="shirt-outline" size={22} color={colors.mutedForeground} />
                              )}
                            </View>

                            <View style={styles.scanInfo}>
                              <Text style={styles.scanItemName} numberOfLines={2}>
                                {matched ? matched.name : result.suggested_metadata.name || result.detected_type}
                              </Text>
                              <Text
                                style={[
                                  styles.scanDetectedLabel,
                                  isCreated && styles.scanStatusAddedText,
                                  isSkipped && styles.scanStatusSkippedText,
                                ]}
                                numberOfLines={1}
                              >
                                {isSkipped
                                  ? 'Skipped'
                                  : isCreated
                                    ? 'Added to your closet'
                                    : matched
                                      ? 'Matched from your closet'
                                      : candidateIds.length > 0
                                        ? 'Needs a closet match'
                                        : 'New to your closet'}
                              </Text>
                            </View>
                          </View>

                          {showCandidates && (
                            <View style={styles.scanCandidates}>
                              <Text style={styles.scanCandidatesLabel}>Which closet piece is this?</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scanCandidateRow}>
                                {candidateIds.map((id) => {
                                  const candidate = allItems.find((item) => item.id === id);
                                  if (!candidate) return null;
                                  const candidateUri = itemImageUri(candidate);
                                  return (
                                    <TouchableOpacity
                                      key={candidate.id}
                                      style={styles.scanCandidate}
                                      onPress={() => chooseScanMatch(idx, candidate.id)}
                                      activeOpacity={0.75}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Use ${candidate.name} from your closet`}
                                    >
                                      <View style={styles.scanCandidateImage}>
                                        {candidateUri ? (
                                          <Image source={{ uri: candidateUri }} style={StyleSheet.absoluteFill} resizeMode={itemImageContentFit(candidate)} />
                                        ) : (
                                          <Ionicons name="shirt-outline" size={18} color={colors.mutedForeground} />
                                        )}
                                      </View>
                                      <Text style={styles.scanCandidateName} numberOfLines={2}>{candidate.name}</Text>
                                      <Text style={styles.scanCandidateUse}>Use this piece</Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                              <TouchableOpacity
                                style={styles.scanGhostButton}
                                onPress={() => {
                                  setScanTreatAsNew((prev) => new Set(prev).add(idx));
                                  setReviewingNew(true);
                                  setEditingMatchIndex(null);
                                }}
                              >
                                <Text style={styles.scanGhostButtonText}>None of these—add as a new piece</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {isNewPiece && reviewingNew && (
                            <View style={styles.newItemEditor}>
                              <Text style={styles.newItemEditorTitle}>Review new piece</Text>
                              <TextInput
                                style={styles.newItemInput}
                                value={draft.name}
                                onChangeText={(name) => updateNewItemDraft(idx, { name })}
                                placeholder="Piece name"
                                placeholderTextColor={colors.mutedForeground}
                              />
                              <View style={styles.newItemInputRow}>
                                <TextInput
                                  style={[styles.newItemInput, styles.newItemInputHalf]}
                                  value={draft.color}
                                  onChangeText={(color) => updateNewItemDraft(idx, { color })}
                                  placeholder="Colour"
                                  placeholderTextColor={colors.mutedForeground}
                                />
                                <TextInput
                                  style={[styles.newItemInput, styles.newItemInputHalf]}
                                  value={draft.brand}
                                  onChangeText={(brand) => updateNewItemDraft(idx, { brand })}
                                  placeholder="Brand (optional)"
                                  placeholderTextColor={colors.mutedForeground}
                                />
                              </View>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newItemCategoryRow}>
                                {CATEGORY_ORDER.map((category) => (
                                  <TouchableOpacity
                                    key={category}
                                    style={[styles.newItemCategory, draft.category === category && styles.newItemCategoryActive]}
                                    onPress={() => updateNewItemDraft(idx, { category })}
                                  >
                                    <Text style={[styles.newItemCategoryText, draft.category === category && styles.newItemCategoryTextActive]}>
                                      {CATEGORY_LABELS[category]}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                              <TouchableOpacity
                                style={styles.scanPrimaryButton}
                                onPress={() => createNewScanItems([idx], true, false)}
                                disabled={isSaving || !draft.name.trim()}
                              >
                                {isSaving && <ActivityIndicator size="small" color={colors.primaryForeground} />}
                                <Text style={styles.scanPrimaryButtonText}>
                                  {isFailed ? 'Try adding again' : 'Add to closet & select'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {isFailed && !reviewingNew && (
                            <Text style={styles.scanFailureText}>This piece wasn’t added. Review it or try again.</Text>
                          )}

                          <View style={styles.scanCardActions}>
                            {matched && !isCreated && !isSkipped && (
                              <TouchableOpacity
                                style={styles.scanSecondaryButton}
                                onPress={() => {
                                  setScanSelections((prev) => {
                                    const next = { ...prev };
                                    delete next[idx];
                                    return next;
                                  });
                                  setEditingMatchIndex(idx);
                                }}
                              >
                                <Text style={styles.scanSecondaryButtonText}>Change match</Text>
                              </TouchableOpacity>
                            )}
                            {isSkipped ? (
                              <TouchableOpacity style={styles.scanSecondaryButton} onPress={() => restoreScanResult(idx)}>
                                <Text style={styles.scanSecondaryButtonText}>Restore</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity style={styles.scanGhostButton} onPress={() => skipScanResult(idx)}>
                                <Text style={styles.scanGhostButtonText}>Skip—AI got this wrong</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}

                    {newScanIndexes.length > 0 && (
                      <View style={styles.scanFooterActions}>
                        <TouchableOpacity
                          style={styles.scanPrimaryButton}
                          onPress={() => createNewScanItems(newScanIndexes, false, true)}
                          disabled={savingNewIndexes.size > 0}
                        >
                          {savingNewIndexes.size > 0 && <ActivityIndicator size="small" color={colors.primaryForeground} />}
                          <Text style={styles.scanPrimaryButtonText}>
                            Add {newScanIndexes.length} new {newScanIndexes.length === 1 ? 'piece' : 'pieces'} to closet & select
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.scanSecondaryButton} onPress={() => setReviewingNew(true)}>
                          <Text style={styles.scanSecondaryButtonText}>Review new pieces</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {unresolvedIndexes.length === 0 && (
                      <TouchableOpacity style={[styles.scanPrimaryButton, styles.scanDoneButton]} onPress={() => finishScanReview()}>
                        <Text style={styles.scanPrimaryButtonText}>Use these clothes</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </ScrollView>
            </>
          )}

        </SafeAreaView>
      </KeyboardAvoidingView>

      <PhotoSourceSheet
        visible={sourcePickerOpen}
        title="Add an Outfit Photo"
        subtitle="We’ll match the visible pieces to your closet."
        cameraLabel="Take a selfie"
        cameraHint="Use your camera right now"
        libraryLabel="Choose from library"
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
  fieldIcon: {
    flexShrink: 0,
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
  scanReviewContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  scanSummary: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  scanSummaryTitle: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  scanSummaryText: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  scanHint: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    lineHeight: typography.text.caption.fontSize * 1.5,
  },
  scanCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  scanCardSkipped: {
    backgroundColor: colors.surfaceSubtle,
  },
  scanCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scanThumb: {
    width: 64,
    height: 76,
    borderRadius: radii.md,
    borderCurve: 'continuous',
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
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  scanDetectedLabel: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  scanStatusAddedText: {
    color: colors.success,
  },
  scanStatusSkippedText: {
    color: colors.mutedForeground,
  },
  scanBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  scanStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSelected,
  },
  scanStatusAdded: {
    backgroundColor: '#E3EFE6',
  },
  scanStatusSkipped: {
    backgroundColor: colors.muted,
  },
  scanStatusText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  scanCandidates: {
    gap: spacing.sm,
  },
  scanCandidatesLabel: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  scanCandidateRow: {
    gap: spacing.sm,
  },
  scanCandidate: {
    width: 112,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.sm,
  },
  scanCandidateImage: {
    height: 82,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCandidateName: {
    minHeight: 32,
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  scanCandidateUse: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    marginTop: 2,
  },
  scanCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  scanPrimaryButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scanPrimaryButtonText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
    textAlign: 'center',
  },
  scanSecondaryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scanSecondaryButtonText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  scanGhostButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  scanGhostButtonText: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
  },
  scanFailureText: {
    fontSize: typography.text.caption.fontSize,
    color: colors.error,
  },
  scanFooterActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  scanDoneButton: {
    marginTop: spacing.sm,
  },
  newItemEditor: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  newItemEditorTitle: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  newItemInput: {
    minHeight: 44,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.foreground,
  },
  newItemInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  newItemInputHalf: {
    flex: 1,
  },
  newItemCategoryRow: {
    gap: spacing.sm,
  },
  newItemCategory: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  newItemCategoryActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  newItemCategoryText: {
    fontSize: typography.text.caption.fontSize,
    color: colors.foreground,
  },
  newItemCategoryTextActive: {
    color: colors.primaryForeground,
  },
  scanEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxxl,
  },
  scanEmptyTitle: {
    fontSize: typography.text.sectionTitle.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  scanEmptySubtitle: {
    fontSize: typography.text.body.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: typography.text.body.fontSize * 1.5,
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
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
});
