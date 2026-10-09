import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { PersonAvatar } from './PersonAvatar';
import { useCreateLendContact, useLendContacts } from '../../hooks/useLendContacts';
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

type Selection = { kind: 'existing'; id: number } | { kind: 'new'; name: string } | null;

/**
 * Who has this piece, and optionally when it's due back. One "Who has it?"
 * field: saved people show as avatars and filter as you type; a name that
 * matches nobody becomes "Add …", and only then is the relationship asked.
 * Setting a back-by date is what turns on the lent-item reminder.
 */
export function LendSheet({ visible, itemName, itemImageUri, currentContactId, currentDueBack, lentAt, onConfirm, onClose }: {
  visible: boolean;
  itemName: string;
  itemImageUri?: string;
  currentContactId?: number | null;
  currentDueBack?: string | null;
  /** The open loan's start, when editing one; back-by dates count from it. */
  lentAt?: string | null;
  onConfirm: (contactId: number | null, dueBack: string | null) => void;
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
  const editing = !!lentAt;
  const start = lentAt ?? localYmd();

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setSelection(currentContactId != null ? { kind: 'existing', id: currentContactId } : null);
    setRelationship('friend');
    setDueBack(currentDueBack ?? null);
    setPickingDate(false);
  }, [visible, currentContactId, currentDueBack]);

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
    let picked: string | null;
    try {
      picked = await pickNameFromContacts();
    } catch {
      Alert.alert('Not available yet', 'Update Styled to choose people from your contacts.');
      return;
    }
    if (!picked) return;
    const existing = contacts.find((c) => c.name.toLowerCase() === picked.toLowerCase());
    choose(existing ? { kind: 'existing', id: existing.id } : { kind: 'new', name: picked });
  };

  const turnOnReminders = async () => {
    if (!dueBack || prefs.notifications.loans) return;
    if (await ensureNotificationPermission()) setPrefs({ notifications: { loans: true } });
  };

  const finish = (contactId: number | null) => {
    onConfirm(contactId, dueBack);
    void turnOnReminders();
  };

  const save = async () => {
    if (selection?.kind === 'new') {
      try {
        const contact = await createContact.mutateAsync({ name: selection.name, relationship });
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
          <View style={styles.thumb}>
            {itemImageUri ? <Image source={{ uri: itemImageUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{editing ? 'Edit loan' : 'Lend'}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{itemName}</Text>
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
            <View style={styles.section}>
              <Text style={styles.label}>How do you know {selection.name.split(' ')[0]}?</Text>
              <View style={styles.chips}>
                {LEND_RELATIONSHIPS.map((r) => (
                  <Chip key={r.id} label={r.label} active={relationship === r.id} onPress={() => setRelationship(r.id)} />
                ))}
              </View>
            </View>
          ) : null}

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
            {dueBack ? (
              <View style={styles.reminder}>
                <Ionicons name="notifications-outline" size={14} color={colors.mutedForeground} />
                <Text style={styles.hint}>{`We'll remind you on ${formatLoanDate(dueBack)}.`}</Text>
              </View>
            ) : null}
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
  thumb: { width: 44, height: 55, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
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
