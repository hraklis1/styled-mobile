import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUpdateProfile } from '../../hooks/useProfile';
import type {
  LocationOverride,
  StylingLocationContext,
} from '../../hooks/useActiveStylingLocation';
import { colors, radii, spacing, typography } from '../../theme';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';

const WINDOW_HEIGHT = Dimensions.get('window').height;

type OverrideMode = LocationOverride['mode'];

type Props = {
  visible: boolean;
  activeLocation: StylingLocationContext;
  homeLocation?: string;
  override: LocationOverride | null;
  onSelectOverride: (override: LocationOverride) => void;
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  permissionCanAskAgain: boolean;
  onRequestCurrent: () => Promise<boolean>;
  onRefreshCurrent: () => Promise<boolean>;
  onOpenSettings: () => Promise<unknown>;
  onClose: () => void;
};

type LocationFeedback = 'success' | 'error' | null;

export function StylingLocationSheet({
  visible,
  activeLocation,
  homeLocation,
  override,
  onSelectOverride,
  permissionStatus,
  permissionCanAskAgain,
  onRequestCurrent,
  onRefreshCurrent,
  onOpenSettings,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const updateProfile = useUpdateProfile();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedHome, setSavedHome] = useState(homeLocation?.trim() ?? '');
  const [home, setHome] = useState(homeLocation ?? '');
  const [editingHome, setEditingHome] = useState(false);
  const [editingDestination, setEditingDestination] = useState(false);
  const [destinationDraft, setDestinationDraft] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<LocationFeedback>(null);

  const selected: OverrideMode = override?.mode ?? 'current';
  const isEditing = editingHome || editingDestination;

  useEffect(() => {
    if (visible) bottomSheetRef.current?.present();
    else bottomSheetRef.current?.dismiss();
  }, [visible]);

  useEffect(() => {
    const nextHome = homeLocation?.trim() ?? '';
    setSavedHome(nextHome);
    if (!editingHome) setHome(nextHome);
  }, [editingHome, homeLocation]);

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  const showLocationFeedback = useCallback((feedback: LocationFeedback) => {
    setLocationFeedback(feedback);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setLocationFeedback(null), 3000);
  }, []);

  const resetEditing = useCallback(() => {
    setEditingHome(false);
    setEditingDestination(false);
    setDestinationDraft('');
  }, []);

  const handleDismiss = useCallback(() => {
    resetEditing();
    setHome(savedHome);
    setLocationFeedback(null);
    onClose();
  }, [onClose, resetEditing, savedHome]);

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const refreshCurrent = useCallback(async () => {
    if (permissionStatus !== 'granted' && !permissionCanAskAgain) {
      try {
        await onOpenSettings();
      } catch {
        showLocationFeedback('error');
      }
      return;
    }

    setLocating(true);
    setLocationFeedback(null);
    try {
      const success = permissionStatus === 'granted'
        ? await onRefreshCurrent()
        : await onRequestCurrent();
      showLocationFeedback(success ? 'success' : 'error');
    } catch {
      showLocationFeedback('error');
    } finally {
      setLocating(false);
    }
  }, [
    onOpenSettings,
    onRefreshCurrent,
    onRequestCurrent,
    permissionCanAskAgain,
    permissionStatus,
    showLocationFeedback,
  ]);

  const handleSelectCurrent = useCallback(() => {
    resetEditing();
    onSelectOverride({ mode: 'current' });
    void refreshCurrent();
  }, [onSelectOverride, refreshCurrent, resetEditing]);

  const handleSelectHome = useCallback(() => {
    setEditingDestination(false);
    setDestinationDraft('');
    setLocationFeedback(null);
    if (!savedHome) {
      // Nothing to select yet — drop the user straight into the editor.
      setHome('');
      setEditingHome(true);
      return;
    }
    onSelectOverride({ mode: 'home' });
  }, [onSelectOverride, savedHome]);

  const handleSelectDestination = useCallback(() => {
    setEditingHome(false);
    setLocationFeedback(null);
    setDestinationDraft(override?.mode === 'destination' ? override.label : '');
    setEditingDestination(true);
  }, [override]);

  const handleDestinationChosen = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onSelectOverride({ mode: 'destination', label: trimmed });
    resetEditing();
  }, [onSelectOverride, resetEditing]);

  const startEditingHome = useCallback(() => {
    setEditingDestination(false);
    setHome(savedHome);
    setEditingHome(true);
  }, [savedHome]);

  const cancelEditingHome = useCallback(() => {
    setHome(savedHome);
    setEditingHome(false);
  }, [savedHome]);

  const trimmedHome = home.trim();
  const homeChanged = trimmedHome !== savedHome;

  const saveHome = useCallback(() => {
    if (!homeChanged) return;
    updateProfile.mutate(
      { location: trimmedHome || null },
      {
        onSuccess: () => {
          setSavedHome(trimmedHome);
          setHome(trimmedHome);
          setEditingHome(false);
          // Selecting Home only makes sense once a city is saved.
          if (trimmedHome) onSelectOverride({ mode: 'home' });
        },
      },
    );
  }, [homeChanged, onSelectOverride, trimmedHome, updateProfile]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  const currentSubtitle = permissionStatus === 'granted'
    ? activeLocation.source === 'current' && activeLocation.label
      ? activeLocation.label
      : 'Locating…'
    : permissionCanAskAgain
      ? 'Enable to use your live location'
      : 'Turn on location access in Settings';

  const destinationSubtitle = override?.mode === 'destination'
    ? override.label
    : 'Style for a trip or event';

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      enableDynamicSizing={!isEditing}
      snapPoints={isEditing ? ['82%'] : undefined}
      maxDynamicContentSize={WINDOW_HEIGHT * 0.82}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.sheetBackground}
      enablePanDownToClose
    >
      <BottomSheetView style={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Style me for</Text>
            <Text style={styles.subtitle}>Used for weather-aware outfit suggestions.</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close location options"
          >
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.options}>
          {/* ── Current location ─────────────────────────────────── */}
          <OptionRow
            icon="navigate-outline"
            title="Current location"
            subtitle={currentSubtitle}
            selected={selected === 'current'}
            loading={locating}
            onPress={handleSelectCurrent}
            accessibilityLabel="Style for my current location"
          />
          {selected === 'current' && locationFeedback && (
            <View style={styles.feedbackRow}>
              <Ionicons
                name={locationFeedback === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                size={15}
                color={locationFeedback === 'success' ? colors.primary : colors.error}
              />
              <Text style={[styles.feedbackText, locationFeedback === 'error' && styles.feedbackError]}>
                {locationFeedback === 'success'
                  ? 'Location updated'
                  : 'Couldn’t update your location. Please try again.'}
              </Text>
            </View>
          )}

          {/* ── Home city ────────────────────────────────────────── */}
          <OptionRow
            icon="home-outline"
            title="Home city"
            subtitle={savedHome || 'Set your home city'}
            selected={selected === 'home'}
            onPress={handleSelectHome}
            accessibilityLabel="Style for my home city"
            trailing={
              savedHome && !editingHome ? (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={startEditingHome}
                  accessibilityRole="button"
                  accessibilityLabel="Edit Home city"
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
          {editingHome && (
            <View style={styles.editor}>
              <LocationAutocompleteInput
                value={home}
                onChangeText={setHome}
                onSelect={setHome}
                placeholder="Search a city or region"
                autoFocus
                showUseMyLocation={false}
              />
              <View style={styles.editorActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelEditingHome}
                  disabled={updateProfile.isPending}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, (!homeChanged || updateProfile.isPending) && styles.buttonDisabled]}
                  onPress={saveHome}
                  disabled={!homeChanged || updateProfile.isPending}
                >
                  {updateProfile.isPending ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {trimmedHome ? 'Save Home city' : 'Remove Home city'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Destination ──────────────────────────────────────── */}
          <OptionRow
            icon="airplane-outline"
            title="Destination"
            subtitle={destinationSubtitle}
            selected={selected === 'destination'}
            onPress={handleSelectDestination}
            accessibilityLabel="Style for a destination"
          />
          {editingDestination && (
            <View style={styles.editor}>
              <LocationAutocompleteInput
                value={destinationDraft}
                onChangeText={setDestinationDraft}
                onSelect={handleDestinationChosen}
                placeholder="Search a city you're heading to"
                autoFocus
                showUseMyLocation={false}
              />
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={resetEditing}
                accessibilityRole="button"
                accessibilityLabel="Cancel destination"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

type OptionRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  selected: boolean;
  loading?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  trailing?: ReactNode;
};

function OptionRow({
  icon,
  title,
  subtitle,
  selected,
  loading,
  onPress,
  accessibilityLabel,
  trailing,
}: OptionRowProps) {
  return (
    <TouchableOpacity
      style={[styles.optionRow, selected && styles.optionRowSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
        <Ionicons name={icon} size={20} color={selected ? colors.primary : colors.mutedForeground} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      {trailing}
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : selected ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
      ) : (
        <View style={styles.radioOutline} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border, width: 36 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  headerCopy: { flex: 1, gap: 3 },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.foreground },
  subtitle: { fontSize: typography.size.sm, lineHeight: 19, color: colors.mutedForeground },
  closeButton: {
    width: 36, height: 36, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  options: { gap: spacing.sm },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated,
  },
  optionRowSelected: { borderColor: colors.primary, backgroundColor: `${colors.primary}0D` },
  optionIcon: {
    width: 42, height: 42, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  optionIconSelected: { backgroundColor: `${colors.primary}1A` },
  optionCopy: { flex: 1, gap: 2 },
  optionTitle: { fontSize: typography.size.md, color: colors.foreground, fontWeight: typography.weight.semibold },
  optionSubtitle: { fontSize: typography.size.xs, lineHeight: 17, color: colors.mutedForeground },
  radioOutline: {
    width: 22, height: 22, borderRadius: radii.full, borderWidth: 2, borderColor: colors.border,
  },
  feedbackRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  feedbackText: { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.medium },
  feedbackError: { color: colors.error },
  editButton: {
    minWidth: 52, minHeight: 34, alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.full, backgroundColor: colors.surfaceSubtle,
  },
  editButtonText: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.semibold },
  editor: { gap: spacing.md, zIndex: 10, paddingHorizontal: spacing.xs },
  editorActions: { flexDirection: 'row', gap: spacing.sm },
  cancelButton: {
    minHeight: 44, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.full, backgroundColor: colors.surfaceSubtle,
  },
  cancelButtonText: { fontSize: typography.size.sm, color: colors.foreground, fontWeight: typography.weight.semibold },
  primaryButton: {
    flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.full, backgroundColor: colors.primary,
  },
  buttonDisabled: { opacity: 0.45 },
  primaryButtonText: { fontSize: typography.size.sm, color: colors.primaryForeground, fontWeight: typography.weight.semibold },
});
