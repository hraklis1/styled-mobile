import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { track } from '../../lib/analytics';
import { useItems } from '../../hooks/useItems';
import { useCreateOutfitLog } from '../../hooks/useOutfitLogs';
import { useCameraLaunch, useLibraryLaunch, type CapturedImage } from '../../hooks/useCameraLaunch';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';
import { PhotoSourceSheet } from '../primitives/PhotoSourceSheet';
import { colors, spacing, stroke, typography, radii } from '../../theme';
import { PieceThumb } from '../wardrobe/scan-review/PieceThumb';
import { PrimaryButton, actionBarStyle } from '../wardrobe/scan-review/ActionBar';
import { OutlinePill } from '../wardrobe/scan-review/atoms';
import { ClosetPicker } from './wear-review/ClosetMatchSheet';
import type { Item } from '../../types/item';
import type { OutfitLoggerLaunch } from '../../contexts/GlobalOutfitLoggerContext';
import { mergeUniqueItemIds } from '../../lib/outfit-log-scan';
import { WearReviewWorkspace } from './wear-review/WearReviewWorkspace';
import { discardWearFlow, startWearScan } from '../../features/wear-log/runner';
import { useWearLogStore } from '../../features/wear-log/store';
import { localISODate } from '../../lib/dates';

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

