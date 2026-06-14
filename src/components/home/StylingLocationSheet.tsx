import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateProfile } from '../../hooks/useProfile';
import type { StylingLocationContext } from '../../hooks/useActiveStylingLocation';
import { colors, radii, shadows, spacing, typography } from '../../theme';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';

type Props = {
  visible: boolean;
  activeLocation: StylingLocationContext;
  homeLocation?: string;
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  onRequestCurrent: () => Promise<unknown>;
  onRefreshCurrent: () => void;
  onClose: () => void;
};

export function StylingLocationSheet({
  visible,
  activeLocation,
  homeLocation,
  permissionStatus,
  onRequestCurrent,
  onRefreshCurrent,
  onClose,
}: Props) {
  const updateProfile = useUpdateProfile();
  const [home, setHome] = useState(homeLocation ?? '');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (visible) setHome(homeLocation ?? '');
  }, [homeLocation, visible]);

  const handleCurrent = async () => {
    setLocating(true);
    try {
      if (permissionStatus === 'granted') onRefreshCurrent();
      else await onRequestCurrent();
    } finally {
      setLocating(false);
    }
  };

  const saveHome = () => {
    updateProfile.mutate({ location: home.trim() || null });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Location for styling</Text>
            <Text style={styles.subtitle}>Current location is used automatically. Home is your fallback.</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close location details">
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.optionIcon}>
              <Ionicons
                name={activeLocation.source === 'current' ? 'navigate-outline' : 'home-outline'}
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardLabel}>Using now</Text>
              <Text style={styles.cardValue}>{activeLocation.label || 'No location available'}</Text>
              <Text style={styles.cardHint}>
                {activeLocation.source === 'home' ? 'Home fallback' : activeLocation.fallbackReason || 'Current location'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleCurrent} disabled={locating}>
            {locating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>
                  {permissionStatus === 'granted' ? 'Refresh current location' : 'Enable current location'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Home city</Text>
            <Text style={styles.cardHint}>Used when current location is off or unavailable.</Text>
          </View>
          <LocationAutocompleteInput
            value={home}
            onChangeText={setHome}
            onSelect={setHome}
            placeholder="Search a city or region"
          />
          <TouchableOpacity
            style={[styles.primaryButton, updateProfile.isPending && styles.buttonDisabled]}
            onPress={saveHome}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={styles.primaryButtonText}>Save Home city</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  headerCopy: { flex: 1, gap: 3 },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.foreground },
  subtitle: { fontSize: typography.size.sm, lineHeight: 19, color: colors.mutedForeground },
  closeButton: {
    width: 36, height: 36, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  card: {
    gap: spacing.md, padding: spacing.md, borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated, ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionIcon: {
    width: 38, height: 38, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.primary}15`,
  },
  cardCopy: { flex: 1, gap: 2 },
  cardLabel: { fontSize: 10, color: colors.primary, fontWeight: typography.weight.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  cardValue: { fontSize: typography.size.md, color: colors.foreground, fontWeight: typography.weight.semibold },
  cardHint: { fontSize: typography.size.xs, lineHeight: 17, color: colors.mutedForeground },
  sectionHeading: { gap: 2 },
  sectionTitle: { fontSize: typography.size.md, color: colors.foreground, fontWeight: typography.weight.semibold },
  secondaryButton: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.border,
  },
  secondaryButtonText: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.semibold },
  primaryButton: {
    minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, backgroundColor: colors.primary,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { fontSize: typography.size.sm, color: colors.primaryForeground, fontWeight: typography.weight.semibold },
});
