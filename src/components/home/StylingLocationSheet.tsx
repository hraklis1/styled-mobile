import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { StylingLocationContext } from '../../hooks/useActiveStylingLocation';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';

const WINDOW_HEIGHT = Dimensions.get('window').height;

type Props = {
  visible: boolean;
  activeLocation: StylingLocationContext;
  homeLocation?: string;
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
  const [locating, setLocating] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<LocationFeedback>(null);

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

  const handleDismiss = useCallback(() => {
    setEditingHome(false);
    setHome(savedHome);
    setLocationFeedback(null);
    onClose();
  }, [onClose, savedHome]);

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleCurrent = async () => {
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
  };

  const startEditingHome = () => {
    setHome(savedHome);
    setEditingHome(true);
  };

  const cancelEditingHome = () => {
    setHome(savedHome);
    setEditingHome(false);
  };

  const trimmedHome = home.trim();
  const homeChanged = trimmedHome !== savedHome;

  const saveHome = () => {
    if (!homeChanged) return;
    updateProfile.mutate(
      { location: trimmedHome || null },
      {
        onSuccess: () => {
          setSavedHome(trimmedHome);
          setHome(trimmedHome);
          setEditingHome(false);
        },
      },
    );
  };

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

  const currentActionLabel = permissionStatus === 'granted'
    ? 'Refresh current location'
    : permissionCanAskAgain
      ? 'Enable current location'
      : 'Open Settings';

  const activeLocationHint = activeLocation.source === 'home'
    ? 'Using your Home city fallback'
    : activeLocation.label
      ? 'Using your current location'
      : activeLocation.fallbackReason || 'Location is unavailable';

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      enableDynamicSizing={!editingHome}
      snapPoints={editingHome ? ['82%'] : undefined}
      maxDynamicContentSize={WINDOW_HEIGHT * 0.76}
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
            <Text style={styles.title}>Location for today</Text>
            <Text style={styles.subtitle}>Used for weather-aware outfit suggestions.</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close location details"
          >
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.activeCard}>
          <View style={styles.cardHeader}>
            <View style={styles.optionIcon}>
              <Ionicons
                name={activeLocation.source === 'home' ? 'home-outline' : 'navigate-outline'}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardLabel}>Styling for</Text>
              <Text style={styles.cardValue}>{activeLocation.label || 'No location available'}</Text>
              <Text style={styles.cardHint}>{activeLocationHint}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCurrent}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel={currentActionLabel}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons
                  name={permissionStatus === 'denied' && !permissionCanAskAgain ? 'settings-outline' : 'navigate-outline'}
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.secondaryButtonText}>{currentActionLabel}</Text>
              </>
            )}
          </TouchableOpacity>

          {locationFeedback && (
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
        </View>

        <View style={[styles.homeCard, editingHome && styles.homeCardEditing]}>
          <View style={styles.homeSummary}>
            <View style={styles.homeCopy}>
              <Text style={styles.sectionTitle}>Home city</Text>
              <Text style={styles.homeValue}>{savedHome || 'Not set'}</Text>
              <Text style={styles.cardHint}>Used automatically when current location is unavailable.</Text>
            </View>
            {!editingHome && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={startEditingHome}
                accessibilityRole="button"
                accessibilityLabel="Edit Home city"
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

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
        </View>
      </BottomSheetView>
    </BottomSheetModal>
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
  activeCard: {
    gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated, ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionIcon: {
    width: 42, height: 42, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.primary}15`,
  },
  cardCopy: { flex: 1, gap: 2 },
  cardLabel: {
    fontSize: 10, color: colors.primary, fontWeight: typography.weight.bold,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  cardValue: { fontSize: typography.size.lg, color: colors.foreground, fontWeight: typography.weight.semibold },
  cardHint: { fontSize: typography.size.xs, lineHeight: 17, color: colors.mutedForeground },
  secondaryButton: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.border,
  },
  secondaryButtonText: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.semibold },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  feedbackText: { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.medium },
  feedbackError: { color: colors.error },
  homeCard: {
    gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated, ...shadows.sm,
  },
  homeCardEditing: { flex: 1 },
  homeSummary: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  homeCopy: { flex: 1, gap: 2 },
  sectionTitle: { fontSize: typography.size.md, color: colors.foreground, fontWeight: typography.weight.semibold },
  homeValue: { fontSize: typography.size.sm, color: colors.foreground, fontWeight: typography.weight.medium },
  editButton: {
    minWidth: 52, minHeight: 34, alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.full, backgroundColor: colors.surfaceSubtle,
  },
  editButtonText: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.semibold },
  editor: { gap: spacing.md, zIndex: 10 },
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
