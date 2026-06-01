import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState, useMemo, useEffect, useRef } from 'react';
import type { ScrollView as ScrollViewType } from 'react-native';
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useAssignEventItems,
  type EventInput,
} from '../../hooks/useEvents';
import { useGenerateOutfit, type GenerateOutfitResult } from '../../hooks/useOutfits';
import { useItems } from '../../hooks/useItems';
import { useWeatherForecast, type ForecastWeather, type WeatherCondition } from '../../hooks/useWeather';
import { CATEGORY_ORDER, CATEGORY_LABELS, type Item } from '../../types/item';
import { LocationAutocompleteInput } from '../../components/primitives/LocationAutocompleteInput';
import { CalendarSyncSheet } from '../../components/calendar/CalendarSyncSheet';
import * as Location from 'expo-location';
import { colors, spacing, typography, radii } from '../../theme';
import type { CalendarScreenProps } from '../../navigation/types';
import type { Event } from '../../types/event';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCountdown(d: Date): string | null {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff <= 1) return null;
  if (diff < 7) return `in ${diff} days`;
  if (diff < 14) return 'in 1 week';
  const weeks = Math.round(diff / 7);
  if (weeks < 5) return `in ${weeks} week${weeks !== 1 ? 's' : ''}`;
  const months = Math.round(diff / 30);
  return `in ${months} month${months !== 1 ? 's' : ''}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function groupByDate(evs: Event[]): [string, Event[]][] {
  const map = new Map<string, Event[]>();
  for (const ev of evs) {
    const key = toDateStr(new Date(ev.date));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return Array.from(map.entries());
}

// ── Occasions ─────────────────────────────────────────────────────────────────

const OCCASIONS = [
  { id: 'casual',       label: 'Casual',       icon: 'cafe-outline' as const },
  { id: 'smart_casual', label: 'Smart Casual',  icon: 'shirt-outline' as const },
  { id: 'business',     label: 'Professional',  icon: 'briefcase-outline' as const },
  { id: 'formal',       label: 'Formal',        icon: 'star-outline' as const },
  { id: 'party',        label: 'Night Out',     icon: 'musical-notes-outline' as const },
  { id: 'workout',      label: 'Active',        icon: 'bicycle-outline' as const },
];

const OCCASION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  casual:       'cafe-outline',
  smart_casual: 'shirt-outline',
  business:     'briefcase-outline',
  formal:       'star-outline',
  party:        'musical-notes-outline',
  workout:      'bicycle-outline',
};

const ENVS = ['Indoor', 'Outdoor', 'Mixed'] as const;

// ── PickerSheet ───────────────────────────────────────────────────────────────

function PickerSheet({
  visible,
  value,
  mode,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  value: Date;
  mode: 'date' | 'time';
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { if (visible) setLocal(value); }, [visible, value]);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <View style={ps.overlay}>
        <TouchableOpacity style={ps.backdrop} onPress={onCancel} activeOpacity={1} />
        <View style={ps.sheet}>
          <View style={ps.toolbar}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={ps.cancelBtn}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onConfirm(local)}>
              <Text style={ps.doneBtn}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={local}
            mode={mode}
            display="spinner"
            onChange={(_, d) => { if (d) setLocal(d); }}
            style={{ height: 200 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const ps = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: 32,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: { fontSize: typography.size.md, color: colors.mutedForeground },
  doneBtn: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.primary },
});

// ── ItemThumbStack ────────────────────────────────────────────────────────────

function ItemThumbStack({ itemIds, allItems, onPress }: { itemIds: number[]; allItems: Item[]; onPress: () => void }) {
  const visible = itemIds
    .map((id) => allItems.find((i) => i.id === id))
    .filter(Boolean)
    .slice(0, 3) as Item[];
  const overflow = itemIds.length - 3;
  if (visible.length === 0) return null;
  return (
    <TouchableOpacity style={its.row} onPress={onPress} activeOpacity={0.7}>
      <View style={its.stack}>
        {visible.map((item, idx) => (
          <View key={item.id} style={[its.thumb, { marginLeft: idx === 0 ? 0 : -8, zIndex: visible.length - idx }]}>
            {item.imageUrl
              ? <Image source={{ uri: item.imageUrl }} style={its.thumbImg} />
              : <View style={its.thumbFallback}><Text style={its.thumbInitials}>{item.name.slice(0, 2).toUpperCase()}</Text></View>
            }
          </View>
        ))}
      </View>
      {overflow > 0 && <Text style={its.overflow}>+{overflow}</Text>}
    </TouchableOpacity>
  );
}

const its = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stack: { flexDirection: 'row' },
  thumb: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: colors.card,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbFallback: {
    width: '100%', height: '100%',
    backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  thumbInitials: { fontSize: 8, fontWeight: typography.weight.bold, color: colors.mutedForeground },
  overflow: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },
});

// ── EventItemPickerModal ──────────────────────────────────────────────────────

function EventItemPickerModal({
  event,
  visible,
  onClose,
}: {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { data: allItems = [], isLoading } = useItems();
  const assignItems = useAssignEventItems();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');

  useEffect(() => {
    if (visible && event) {
      setSelected(new Set(event.itemIds ?? []));
      setQuery('');
      setCatFilter('all');
    }
  }, [visible, event]);

  const filtered = allItems.filter((item) => {
    const matchesCat = catFilter === 'all' || item.category === catFilter;
    const matchesQ = !query.trim() || item.name.toLowerCase().includes(query.toLowerCase()) || (item.brand ?? '').toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQ;
  });

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (!event) return;
    const itemIds = selected.size > 0 ? Array.from(selected) : null;
    assignItems.mutate({ id: event.id, itemIds }, { onSuccess: onClose });
  };

  const catFilters = [{ id: 'all', label: 'All' }, ...CATEGORY_ORDER.map((c) => ({ id: c, label: CATEGORY_LABELS[c] }))];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={ipm.root}>
          {/* Header */}
          <View style={ipm.header}>
            <TouchableOpacity onPress={onClose} style={ipm.headerSide}>
              <Text style={ipm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={ipm.headerTitle}>Assign Outfit</Text>
            <TouchableOpacity onPress={handleConfirm} disabled={assignItems.isPending} style={[ipm.headerSide, { alignItems: 'flex-end' }]}>
              {assignItems.isPending
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={ipm.saveText}>Save{selected.size > 0 ? ` (${selected.size})` : ''}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={ipm.searchRow}>
            <TextInput
              style={ipm.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search items…"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Category filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ipm.catRow}>
            {catFilters.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[ipm.catChip, catFilter === f.id && ipm.catChipActive]}
                onPress={() => setCatFilter(f.id)}
                activeOpacity={0.7}
              >
                <Text style={[ipm.catLabel, catFilter === f.id && ipm.catLabelActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Item list */}
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
          ) : filtered.length === 0 ? (
            <View style={ipm.empty}>
              <Text style={ipm.emptyText}>{query ? 'No items match your search.' : 'No items in this category.'}</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={ipm.listContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selected.has(item.id);
                return (
                  <TouchableOpacity
                    style={[ipm.itemRow, isSelected && ipm.itemRowSelected]}
                    onPress={() => toggle(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={ipm.itemThumb}>
                      {item.imageUrl
                        ? <Image source={{ uri: item.imageUrl }} style={ipm.itemThumbImg} />
                        : <View style={ipm.itemThumbFallback}><Text style={ipm.itemThumbInitials}>{item.name.slice(0, 2).toUpperCase()}</Text></View>
                      }
                    </View>
                    <View style={ipm.itemInfo}>
                      <Text style={ipm.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={ipm.itemMeta} numberOfLines={1}>
                        {[item.brand, item.category ? CATEGORY_LABELS[item.category] : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={[ipm.checkbox, isSelected && ipm.checkboxSelected]}>
                      {isSelected && <Text style={ipm.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Clear button */}
          {selected.size > 0 && (
            <TouchableOpacity style={ipm.clearBtn} onPress={() => setSelected(new Set())}>
              <Text style={ipm.clearBtnText}>Clear selection</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ipm = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerSide: { minWidth: 70 },
  headerTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  cancelText: { fontSize: typography.size.md, color: colors.mutedForeground },
  saveText: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.primary, textAlign: 'right' },
  searchRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  searchInput: {
    height: 40, backgroundColor: colors.muted, borderRadius: radii.md,
    paddingHorizontal: spacing.md, fontSize: typography.size.sm, color: colors.foreground,
  },
  catRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  catChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  catChipActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}15` },
  catLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  catLabelActive: { color: colors.primary },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemRowSelected: { backgroundColor: `${colors.primary}08` },
  itemThumb: {
    width: 48, height: 48, borderRadius: radii.md, overflow: 'hidden',
    backgroundColor: colors.muted, flexShrink: 0,
  },
  itemThumbImg: { width: '100%', height: '100%' },
  itemThumbFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  itemThumbInitials: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.mutedForeground },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.foreground },
  itemMeta: { fontSize: typography.size.xs, color: colors.mutedForeground },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { color: colors.white, fontSize: 13, fontWeight: typography.weight.bold },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  emptyText: { fontSize: typography.size.sm, color: colors.mutedForeground, textAlign: 'center' },
  clearBtn: {
    margin: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  clearBtnText: { fontSize: typography.size.sm, color: colors.mutedForeground },
});