// YYYY-MM-DD for the API, in the user's local calendar
const toISODate = localISODate;

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
  const { data: allItems = [] } = useItems();
  const createLog = useCreateOutfitLog({ alertOnError: false });
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

  // The view is chosen as the sheet opens, not reset as it closes: a close
  // animates out on whatever view it had, so resetting then flashed the form.
  useLayoutEffect(() => {
    if (visible) setView(initialView ?? 'form');
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
    setSourcePickerOpen(false);
    setAutoLaunchPending(false);
  }, []);

  useEffect(() => {
    if (!visible) reset();
    // (view is set on open — see the layout effect above)
  }, [reset, visible]);

  // Reset happens in the !visible effect, after the sheet has gone, so
  // closing never flashes the empty form on the way out.
  const handleClose = () => {
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
      {/* While the sheet closes after a log the flow is already idle; keep this
          branch (it renders nothing) so the empty form doesn't flash on the way out. */}
      {view === 'scan-review' && (wearStatus !== 'idle' || !visible) ? (
        <WearReviewWorkspace
          onClose={handleClose}
          // Plain close: the !visible effect resets the form after the sheet
          // has gone, so it doesn't flash the form on the way out.
          onMinimize={onClose}
          onLogged={() => {
            onSaved?.();
            onClose();
          }}
          onPickManually={() => {
            discardWearFlow();
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
                  style={styles.headerIcon}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={24} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} accessibilityRole="header">What did you wear?</Text>
                <View style={styles.headerSpacer} />
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
                  <View style={styles.scanIcon}>
                    <Ionicons name={resumable ? 'images-outline' : 'camera-outline'} size={20} color={colors.primaryForeground} />
                  </View>
                  <View style={styles.addItemsBtnCopy}>
                    <Text style={styles.scanTitle}>
                      {resumable ? 'Continue your photo' : 'Match from a photo'}
                    </Text>
                    <Text style={styles.addItemsBtnSubtext}>
                      {resumable
                        ? 'Pick up the review where you left it'
                        : 'Take a selfie or choose a photo from your library'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
                {resumable ? (
                  <TouchableOpacity onPress={() => { discardWearFlow(); setSourcePickerOpen(true); }} style={styles.newPhotoLink}>
                    <Text style={styles.addItemsBtnSubtext}>Use a different photo</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.addItemsBtn, styles.closetRow]}
                  onPress={() => {
                    setView('picker');
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={selectedItems.length > 0 ? 'Add more pieces from your closet' : 'Choose pieces from your closet'}
                >
                  <Ionicons name="shirt-outline" size={20} color={colors.foreground} />
                  <View style={styles.addItemsBtnCopy}>
                    <Text style={styles.addItemsBtnText}>
                      {selectedItems.length > 0 ? 'Add more from your closet' : 'Choose from your closet'}
                    </Text>
                    <Text style={styles.addItemsBtnSubtext}>Select the pieces you wore yourself</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
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
                        color={colors.mutedForeground}
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
                              accessibilityRole="button"
                              accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}`}
                              accessibilityState={{ selected: rating != null && rating >= star }}
                            >
                              <Ionicons
                                name={rating != null && rating >= star ? 'star' : 'star-outline'}
                                size={28}
                                color={rating != null && rating >= star ? colors.accentInk : colors.controlOutline}
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
              {/* The finishing action appears once there's something to log, as in the photo review. */}
              {selectedIds.length > 0 ? (
                <View style={styles.bar}>
                  {createLog.isError ? (
                    <Text style={styles.saveError} accessibilityRole="alert">Couldn’t log this outfit. Check your connection and try again.</Text>
                  ) : null}
                  <PrimaryButton
                    label={createLog.isPending ? 'Logging' : `Log outfit · ${selectedIds.length === 1 ? '1 piece' : `${selectedIds.length} pieces`}`}
                    busy={createLog.isPending}
                    onPress={handleSave}
                  />
                </View>
              ) : null}
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
                    <Ionicons name="close" size={24} color={colors.foreground} />
                  ) : (
                    <>
                      <Ionicons name="chevron-back-outline" size={20} color={colors.foreground} />
                      <Text style={styles.backText}>Back</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.headerTitle} accessibilityRole="header">Choose pieces</Text>
                <View style={styles.headerSpacer} />
              </View>

              <ClosetPicker
                items={allItems}
                selectedIds={selectedIds}
                columns={3}
                emptyHint="Add clothes to your closet, then come back to log what you wore."
                footer={<OutlinePill label="Add new clothes to your closet" icon="add" onPress={handleAddToWardrobe} />}
                onPick={toggleItem}
              />
              <View style={styles.bar}>
                <PrimaryButton
                  label={selectedIds.length === 0 ? 'Choose the pieces you wore' : `Done · ${selectedIds.length === 1 ? '1 piece' : `${selectedIds.length} pieces`}`}
                  disabled={selectedIds.length === 0}
                  onPress={() => setView('form')}
                />
              </View>
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
  return (
    <View style={styles.selectedRow}>
      <PieceThumb uri={itemImageUri(item)} fit={itemImageContentFit(item)} width={40} height={50} />
      <View style={styles.selectedInfo}>
        <Text style={styles.selectedName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.selectedCat}>{item.category}</Text>
      </View>
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name}`}
      >
        <Ionicons name="close" size={18} color={colors.mutedForeground} />
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
    paddingHorizontal: spacing.md,
    minHeight: 52,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: colors.hairline,
  },
  headerIcon: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  bar: { ...actionBarStyle, paddingBottom: spacing.sm },
  saveError: { ...typography.text.meta, color: colors.destructive, textAlign: 'center' },

  headerTitle: {
    ...typography.text.editorialSection,
    color: colors.foreground,
  },
  headerSpacer: { minWidth: 44 },

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
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.action,
    borderWidth: stroke.fine,
    borderColor: colors.controlOutline,
  },
  datePillActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
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
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wide,
  },
  selectedHeaderCount: {
    ...typography.text.meta,
    color: colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  selectedList: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderTopWidth: stroke.hairline,
    borderTopColor: colors.hairline,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 66,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: colors.hairline,
  },

  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    ...typography.text.body,
    fontWeight: typography.weight.medium,
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
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: colors.hairline,
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
    borderWidth: stroke.fine,
    borderColor: colors.controlOutline,
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
  },
  addItemsBtnText: {
    ...typography.text.body,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
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

  // ── Scan button variant
  // Photo matching is the main path: a taller, quieter card that leads.
  scanBtn: {
    borderWidth: 0,
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  scanIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    ...typography.text.editorialSection,
    fontSize: 20,
    color: colors.foreground,
  },
  // The hand-picked path sits beneath as a plain row, not a second card.
  closetRow: {
    backgroundColor: 'transparent',
    gap: spacing.md,
    borderTopWidth: stroke.hairline,
    borderBottomWidth: stroke.hairline,
    borderColor: colors.hairline,
    borderRadius: 0,
  },

  // ── Scan review

  // ── "Add to wardrobe" footer in picker

});
