import { useState, useEffect } from 'react';
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreateEvent, useUpdateEvent, type EventInput } from '../../hooks/useEvents';
import { LocationAutocompleteInput } from '../primitives/LocationAutocompleteInput';
import { CalendarPickerSheet } from './CalendarPickerSheet';
import { OCCASIONS, ENVS, formatTime } from './calendarUtils';
import { colors, spacing, typography, radii } from '../../theme';
import type { Event } from '../../types/event';

export function EventFormModal({
  visible,
  event,
  onClose,
}: {
  visible: boolean;
  event: Event | null;
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

  useEffect(() => {
    if (!visible) return;
    if (event) {
      setTitle(event.title);
      setFormDate(new Date(event.date));
      setOccasion(event.occasion);
      setEnv(event.environment ?? '');
      setLocation(event.location ?? '');
      setNotes(event.notes ?? '');
    } else {
      const d = new Date(); d.setHours(9, 0, 0, 0);
      setTitle('');
      setFormDate(d);
      setOccasion('casual');
      setEnv('');
      setLocation('');
      setNotes('');
    }
  }, [visible, event]);

  const isPending = createEvent.isPending || updateEvent.isPending;

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an event name.');
      return;
    }
    const input: EventInput = {
      title: title.trim(),
      date: formDate,
      occasion,
      location: location.trim() || null,
      notes: notes.trim() || null,
      environment: environment || null,
    };
    if (event) {
      updateEvent.mutate({ id: event.id, ...input }, { onSuccess: onClose });
    } else {
      createEvent.mutate(input, { onSuccess: onClose });
    }
  };

  const applyDate = (d: Date) => {
    const next = new Date(formDate);
    next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setFormDate(next);
    setShowDate(false);
  };

  const applyTime = (d: Date) => {
    const next = new Date(formDate);
    next.setHours(d.getHours(), d.getMinutes());
    setFormDate(next);
    setShowTime(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={s.root}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.headerSide}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>{event ? 'Edit Event' : 'New Event'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={isPending} style={[s.headerSide, { alignItems: 'flex-end' }]}>
              {isPending
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={s.saveText}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={s.field}>
              <Text style={s.label}>Event Name</Text>
              <TextInput
                style={s.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Sarah's Wedding, Team Standup"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
              />
            </View>

            <View style={s.row}>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Date</Text>
                <TouchableOpacity style={s.selectRow} onPress={() => setShowDate(true)}>
                  <Text style={s.selectText}>
                    {formDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={{ width: spacing.md }} />
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Time</Text>
                <TouchableOpacity style={s.selectRow} onPress={() => setShowTime(true)}>
                  <Text style={s.selectText}>{formatTime(formDate)}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>Occasion Type</Text>
              <View style={s.occasionGrid}>
                {OCCASIONS.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={[s.occasionChip, occasion === o.id && s.occasionChipActive]}
                    onPress={() => setOccasion(o.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={o.icon}
                      size={14}
                      color={occasion === o.id ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[s.occasionLabel, occasion === o.id && s.occasionLabelActive]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>Venue Type (Optional)</Text>
              <View style={s.envRow}>
                {ENVS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.envChip, environment === opt && s.envChipActive]}
                    onPress={() => setEnv(environment === opt ? '' : opt)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.envLabel, environment === opt && s.envLabelActive]}>{opt}</Text>
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
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Notes (Optional)</Text>
              <TextInput
                style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: spacing.sm + 2 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Dress code, vibe, anything to keep in mind…"
                placeholderTextColor={colors.mutedForeground}
                multiline
              />
            </View>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSide: { minWidth: 60 },
  headerTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  cancelText: { fontSize: typography.size.md, color: colors.mutedForeground },
  saveText: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.primary, textAlign: 'right' },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md,
    color: colors.foreground,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  selectText: { fontSize: typography.size.sm, color: colors.foreground },
  occasionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  occasionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  occasionChipActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
  occasionLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  occasionLabelActive: { color: colors.primary },
  envRow: { flexDirection: 'row', gap: spacing.sm },
  envChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  envChipActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
  envLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  envLabelActive: { color: colors.primary },
});