// ── EventFormModal ────────────────────────────────────────────────────────────

function EventFormModal({
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

  const [title, setTitle]       = useState('');
  const [formDate, setFormDate] = useState(new Date());
  const [occasion, setOccasion] = useState('casual');
  const [environment, setEnv]   = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes]       = useState('');
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
        <View style={fm.root}>
          {/* Header */}
          <View style={fm.header}>
            <TouchableOpacity onPress={onClose} style={fm.headerSide}>
              <Text style={fm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={fm.headerTitle}>{event ? 'Edit Event' : 'New Event'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={isPending} style={[fm.headerSide, { alignItems: 'flex-end' }]}>
              {isPending
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={fm.saveText}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={fm.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Title */}
            <View style={fm.field}>
              <Text style={fm.label}>Event Name</Text>
              <TextInput
                style={fm.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Sarah's Wedding, Team Standup"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
              />
            </View>

            {/* Date + Time */}
            <View style={fm.row}>
              <View style={[fm.field, { flex: 1 }]}>
                <Text style={fm.label}>Date</Text>
                <TouchableOpacity style={fm.selectRow} onPress={() => setShowDate(true)}>
                  <Text style={fm.selectText}>
                    {formDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={{ width: spacing.md }} />
              <View style={[fm.field, { flex: 1 }]}>
                <Text style={fm.label}>Time</Text>
                <TouchableOpacity style={fm.selectRow} onPress={() => setShowTime(true)}>
                  <Text style={fm.selectText}>{formatTime(formDate)}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Occasion */}
            <View style={fm.field}>
              <Text style={fm.label}>Occasion Type</Text>
              <View style={fm.occasionGrid}>
                {OCCASIONS.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={[fm.occasionChip, occasion === o.id && fm.occasionChipActive]}
                    onPress={() => setOccasion(o.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={o.icon}
                      size={14}
                      color={occasion === o.id ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[fm.occasionLabel, occasion === o.id && fm.occasionLabelActive]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Venue type */}
            <View style={fm.field}>
              <Text style={fm.label}>Venue Type (Optional)</Text>
              <View style={fm.envRow}>
                {ENVS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[fm.envChip, environment === opt && fm.envChipActive]}
                    onPress={() => setEnv(environment === opt ? '' : opt)}
                    activeOpacity={0.7}
                  >
                    <Text style={[fm.envLabel, environment === opt && fm.envLabelActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Location */}
            <View style={[fm.field, { zIndex: 10 }]}>
              <Text style={fm.label}>Location (Optional)</Text>
              <LocationAutocompleteInput
                value={location}
                onChangeText={setLocation}
                onSelect={setLocation}
                placeholder="e.g. Downtown Seattle"
              />
            </View>

            {/* Notes */}
            <View style={fm.field}>
              <Text style={fm.label}>Notes (Optional)</Text>
              <TextInput
                style={[fm.input, { height: 80, textAlignVertical: 'top', paddingTop: spacing.sm + 2 }]}
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

      <PickerSheet visible={showDate} value={formDate} mode="date" onConfirm={applyDate} onCancel={() => setShowDate(false)} />
      <PickerSheet visible={showTime} value={formDate} mode="time" onConfirm={applyTime} onCancel={() => setShowTime(false)} />
    </Modal>
  );
}

const fm = StyleSheet.create({
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

// ── EventDetailModal ──────────────────────────────────────────────────────────

const WEATHER_ICONS: Record<WeatherCondition, keyof typeof Ionicons.glyphMap> = {
  sunny: 'sunny-outline',
  rainy: 'rainy-outline',
  cold: 'snow-outline',
  mild: 'partly-sunny-outline',
};

function EventDetailModal({
  event,
  visible,
  onClose,
  onEdit,
  onDelete,
  onAssign,
  allItems,
  generateOutfit,
  onViewOutfits,
  deviceCoords,
}: {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (ev: Event) => void;
  onDelete: (ev: Event) => void;
  onAssign: (ev: Event) => void;
  allItems: Item[];
  generateOutfit: ReturnType<typeof useGenerateOutfit>;
  onViewOutfits: () => void;
  deviceCoords: { lat: number; lon: number } | null;
}) {
  const eventDateStr = event ? event.date.slice(0, 10) : null;
  const forecast = useWeatherForecast(
    deviceCoords?.lat ?? null,
    deviceCoords?.lon ?? null,
    eventDateStr,
  );

  if (!event) return null;
  const d = new Date(event.date);
  const countdown = formatCountdown(d);
  const occasionMeta = OCCASIONS.find((o) => o.id === event.occasion);
  const iconName = (OCCASION_ICONS[event.occasion] ?? 'calendar-outline') as keyof typeof Ionicons.glyphMap;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={dm.root}>
        <View style={dm.header}>
          <TouchableOpacity onPress={onClose} style={dm.circleBtn}>
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onEdit(event)} style={dm.circleBtn}>
            <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={dm.content}>
          <Text style={dm.title}>{event.title}</Text>

          <View style={dm.metaRow}>
            <Ionicons name="calendar-outline" size={15} color={colors.mutedForeground} />
            <Text style={dm.metaText}>{formatDayLabel(d)} · {formatTime(d)}</Text>
            {countdown && (
              <View style={dm.countdownBadge}>
                <Text style={dm.countdownText}>{countdown}</Text>
              </View>
            )}
            {forecast.data && (
              <View style={dm.forecastChip}>
                <Ionicons name={WEATHER_ICONS[forecast.data.condition]} size={12} color={colors.mutedForeground} />
                <Text style={dm.forecastText}>
                  {forecast.data.tempMinF}–{forecast.data.tempMaxF}°F
                </Text>
              </View>
            )}
          </View>

          <View style={dm.metaRow}>
            <Ionicons name={iconName} size={15} color={colors.mutedForeground} />
            <Text style={dm.metaText}>{occasionMeta?.label ?? event.occasion}</Text>
          </View>

          {event.location ? (
            <View style={dm.metaRow}>
              <Ionicons name="location-outline" size={15} color={colors.mutedForeground} />
              <Text style={dm.metaText}>{event.location}</Text>
            </View>
          ) : null}

          {event.environment ? (
            <View style={dm.metaRow}>
              <Ionicons name="home-outline" size={15} color={colors.mutedForeground} />
              <Text style={dm.metaText}>{event.environment}</Text>
            </View>
          ) : null}

          {event.notes?.trim() ? (
            <View style={dm.notesCard}>
              <Ionicons name="document-text-outline" size={15} color={colors.mutedForeground} />
              <Text style={dm.notesText}>{event.notes}</Text>
            </View>
          ) : null}

          {(event.itemIds ?? []).length > 0 ? (
            <View style={dm.outfitCard}>
              <Text style={dm.outfitLabel}>Outfit</Text>
              <View style={dm.outfitRow}>
                <ItemThumbStack itemIds={event.itemIds!} allItems={allItems} onPress={() => onAssign(event)} />
                <TouchableOpacity onPress={() => onAssign(event)} style={dm.changeOutfitBtn}>
                  <Text style={dm.changeOutfitText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={dm.actions}>
          <TouchableOpacity
            style={[dm.generateBtn, generateOutfit.isPending && dm.generateBtnDisabled]}
            onPress={() => {
              generateOutfit.mutate({ eventId: event.id }, {
                onSuccess: (result: GenerateOutfitResult) => {
                  Alert.alert(
                    'Outfit Generated',
                    `"${result.outfitName}"${result.stylistNotes ? `\n\n${result.stylistNotes}` : ''}`,
                    [
                      { text: 'View in Outfits', onPress: () => { onClose(); onViewOutfits(); } },
                      { text: 'Done', style: 'cancel' },
                    ]
                  );
                },
                onError: (err: any) => {
                  const msg = err?.response?.data?.message ?? 'Could not generate an outfit. Please try again.';
                  Alert.alert('Generation Failed', msg);
                },
              });
            }}
            disabled={generateOutfit.isPending}
            activeOpacity={0.85}
          >
            {generateOutfit.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="sparkles-outline" size={18} color={colors.white} />
            )}
            <Text style={dm.generateBtnText}>
              {generateOutfit.isPending ? 'Generating…' : 'Generate Outfit with AI'}
            </Text>
          </TouchableOpacity>
          <View style={dm.actionRow}>
            <TouchableOpacity style={dm.deleteBtn} onPress={() => onDelete(event)} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={dm.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dm.assignBtn} onPress={() => onAssign(event)} activeOpacity={0.8}>
              <Ionicons name="shirt-outline" size={18} color={colors.foreground} />
              <Text style={dm.assignBtnText}>{(event.itemIds ?? []).length > 0 ? 'Edit Outfit' : 'Assign Outfit'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dm.editBtnFull} onPress={() => onEdit(event)} activeOpacity={0.8}>
              <Ionicons name="pencil-outline" size={18} color={colors.foreground} />
              <Text style={dm.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dm = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  circleBtn: {
    width: 36, height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { fontSize: typography.size.sm, color: colors.mutedForeground, flex: 1 },
  countdownBadge: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countdownText: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },
  forecastChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.muted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  forecastText: { fontSize: 11, color: colors.mutedForeground },
  notesCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  notesText: { fontSize: typography.size.sm, color: colors.foreground, flex: 1, lineHeight: typography.size.sm * 1.5 },
  actions: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  generateBtnDisabled: { opacity: 0.7 },
  generateBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
  },
  deleteBtnText: { fontSize: typography.size.sm, color: colors.error, fontWeight: typography.weight.medium },
  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  assignBtnText: { fontSize: typography.size.sm, color: colors.foreground, fontWeight: typography.weight.medium },
  editBtnFull: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  editBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  outfitCard: {
    backgroundColor: colors.muted, borderRadius: radii.md, padding: spacing.md,
    marginTop: spacing.xs, gap: spacing.sm,
  },
  outfitLabel: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
    color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  outfitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  changeOutfitBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  changeOutfitText: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },
});

// ── WeekStrip ─────────────────────────────────────────────────────────────────

function WeekStrip({
  weekDays,
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onToday,
  eventDateSet,
  weekOffset,
}: {
  weekDays: Date[];
  selectedDate: string;
  onSelectDate: (s: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  eventDateSet: Set<string>;
  weekOffset: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef<ScrollViewType>(null);
  const todayStr = toDateStr(new Date());

  const first = weekDays[0];
  const last  = weekDays[6];
  const weekLabel =
    first.getMonth() === last.getMonth()
      ? first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : `${first.toLocaleDateString('en-US', { month: 'short' })} – ${last.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

  // Displayed month in expanded view (base month + swipe offset)
  const baseYear  = first.getFullYear();
  const baseMonth = first.getMonth();
  const displayRef  = new Date(baseYear, baseMonth + monthOffset, 1);
  const displayYear  = displayRef.getFullYear();
  const displayMonth = displayRef.getMonth();
  const displayMonthLabel = displayRef.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Build row arrays for a given year+month
  const buildRows = (year: number, month: number): (Date | null)[][] => {
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    const startPad = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  };

  // Prev / current / next month grids for the 3-page pager
  const [prevRows, currRows, nextRows] = useMemo(() => {
    const prevD = new Date(displayYear, displayMonth - 1, 1);
    const nextD = new Date(displayYear, displayMonth + 1, 1);
    return [
      buildRows(prevD.getFullYear(), prevD.getMonth()),
      buildRows(displayYear, displayMonth),
      buildRows(nextD.getFullYear(), nextD.getMonth()),
    ];
  }, [displayYear, displayMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // After monthOffset or containerWidth change, re-centre the pager to page 1
  useEffect(() => {
    if (expanded && containerWidth > 0) {
      scrollRef.current?.scrollTo({ x: containerWidth, animated: false });
    }
  }, [monthOffset, containerWidth, expanded]);

  // Reset offset when collapsing
  const handleToggle = () => {
    if (expanded) setMonthOffset(0);
    setExpanded((v) => !v);
  };

  // Detect which page landed after a swipe
  const handleScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (containerWidth === 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
    if (page === 0) setMonthOffset((o) => o - 1);
    else if (page === 2) setMonthOffset((o) => o + 1);
  };

  // Reusable day cell
  const renderDay = (d: Date, compact: boolean) => {
    const str      = toDateStr(d);
    const isSel    = str === selectedDate;
    const isToday  = str === todayStr;
    const hasEvent = eventDateSet.has(str);
    return (
      <TouchableOpacity
        key={str}
        style={[
          compact ? ws.compactBtn : ws.dayBtn,
          isSel && ws.dayBtnSel,
          !isSel && isToday && ws.dayBtnToday,
        ]}
        onPress={() => onSelectDate(str)}
        activeOpacity={0.7}
      >
        {!compact && (
          <Text style={[ws.dayAbbrev, isSel && ws.dayTextSel, !isSel && isToday && ws.dayTextToday]}>
            {d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)}
          </Text>
        )}
        <Text style={[compact ? ws.compactNum : ws.dayNum, isSel && ws.dayTextSel, !isSel && isToday && ws.dayTextToday]}>
          {d.getDate()}
        </Text>
        <View style={[ws.dot, hasEvent && (isSel ? ws.dotSel : ws.dotVis)]} />
      </TouchableOpacity>
    );
  };

  // Render one page of the month pager
  const renderGrid = (rows: (Date | null)[][]) => (
    <View style={{ width: containerWidth }}>
      {rows.map((row, ri) => (
        <View key={ri} style={ws.monthRow}>
          {row.map((d, ci) => (
            <View key={ci} style={ws.monthCell}>
              {d ? renderDay(d, true) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={ws.root}>
      {/* Header: month/week label + nav buttons */}
      <View style={ws.header}>
        <Text style={ws.monthLabel}>{expanded ? displayMonthLabel : weekLabel}</Text>
        <View style={ws.navRow}>
          {weekOffset !== 0 && !expanded && (
            <TouchableOpacity onPress={onToday} style={ws.todayBtn}>
              <Text style={ws.todayText}>Today</Text>
            </TouchableOpacity>
          )}
          {!expanded && (
            <>
              <TouchableOpacity onPress={onPrevWeek} style={ws.navBtn}>
                <Ionicons name="chevron-back" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onNextWeek} style={ws.navBtn}>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
          {expanded && (
            <>
              <TouchableOpacity onPress={() => setMonthOffset((o) => o - 1)} style={ws.navBtn}>
                <Ionicons name="chevron-back" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMonthOffset((o) => o + 1)} style={ws.navBtn}>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={handleToggle} style={ws.navBtn}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsed: 7-day week row */}
      {!expanded && (
        <View style={ws.days}>
          {weekDays.map((d) => renderDay(d, false))}
        </View>
      )}

      {/* Expanded: swipeable month pager */}
      {expanded && (
        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
          {/* Day-of-week column headers */}
          <View style={ws.colHeaders}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((h) => (
              <Text key={h} style={ws.colHeader}>{h}</Text>
            ))}
          </View>
          {/* 3-page horizontal pager (prev / current / next month) */}
          {containerWidth > 0 && (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleScrollEnd}
              // Prevent the outer vertical ScrollView from stealing the gesture
              directionalLockEnabled
            >
              {renderGrid(prevRows)}
              {renderGrid(currRows)}
              {renderGrid(nextRows)}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const ws = StyleSheet.create({
  root: { marginBottom: spacing.lg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthLabel: {
    fontSize: typography.size.xs, fontWeight: typography.weight.semibold,
    color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  todayBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radii.sm, backgroundColor: `${colors.primary}15`,
  },
  todayText: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },
  navBtn: {
    width: 28, height: 28, borderRadius: radii.md, backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  dayBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.md, gap: 2 },
  dayBtnSel: { backgroundColor: colors.primary },
  dayBtnToday: { backgroundColor: `${colors.primary}15` },
  dayAbbrev: { fontSize: 10, fontWeight: typography.weight.semibold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3 },
  dayNum: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.mutedForeground },
  dayTextSel: { color: colors.white },
  dayTextToday: { color: colors.primary },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  dotVis: { backgroundColor: colors.primary },
  dotSel: { backgroundColor: 'rgba(255,255,255,0.7)' },
  // Month grid (expanded view)
  colHeaders: { flexDirection: 'row', marginBottom: 4 },
  colHeader: {
    flex: 1, textAlign: 'center',
    fontSize: 10, fontWeight: typography.weight.semibold,
    color: colors.mutedForeground, opacity: 0.5,
    textTransform: 'uppercase', letterSpacing: 0.3,
    paddingVertical: spacing.xs,
  },
  monthRow: { flexDirection: 'row', marginBottom: 2 },
  monthCell: { flex: 1, alignItems: 'center' },
  compactBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.md, gap: 1,
  },
  compactNum: {
    fontSize: typography.size.sm, fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
  },
});

// ── CalendarScreen ────────────────────────────────────────────────────────────

export function CalendarScreen({ navigation }: CalendarScreenProps) {
  const insets = useSafeAreaInsets();
  const { data: events = [], isLoading, refetch, isRefetching } = useEvents();
  const { data: allItems = [] } = useItems();
  const deleteEventMutation = useDeleteEvent();
  const generateOutfit = useGenerateOutfit();

  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((pos) => setDeviceCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }))
        .catch(() => {});
    }).catch(() => {});
  }, []);

  const [selectedDate, setSelectedDate]     = useState(() => toDateStr(new Date()));
  const [weekOffset, setWeekOffset]         = useState(0);
  const [formVisible, setFormVisible]       = useState(false);
  const [editingEvent, setEditingEvent]     = useState<Event | null>(null);
  const [detailEvent, setDetailEvent]       = useState<Event | null>(null);
  const [pickerEvent, setPickerEvent]       = useState<Event | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPast, setShowAllPast]       = useState(false);
  const [syncVisible, setSyncVisible]       = useState(false);

  const UPCOMING_LIMIT = 4;
  const PAST_LIMIT = 5;

  const now = Date.now();

  const upcoming = useMemo(
    () => events
      .filter((e) => new Date(e.date).getTime() >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events],
  );

  const past = useMemo(
    () => events
      .filter((e) => new Date(e.date).getTime() < now)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [events],
  );

  const weekDays = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const eventDateSet = useMemo(
    () => new Set(events.map((e) => toDateStr(new Date(e.date)))),
    [events],
  );

  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, UPCOMING_LIMIT);
  const groupedUpcoming = useMemo(() => groupByDate(visibleUpcoming), [visibleUpcoming]);
  const visiblePast = showAllPast ? past : past.slice(0, PAST_LIMIT);

  const handleEdit = (ev: Event) => {
    setDetailEvent(null);
    setEditingEvent(ev);
    setFormVisible(true);
  };

  const handleDelete = (ev: Event) => {
    Alert.alert(
      'Delete Event',
      `Delete "${ev.title}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { deleteEventMutation.mutate(ev.id); setDetailEvent(null); },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Calendar</Text>
            <TouchableOpacity
              style={styles.syncIconBtn}
              onPress={() => setSyncVisible(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="sync-outline" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Plan ahead for every occasion.</Text>
        </View>

        {/* Week Strip */}
        <WeekStrip
          weekDays={weekDays}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPrevWeek={() => setWeekOffset((o) => o - 1)}
          onNextWeek={() => setWeekOffset((o) => o + 1)}
          onToday={() => { setWeekOffset(0); setSelectedDate(toDateStr(new Date())); }}
          eventDateSet={eventDateSet}
          weekOffset={weekOffset}
        />

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
        ) : events.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="calendar-outline" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptySubtitle}>
              Add upcoming events to plan the perfect outfit for each one.
            </Text>
          </View>
        ) : (
          <>
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Upcoming{upcoming.length > UPCOMING_LIMIT
                    ? <Text style={styles.sectionCount}> ({upcoming.length})</Text>
                    : null}
                </Text>

                {groupedUpcoming.map(([dateStr, dayEvents]) => {
                  const dayDate = new Date(dateStr + 'T00:00:00');
                  const countdown = formatCountdown(dayDate);
                  return (
                    <View key={dateStr} style={styles.dayGroup}>
                      <View style={styles.dayHeader}>
                        <Text style={styles.dayLabel}>{formatDayLabel(dayDate)}</Text>
                        <View style={styles.dayDivider} />
                        {countdown ? <Text style={styles.dayCountdown}>{countdown}</Text> : null}
                      </View>

                      {dayEvents.map((event) => {
                        const iconName = (OCCASION_ICONS[event.occasion] ?? 'calendar-outline') as keyof typeof Ionicons.glyphMap;
                        return (
                          <TouchableOpacity
                            key={event.id}
                            style={styles.eventCard}
                            onPress={() => setDetailEvent(event)}
                            activeOpacity={0.8}
                          >
                            <View style={styles.eventIconBox}>
                              <Ionicons name={iconName} size={18} color={colors.primary} />
                            </View>
                            <View style={styles.eventBody}>
                              <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                              <View style={styles.eventMeta}>
                                <Text style={styles.eventTime}>{formatTime(new Date(event.date))}</Text>
                                {event.location ? (
                                  <>
                                    <Text style={styles.dot}>·</Text>
                                    <Ionicons name="location-outline" size={11} color={colors.mutedForeground} />
                                    <Text style={styles.eventLoc} numberOfLines={1}>{event.location}</Text>
                                  </>
                                ) : null}
                              </View>
                              <View style={styles.occasionBadge}>
                                <Text style={styles.occasionBadgeText}>
                                  {OCCASIONS.find((o) => o.id === event.occasion)?.label ?? event.occasion}
                                </Text>
                              </View>
                            </View>
                            {(event.itemIds ?? []).length > 0
                              ? <ItemThumbStack itemIds={event.itemIds!} allItems={allItems} onPress={() => setPickerEvent(event)} />
                              : <Ionicons name="chevron-forward" size={16} color={colors.border} />
                            }
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}

                {upcoming.length > UPCOMING_LIMIT && !showAllUpcoming && (
                  <TouchableOpacity style={styles.showMore} onPress={() => setShowAllUpcoming(true)}>
                    <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
                    <Text style={styles.showMoreText}>View all {upcoming.length} upcoming events</Text>
                  </TouchableOpacity>
                )}
                {showAllUpcoming && upcoming.length > UPCOMING_LIMIT && (
                  <TouchableOpacity style={styles.showMore} onPress={() => setShowAllUpcoming(false)}>
                    <Text style={styles.showMoreText}>Show less</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Past */}
            {past.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Past</Text>
                {visiblePast.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.pastCard}
                    onPress={() => setDetailEvent(event)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pastIconBox}>
                      <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
                    </View>
                    <View style={styles.pastBody}>
                      <Text style={styles.pastTitle} numberOfLines={1}>{event.title}</Text>
                      <Text style={styles.pastDate}>
                        {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(event)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
                {past.length > PAST_LIMIT && !showAllPast && (
                  <TouchableOpacity style={styles.showMore} onPress={() => setShowAllPast(true)}>
                    <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
                    <Text style={styles.showMoreText}>View {past.length - PAST_LIMIT} more past events</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + spacing.xl }]}
        onPress={() => { setEditingEvent(null); setFormVisible(true); }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color={colors.white} />
        <Text style={styles.fabText}>Add Event</Text>
      </TouchableOpacity>

      {/* Modals */}
      <EventDetailModal
        event={detailEvent}
        visible={detailEvent !== null}
        onClose={() => setDetailEvent(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAssign={(ev) => { setDetailEvent(null); setPickerEvent(ev); }}
        allItems={allItems}
        generateOutfit={generateOutfit}
        onViewOutfits={() => navigation.navigate('Closet')}
        deviceCoords={deviceCoords}
      />
      <EventFormModal
        visible={formVisible}
        event={editingEvent}
        onClose={() => { setFormVisible(false); setEditingEvent(null); }}
      />
      <EventItemPickerModal
        event={pickerEvent}
        visible={pickerEvent !== null}
        onClose={() => setPickerEvent(null)}
      />
      <CalendarSyncSheet
        visible={syncVisible}
        onClose={() => setSyncVisible(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

  header: { marginBottom: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: typography.size.xxl, fontWeight: typography.weight.bold, color: colors.foreground, letterSpacing: -0.5 },
  syncIconBtn: {
    width: 36, height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  subtitle: { fontSize: typography.size.sm, color: colors.mutedForeground, marginTop: 2 },

  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground, marginBottom: spacing.md },
  sectionCount: { fontWeight: typography.weight.regular, color: colors.mutedForeground },

  dayGroup: { marginBottom: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dayLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayDivider: { flex: 1, height: 1, backgroundColor: colors.border },
  dayCountdown: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.primary },

  eventCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  eventIconBox: {
    width: 40, height: 40, borderRadius: radii.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  eventBody: { flex: 1, gap: 2 },
  eventTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventTime: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  dot: { fontSize: typography.size.xs, color: colors.mutedForeground },
  eventLoc: { fontSize: typography.size.xs, color: colors.mutedForeground, flex: 1 },
  occasionBadge: {
    alignSelf: 'flex-start', backgroundColor: `${colors.primary}15`,
    borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2,
  },
  occasionBadgeText: { fontSize: 10, fontWeight: typography.weight.semibold, color: colors.primary, textTransform: 'capitalize' },

  pastCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border, opacity: 0.7,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  pastIconBox: {
    width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  pastBody: { flex: 1, gap: 2 },
  pastTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.foreground },
  pastDate: { fontSize: typography.size.xs, color: colors.mutedForeground },

  showMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingVertical: spacing.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginTop: spacing.xs,
  },
  showMoreText: { fontSize: typography.size.sm, color: colors.mutedForeground },

  empty: { alignItems: 'center', paddingTop: spacing.xxxl * 2, gap: spacing.md },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: radii.xl,
    backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.foreground },
  emptySubtitle: { fontSize: typography.size.sm, color: colors.mutedForeground, textAlign: 'center', maxWidth: 260 },

  fab: {
    position: 'absolute', right: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radii.xl, backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.white },
});
