import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { track } from '../../lib/analytics';
import { useCreateEvent, useUpdateEvent, type EventInput } from '../../hooks/useEvents';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';
import { CalendarPickerSheet } from './CalendarPickerSheet';
import { OCCASIONS, ENVS, formatTime } from './calendarUtils';
import { colors, spacing, typography, radii } from '../../theme';
import type { Event } from '../../types/event';

export function EventFormModal({
  visible,
  event,
  initialDate,
  onClose,
}: {
  visible: boolean;
  event: Event | null;
  initialDate?: Date | null;
  onClose: () => void;
}) {
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const [title, setTitle] = useState('');
  const [formDate, setFormDate] = useState(new Date());
  const [occasion, setOccasion] = useState('casual');
  const [environment, setEnv] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showStylingDetails, setShowStylingDetails] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const initialValueRef = useRef('');

  const serializeForm = (
    nextTitle = title,
    nextDate = formDate,
    nextOccasion = occasion,
    nextLocation = location,
    nextEnvironment = environment,
    nextNotes = notes,
  ) => JSON.stringify({
    title: nextTitle,
    date: nextDate.toISOString(),
    occasion: nextOccasion,
    location: nextLocation,
    environment: nextEnvironment,
    notes: nextNotes,
  });

  useEffect(() => {
    if (!visible) return;
    if (event) {
      const nextDate = new Date(event.date);
      const nextEnvironment = event.environment ?? '';
      const nextLocation = event.location ?? '';
      const nextNotes = event.notes ?? '';
      setTitle(event.title);
      setFormDate(nextDate);
      setOccasion(event.occasion);
      setEnv(nextEnvironment);
      setLocation(nextLocation);
      setNotes(nextNotes);
      setShowStylingDetails(Boolean(nextEnvironment || nextNotes));
      initialValueRef.current = serializeForm(
        event.title,
        nextDate,
        event.occasion,
        nextLocation,
        nextEnvironment,
        nextNotes,
      );
    } else {
      const d = initialDate ? new Date(initialDate) : new Date();
      d.setHours(9, 0, 0, 0);
      setTitle('');
      setFormDate(d);
      setOccasion('casual');
      setEnv('');
      setLocation('');
      setNotes('');
      setShowStylingDetails(false);
      initialValueRef.current = serializeForm('', d, 'casual', '', '', '');
    }
    setFormError(null);
  }, [visible, event, initialDate]);

  const isPending = createEvent.isPending || updateEvent.isPending;
  const isValid = title.trim().length > 0;
  const isDirty = visible && serializeForm() !== initialValueRef.current;

  const requestClose = () => {
    if (isPending) return;
    if (!isDirty) {
      onClose();
      return;
    }
    Alert.alert(
      'Discard changes?',
      'Your event edits have not been saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ],
    );
  };

  const handleSave = () => {
    if (!title.trim()) {
      setFormError('Add an event name to continue.');
      return;
    }
    setFormError(null);
    const input: EventInput = {
      title: title.trim(),
      date: formDate,
      occasion,
      location: location.trim() || null,
      notes: notes.trim() || null,
      environment: environment || null,
    };
    if (event) {
      updateEvent.mutate(
        { id: event.id, ...input },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            onClose();
          },
          onError: () => setFormError("We couldn't save these changes. Please try again."),
        },
      );
    } else {
      createEvent.mutate(input, {
        onSuccess: () => {
          track('calendar_event_created', { occasion: input.occasion });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onClose();
        },
        onError: () => setFormError("We couldn't create this event. Please try again."),
      });
    }
  };

  const applyDate = (d: Date) => {
    const next = new Date(formDate);
    next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setFormDate(next);
    setShowDate(false);
    Haptics.selectionAsync().catch(() => {});
  };

  const applyTime = (d: Date) => {
    const next = new Date(formDate);
    next.setHours(d.getHours(), d.getMinutes());
    setFormDate(next);
    setShowTime(false);
    Haptics.selectionAsync().catch(() => {});
  };

  const selectOccasion = (value: string) => {
    setOccasion(value);
    Haptics.selectionAsync().catch(() => {});
  };

  const selectEnvironment = (value: string) => {
    setEnv(environment === value ? '' : value);
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={requestClose}>
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={s.root}>
          <View style={s.header}>
            <TouchableOpacity onPress={requestClose} style={s.headerSide} accessibilityRole="button" accessibilityLabel="Cancel event editing">
              <Text style={s.cancelText} numberOfLines={1}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>{event ? 'Edit Event' : 'New Event'}</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isPending || !isValid}
              style={[s.headerSide, { alignItems: 'flex-end' }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: isPending || !isValid }}
            >
              {isPending
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={[s.saveText, !isValid && s.saveTextDisabled]}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.field}>
              <Text style={s.label}>Event Name</Text>
              <TextInput
                style={[s.input, formError && s.inputError]}
                value={title}
                onChangeText={(value) => {
                  setTitle(value);
                  if (formError) setFormError(null);
                }}
                placeholder="e.g. Sarah's Wedding, Team Standup"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
                autoFocus
                accessibilityLabel="Event name"
              />
              {formError ? <Text style={s.errorText}>{formError}</Text> : null}
            </View>

            <View style={s.row}>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Date</Text>
                {process.env.EXPO_OS === 'ios' ? (
                  <View style={s.nativePickerRow}>
                    <DateTimePicker
                      value={formDate}
                      mode="date"
                      display="compact"
                      onValueChange={(_, value) => { if (value) applyDate(value); }}
                      accentColor={colors.primary}
                      style={s.compactPicker}
                    />
                  </View>
                ) : (
                  <TouchableOpacity style={s.selectRow} onPress={() => setShowDate(true)}>
                    <Text style={s.selectText}>
                      {formDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ width: spacing.md }} />
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Time</Text>
                {process.env.EXPO_OS === 'ios' ? (
                  <View style={s.nativePickerRow}>
                    <DateTimePicker
                      value={formDate}
                      mode="time"
                      display="compact"
                      minuteInterval={5}
                      onValueChange={(_, value) => { if (value) applyTime(value); }}
                      accentColor={colors.primary}
                      style={s.compactPicker}
                    />
                  </View>
                ) : (
                  <TouchableOpacity style={s.selectRow} onPress={() => setShowTime(true)}>
                    <Text style={s.selectText}>{formatTime(formDate)}</Text>
                    <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>Occasion Type</Text>
              <View style={s.occasionGrid}>
                {OCCASIONS.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={[s.occasionChip, occasion === o.id && s.occasionChipActive]}
                    onPress={() => selectOccasion(o.id)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: occasion === o.id }}
                  >
                    <Ionicons
                      name={o.icon}
                      size={14}
                      color={occasion === o.id ? colors.primaryForeground : colors.mutedForeground}
                    />
                    <Text style={[s.occasionLabel, occasion === o.id && s.occasionLabelActive]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[s.field, { zIndex: 10 }]}>
              <Text style={s.label}>Location (Optional)</Text>
              <LocationAutocompleteInput
                value={location}
                onChangeText={setLocation}
                onSelect={setLocation}
                placeholder="e.g. Downtown Seattle"
                dropdownPlacement="inline"
              />
            </View>

            <TouchableOpacity
              style={s.detailsToggle}
              onPress={() => setShowStylingDetails((current) => !current)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ expanded: showStylingDetails }}
            >
              <View style={s.detailsToggleIcon}>
                <Ionicons name="options-outline" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.detailsToggleTitle}>Styling details</Text>
                <Text style={s.detailsToggleText}>Venue type and notes for a more considered look</Text>
              </View>
              <Ionicons name={showStylingDetails ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {showStylingDetails ? (
              <Animated.View
                style={s.detailsFields}
                entering={FadeInDown.duration(180)}
                exiting={FadeOutUp.duration(140)}
              >
                <View style={s.field}>
                  <Text style={s.label}>Venue Type</Text>
                  <View style={s.envRow}>
                    {ENVS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[s.envChip, environment === opt && s.envChipActive]}
                        onPress={() => selectEnvironment(opt)}
                        activeOpacity={0.7}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: environment === opt }}
                      >
                        <Text style={[s.envLabel, environment === opt && s.envLabelActive]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Notes</Text>
                  <TextInput
                    style={[s.input, s.notesInput]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Dress code, mood, or anything to keep in mind…"
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    accessibilityLabel="Styling notes"
                  />
                </View>
              </Animated.View>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <CalendarPickerSheet visible={showDate} value={formDate} mode="date" onConfirm={applyDate} onCancel={() => setShowDate(false)} />
      <CalendarPickerSheet visible={showTime} value={formDate} mode="time" onConfirm={applyTime} onCancel={() => setShowTime(false)} />
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerSide: { minWidth: 60 },
  headerTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  cancelText: { fontSize: typography.size.md, color: colors.mutedForeground },
  saveText: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.primary, textAlign: 'right' },
  saveTextDisabled: { color: colors.mutedForeground, opacity: 0.55 },
  scrollContent: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row' },
  field: { gap: 6 },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 48,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md,
    color: colors.foreground,
  },
  inputError: { borderColor: colors.error },
  errorText: { fontSize: typography.size.xs, color: colors.error, lineHeight: 17 },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    borderCurve: 'continuous',
  },
  selectText: { fontSize: typography.size.sm, color: colors.foreground },
  nativePickerRow: {
    minHeight: 48,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  compactPicker: { alignSelf: 'stretch' },
  occasionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  occasionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    minHeight: 42,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderCurve: 'continuous',
  },
  occasionChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  occasionLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  occasionLabelActive: { color: colors.primaryForeground, fontWeight: typography.weight.semibold },
  detailsToggle: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  detailsToggleIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center', justifyContent: 'center',
  },
  detailsToggleTitle: { fontSize: typography.size.sm, color: colors.foreground, fontWeight: typography.weight.semibold },
  detailsToggleText: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  detailsFields: { gap: spacing.xl },
  envRow: { flexDirection: 'row', gap: spacing.sm },
  envChip: {
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  envChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  envLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  envLabelActive: { color: colors.primaryForeground, fontWeight: typography.weight.semibold },
  notesInput: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },
});
