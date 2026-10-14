import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { PersonAvatar } from './PersonAvatar';
import { useCreateLendContact, useLendContacts, type LendInput } from '../../hooks/useLendContacts';
import { useAppPreferences } from '../../hooks/useAppPreferences';
import {
  addDaysYmd, formatLoanDate, LEND_RELATIONSHIPS, localYmd, pickNameFromContacts, ymdToDate,
  type LendRelationship,
} from '../../lib/lending';
import { ensureNotificationPermission } from '../../lib/notifications';
import * as Haptics from '../../lib/haptics';
import { colors, radii, spacing, typography } from '../../theme';

const DUE_OPTIONS = [
  { key: 'none', label: 'None', days: null },
  { key: 'week', label: '1 week', days: 7 },
  { key: 'fortnight', label: '2 weeks', days: 14 },
  { key: 'month', label: '1 month', days: 30 },
] as const;

type Selection = { kind: 'existing'; id: number } | { kind: 'new'; name: string; deviceContactId?: string | null } | null;

export type LendSheetItem = { name: string; uri?: string };

/**
 * Who has these pieces (one, or a whole selection), since when, and
 * optionally when they're due back and what they're for. One "Who has it?"
 * field: saved people show as avatars and filter as you type; a name that
 * matches nobody becomes "Add …" (how you know them is one optional tap).
 * Lending turns on lent-item reminders (asking for notification permission once).
 */
export function LendSheet({ visible, items, currentContactId, currentDueBack, currentNote, lentAt, onConfirm, onClose }: {
  visible: boolean;
  items: LendSheetItem[];
  currentContactId?: number | null;
  currentDueBack?: string | null;
  currentNote?: string | null;
  /** The open loan's start, when editing one. */
  lentAt?: string | null;
  /** lentAt / note are left out when unchanged. */
  onConfirm: (input: LendInput) => void;
  onClose: () => void;
}) {
  const { data: contacts = [], isLoading } = useLendContacts(visible);
  const createContact = useCreateLendContact();
  const { prefs, setPrefs } = useAppPreferences();
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection>(null);
  const [relationship, setRelationship] = useState<LendRelationship>('friend');
  const [dueBack, setDueBack] = useState<string | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const [startDate, setStartDate] = useState(localYmd());
  const [pickingStart, setPickingStart] = useState(false);
  const [note, setNote] = useState('');
  const [askRelationship, setAskRelationship] = useState(false);
  const editing = !!lentAt;
  const today = localYmd();
  // Back-by presets count from the lend date.
  const start = startDate;

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setSelection(currentContactId != null ? { kind: 'existing', id: currentContactId } : null);
    setRelationship('friend');
    setDueBack(currentDueBack ?? null);
    setPickingDate(false);
    setStartDate(lentAt ?? localYmd());
    setPickingStart(false);
    setNote(currentNote ?? '');
    setAskRelationship(false);
  }, [visible, currentContactId, currentDueBack, currentNote, lentAt]);

  const changeStart = (ymd: string) => {
    setStartDate(ymd);
    // A back-by date can't come before the loan starts.
    if (dueBack && dueBack < ymd) setDueBack(null);
  };

  const trimmed = query.replace(/\s+/g, ' ').trim();
  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    return q ? contacts.filter((c) => c.name.toLowerCase().includes(q)) : contacts;
  }, [contacts, trimmed]);
  const exact = contacts.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  const selectedContact = selection?.kind === 'existing' ? contacts.find((c) => c.id === selection.id) ?? null : null;
  const selectedName = selection?.kind === 'new' ? selection.name : selectedContact?.name ?? null;

  const choose = (next: Selection) => {
    void Haptics.selectionAsync();
    setSelection(next);
    setQuery('');
  };

  const addTyped = () => {
    if (!trimmed) return;
    if (exact) choose({ kind: 'existing', id: exact.id });
    else choose({ kind: 'new', name: trimmed });
  };

  const chooseFromContacts = async () => {
    let picked: Awaited<ReturnType<typeof pickNameFromContacts>>;
    try {
      picked = await pickNameFromContacts();
    } catch {
      Alert.alert('Not available yet', 'Update Styled to choose people from your contacts.');
      return;
    }
    if (!picked) return;
    const existing = contacts.find((c) => c.name.toLowerCase() === picked.name.toLowerCase());
    choose(existing ? { kind: 'existing', id: existing.id } : { kind: 'new', name: picked.name, deviceContactId: picked.deviceContactId });
  };

  // Every loan now gets a reminder (back-by day, or a check-in after a
  // month), so lending is what switches them on.
  const turnOnReminders = async () => {
    if (prefs.notifications.loans) return;
    if (await ensureNotificationPermission()) setPrefs({ notifications: { loans: true } });
  };

  const finish = (contactId: number | null) => {
    const tidyNote = note.replace(/\s+/g, ' ').trim();
    const originalStart = lentAt ?? today;
    onConfirm({
      contactId,
      dueBack,
      ...(startDate !== originalStart ? { lentAt: startDate } : {}),
      ...(tidyNote !== (currentNote ?? '') ? { note: tidyNote || null } : {}),
    });
    void turnOnReminders();
  };

  const save = async () => {
    if (selection?.kind === 'new') {
      try {
        const contact = await createContact.mutateAsync({
          name: selection.name, relationship, deviceContactId: selection.deviceContactId ?? null,
        });
        finish(contact.id);
      } catch {
        // The mutation already alerted; keep the sheet open to retry.
      }
      return;
    }
    finish(selection?.kind === 'existing' ? selection.id : null);
  };

  const dueKey = dueBack == null ? 'none'
    : DUE_OPTIONS.find((o) => o.days != null && addDaysYmd(start, o.days) === dueBack)?.key ?? 'custom';
  // Editing can save a date change even when nobody is named.
  const canSave = editing || selection != null;
  const primaryLabel = editing ? 'Save' : selectedName ? `Lend to ${selectedName}` : 'Choose who has it';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.thumbs}>
            {items.slice(0, 3).map((item, i) => (
              <View key={i} style={[styles.thumb, i > 0 && styles.thumbStacked, { zIndex: 3 - i }]}>
                {item.uri ? <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{editing ? 'Edit loan' : 'Lend'}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {items.length === 1 ? items[0].name : `${items.length} pieces`}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={styles.headerLink}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.field}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Who has it?"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={addTyped}
              accessibilityLabel="Who has it?"
            />
            {Platform.OS === 'ios' ? (
              <Pressable
                onPress={() => { void chooseFromContacts(); }}
                hitSlop={10}
                style={styles.fieldButton}
                accessibilityRole="button"
                accessibilityLabel="Choose from Contacts"
              >
                <Ionicons name="person-circle-outline" size={24} color={colors.foreground} />
              </Pressable>
            ) : null}
          </View>

          {isLoading ? <ActivityIndicator color={colors.primary} /> : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people} keyboardShouldPersistTaps="handled">
              {selection?.kind === 'new' ? (
                <Person name={selection.name} caption="New" selected onPress={() => choose(null)} />
              ) : null}
              {trimmed && !exact ? (
                <Person name={trimmed} caption="Add" icon="add" onPress={addTyped} />
              ) : null}
              {filtered.map((c) => {
                const active = selection?.kind === 'existing' && selection.id === c.id;
                return (
                  <Person
                    key={c.id}
                    name={c.name}
                    caption={LEND_RELATIONSHIPS.find((r) => r.id === c.relationship)?.label ?? ''}
                    selected={active}
                    onPress={() => choose(active ? null : { kind: 'existing', id: c.id })}
                  />
                );
              })}
            </ScrollView>
          )}
          {!isLoading && contacts.length === 0 && !trimmed && selection == null ? (
            <Text style={styles.hint}>Type a name or pick from your contacts. We'll remember them for next time.</Text>
          ) : null}

          {selection?.kind === 'new' ? (
            askRelationship ? (
              <View style={styles.section}>
                <Text style={styles.label}>How do you know {selection.name.split(' ')[0]}?</Text>
                <View style={styles.chips}>
                  {LEND_RELATIONSHIPS.map((r) => (
                    <Chip key={r.id} label={r.label} active={relationship === r.id} onPress={() => setRelationship(r.id)} />
                  ))}
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setAskRelationship(true)} style={styles.inlineLink} accessibilityRole="button">
                <Text style={styles.hint}>
                  {`Saved as a ${LEND_RELATIONSHIPS.find((r) => r.id === relationship)?.label.toLowerCase()}. `}
                  <Text style={styles.inlineLinkText}>Change</Text>
                </Text>
              </Pressable>
            )
          ) : null}

          <View style={styles.section}>
            <Text style={styles.label}>Lent on</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Chip label="Today" active={startDate === today} onPress={() => { setPickingStart(false); changeStart(today); }} />
              <Chip label="Yesterday" active={startDate === addDaysYmd(today, -1)} onPress={() => { setPickingStart(false); changeStart(addDaysYmd(today, -1)); }} />
              <Chip
                label={startDate < addDaysYmd(today, -1) ? formatLoanDate(startDate) ?? 'Earlier…' : 'Earlier…'}
                icon="calendar-outline"
                active={startDate < addDaysYmd(today, -1)}
                onPress={() => { if (startDate >= addDaysYmd(today, -1)) changeStart(addDaysYmd(today, -7)); setPickingStart((open) => !open); }}
              />
            </ScrollView>
            {pickingStart ? (
              <DateTimePicker
                value={ymdToDate(startDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                maximumDate={ymdToDate(today)}
                accentColor={colors.primary}
                onChange={(_, date) => {
                  if (Platform.OS !== 'ios') setPickingStart(false);
                  if (date) changeStart(localYmd(date));
                }}
              />
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Back by</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {DUE_OPTIONS.map((o) => (
                <Chip
                  key={o.key}
                  label={o.label}
                  active={dueKey === o.key}
                  onPress={() => { setPickingDate(false); setDueBack(o.days == null ? null : addDaysYmd(start, o.days)); }}
                />
              ))}
              <Chip
                label={dueKey === 'custom' && dueBack ? formatLoanDate(dueBack) ?? 'Date…' : 'Date…'}
                icon="calendar-outline"
                active={dueKey === 'custom'}
                onPress={() => { setDueBack(dueBack ?? addDaysYmd(start, 7)); setPickingDate((open) => !open); }}
              />
            </ScrollView>
            {pickingDate && dueBack ? (
              <DateTimePicker
                value={ymdToDate(dueBack)}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={ymdToDate(start)}
                accentColor={colors.primary}
                onChange={(_, date) => {
                  if (Platform.OS !== 'ios') setPickingDate(false);
                  if (date) setDueBack(localYmd(date));
                }}
              />
            ) : null}
            <View style={styles.reminder}>
              <Ionicons name="notifications-outline" size={14} color={colors.mutedForeground} />
              <Text style={styles.hint}>
                {dueBack
                  ? `We'll remind you on ${formatLoanDate(dueBack)}, and again a few days later if it isn't back.`
                  : `No date? We'll check in after a month.`}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What's it for? (optional)"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.field, styles.noteInput]}
              maxLength={140}
              returnKeyType="done"
              accessibilityLabel="Note"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {editing ? null : (
            <Pressable onPress={() => finish(null)} style={styles.skip} accessibilityRole="button" accessibilityLabel="Lend without naming anyone">
              <Text style={styles.headerLink}>Skip</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => { void save(); }}
            disabled={!canSave || createContact.isPending}
            style={[styles.primary, !canSave && styles.primaryIdle]}
            accessibilityRole="button"
          >
            {createContact.isPending
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={[styles.primaryLabel, !canSave && styles.primaryLabelIdle]} numberOfLines={1}>{primaryLabel}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Person({ name, caption, selected = false, icon, onPress }: {
  name: string; caption: string; selected?: boolean; icon?: 'add'; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.person}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={icon ? `Add ${name}` : `${name}, ${caption}`}
    >
      <PersonAvatar name={name} selected={selected} icon={icon} />
      <Text style={[styles.personName, selected && styles.personNameSelected]} numberOfLines={1}>{name}</Text>
      <Text style={styles.personCaption} numberOfLines={1}>{caption}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, icon, onPress }: {
  label: string; active: boolean; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => { void Haptics.selectionAsync(); onPress(); }}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      {icon ? <Ionicons name={icon} size={14} color={colors.foreground} /> : null}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.page, paddingTop: spacing.lg, paddingBottom: spacing.lg,
  },
  thumbs: { flexDirection: 'row' },
  thumb: { width: 44, height: 55, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  thumbStacked: { marginLeft: -26, borderWidth: 2, borderColor: colors.background },
  title: { ...typography.text.editorialTitle, fontSize: 24, lineHeight: 30, color: colors.foreground },
  subtitle: { ...typography.text.meta, color: colors.mutedForeground },
  headerLink: { ...typography.text.meta, color: colors.mutedForeground },
  body: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl, gap: spacing.lg },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingLeft: spacing.md, paddingRight: spacing.sm,
    borderRadius: radii.field, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  input: { flex: 1, ...typography.text.bodySmall, color: colors.foreground, paddingVertical: spacing.sm },
  fieldButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  people: { gap: spacing.md, paddingVertical: spacing.xs },
  person: { width: 72, alignItems: 'center', gap: 2 },
  personName: { ...typography.text.caption, color: colors.foreground, marginTop: spacing.xs },
  personNameSelected: { fontWeight: '600' },
  personCaption: { ...typography.text.caption, fontSize: 11, color: colors.mutedForeground },
  section: { gap: spacing.sm },
  label: { ...typography.text.meta, color: colors.foreground },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipRow: { gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: spacing.md,
    borderRadius: radii.full, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.surfaceSelected, borderColor: colors.foreground },
  chipLabel: { ...typography.text.bodySmall, color: colors.mutedForeground },
  chipLabelActive: { color: colors.foreground, fontWeight: '600' },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteInput: { ...typography.text.bodySmall, color: colors.foreground, paddingHorizontal: spacing.md },
  inlineLink: { minHeight: 32, justifyContent: 'center' },
  inlineLinkText: { color: colors.foreground, textDecorationLine: 'underline' },
  hint: { ...typography.text.caption, color: colors.mutedForeground },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.page, paddingTop: spacing.sm, paddingBottom: spacing.xxl,
  },
  skip: { minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.xs },
  primary: {
    flex: 1, minHeight: 52, borderRadius: radii.action, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md,
  },
  primaryIdle: { backgroundColor: colors.surfaceSelected },
  primaryLabel: { ...typography.text.bodySmall, color: colors.primaryForeground, fontWeight: '600' },
  primaryLabelIdle: { color: colors.mutedForeground },
});
