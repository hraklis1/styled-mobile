import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BUDGET_OPTIONS, OCCASION_OPTIONS, STYLE_OPTIONS, type ProfileOption } from '../../lib/profileOptions';
import { formatLocalCalendarDate, parseLocalCalendarDate, validateStylistWorkflow } from '../../features/stylist/workflows';
import type { StylistWorkflow } from '../../features/stylist/types';
import type { Item } from '../../types/item';
import type { Profile } from '../../types/profile';
import { colors, radii, spacing, typography } from '../../theme';
import { CalendarPickerSheet } from '../calendar/CalendarPickerSheet';
import { ItemPickerSheet } from '../outfits/ItemPickerSheet';

type IntakeKind = Exclude<StylistWorkflow['kind'], 'wardrobe_audit'>;

type Props = {
  visible: boolean;
  kind: IntakeKind | null;
  items: Item[];
  profile?: Profile | null;
  initialItemId?: number | null;
  onClose: () => void;
  onSubmit: (workflow: StylistWorkflow) => void;
};

const DRESS_CODES = ['Casual', 'Smart casual', 'Business', 'Cocktail', 'Formal', 'Not sure'];
const FEELINGS = ['Comfortable', 'Relaxed', 'Polished', 'Confident', 'Bold'];
const PIECE_DIRECTIONS = ['Everyday', 'More polished', 'More casual', 'More formal', 'Unexpected'];

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: Array<string | ProfileOption>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((option) => {
        const value = typeof option === 'string' ? option : option.value;
        const label = typeof option === 'string' ? option : option.label;
        return <Chip key={value} label={label} selected={selected.includes(value)} onPress={() => onToggle(value)} />;
      })}
    </View>
  );
}

function FieldLabel({ children, optional = false }: { children: string; optional?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.fieldLabel}>{children}</Text>
      {optional ? <Text style={styles.optionalLabel}>OPTIONAL</Text> : null}
    </View>
  );
}

function titleForKind(kind: IntakeKind | null): string {
  switch (kind) {
    case 'occasion': return 'Dress for a plan';
    case 'style_piece': return 'Style a piece';
    case 'trip': return 'Pack a trip';
    case 'wardrobe_build': return 'Build my wardrobe';
    default: return 'Styling brief';
  }
}

function submitLabel(kind: IntakeKind | null): string {
  switch (kind) {
    case 'occasion': return 'Create my look';
    case 'style_piece': return 'Style this piece';
    case 'trip': return 'Create packing plan';
    case 'wardrobe_build': return 'Build my wardrobe';
    default: return 'Continue';
  }
}

export function StylistIntakeSheet({ visible, kind, items, profile, initialItemId, onClose, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [feeling, setFeeling] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [pieceOccasion, setPieceOccasion] = useState('');
  const [pieceDirection, setPieceDirection] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [plans, setPlans] = useState('');
  const [luggage, setLuggage] = useState<'carry_on' | 'checked' | 'not_sure'>('not_sure');
  const [notes, setNotes] = useState('');
  const [lifestyle, setLifestyle] = useState<string[]>([]);
  const [styleDirection, setStyleDirection] = useState<string[]>([]);
  const [budget, setBudget] = useState<string[]>([]);
  const [itemPickerVisible, setItemPickerVisible] = useState(false);
  const [datePicker, setDatePicker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPlan('');
    setDressCode('');
    setFeeling('');
    setSelectedItemId(kind === 'style_piece' ? initialItemId ?? null : null);
    setPieceOccasion('');
    setPieceDirection('');
    setDestination('');
    setStartDate('');
    setEndDate('');
    setPlans('');
    setLuggage('not_sure');
    setNotes('');
    setLifestyle(profile?.occasions ?? []);
    setStyleDirection(profile?.stylePreference ?? []);
    setBudget(profile?.budgetRange ?? []);
    setItemPickerVisible(false);
    setDatePicker(null);
  }, [initialItemId, kind, profile?.budgetRange, profile?.occasions, profile?.stylePreference, visible]);

  const openDatePicker = (which: 'start' | 'end') => {
    setDatePicker(which);
  };

  const closeDatePicker = () => {
    setDatePicker(null);
  };

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

  const workflow = useMemo<StylistWorkflow | null>(() => {
    switch (kind) {
      case 'occasion':
        return {
          kind,
          plan: plan.trim(),
          ...(dressCode ? { dressCode } : {}),
          ...(feeling ? { feeling } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
      case 'style_piece':
        return selectedItemId == null ? null : {
          kind,
          itemId: selectedItemId,
          ...(pieceOccasion.trim() ? { occasion: pieceOccasion.trim() } : {}),
          ...(pieceDirection ? { direction: pieceDirection } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
      case 'trip':
        return {
          kind,
          destination: destination.trim(),
          startDate,
          endDate,
          ...(plans.trim() ? { plans: plans.trim() } : {}),
          luggage,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
      case 'wardrobe_build':
        return {
          kind,
          lifestyle,
          ...(styleDirection.length ? { styleDirection } : {}),
          ...(budget.length ? { budget } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
      default:
        return null;
    }
  }, [budget, destination, dressCode, endDate, feeling, kind, lifestyle, luggage, notes, pieceDirection, pieceOccasion, plan, plans, selectedItemId, startDate, styleDirection]);

  const validationError = workflow ? validateStylistWorkflow(workflow, items) : 'Complete the required fields.';
  const pickerValue = datePicker === 'end'
    ? parseLocalCalendarDate(endDate) ?? parseLocalCalendarDate(startDate) ?? new Date()
    : parseLocalCalendarDate(startDate) ?? new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minimumEnd = parseLocalCalendarDate(startDate) ?? today;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={datePicker ? closeDatePicker : itemPickerVisible ? () => setItemPickerVisible(false) : onClose}
      >
        {itemPickerVisible ? (
          <ItemPickerSheet
            inline
            visible
            onClose={() => setItemPickerVisible(false)}
            title="Choose a wardrobe piece"
            items={items.filter((item) => item.condition !== 'needs_repair' && item.condition !== 'donate')}
            selectedId={selectedItemId ?? undefined}
            onSelect={(item) => {
              setSelectedItemId(item.id);
              setItemPickerVisible(false);
            }}
          />
        ) : (
          <KeyboardAvoidingView
            style={styles.modalRoot}
            behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          >
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} accessibilityViewIsModal>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>YOUR BRIEF</Text>
                <Text style={styles.title}>{titleForKind(kind)}</Text>
                <Text style={styles.subtitle}>Nothing is sent until you finish this brief.</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close styling brief">
                <Ionicons name="close" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {kind === 'occasion' ? (
                <>
                  <View style={styles.field}>
                    <FieldLabel>What’s the plan?</FieldLabel>
                    <TextInput value={plan} onChangeText={setPlan} placeholder="Dinner and drinks" placeholderTextColor={colors.mutedForeground} style={styles.input} maxLength={300} />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel optional>Dress code</FieldLabel>
                    <ChipGroup options={DRESS_CODES} selected={dressCode ? [dressCode] : []} onToggle={(value) => setDressCode(value === dressCode ? '' : value)} />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel optional>How should it feel?</FieldLabel>
                    <ChipGroup options={FEELINGS} selected={feeling ? [feeling] : []} onToggle={(value) => setFeeling(value === feeling ? '' : value)} />
                  </View>
                </>
              ) : null}

              {kind === 'style_piece' ? (
                <>
                  <View style={styles.field}>
                    <FieldLabel>Wardrobe piece</FieldLabel>
                    <TouchableOpacity
                      style={styles.selectionRow}
                      onPress={() => setItemPickerVisible(true)}
                      accessibilityRole="button"
                      accessibilityLabel={selectedItem ? `Change wardrobe piece. ${selectedItem.name} selected` : 'Choose a wardrobe piece'}
                    >
                      <View style={styles.selectionIcon}><Ionicons name="shirt-outline" size={18} color={colors.primary} /></View>
                      <Text style={[styles.selectionText, !selectedItem && styles.selectionPlaceholder]} numberOfLines={1}>
                        {selectedItem?.name ?? 'Choose a piece'}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.field}>
                    <FieldLabel optional>Occasion</FieldLabel>
                    <TextInput value={pieceOccasion} onChangeText={setPieceOccasion} placeholder="Weekend dinner, office, everyday…" placeholderTextColor={colors.mutedForeground} style={styles.input} maxLength={120} />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel optional>Direction</FieldLabel>
                    <ChipGroup options={PIECE_DIRECTIONS} selected={pieceDirection ? [pieceDirection] : []} onToggle={(value) => setPieceDirection(value === pieceDirection ? '' : value)} />
                  </View>
                </>
              ) : null}

              {kind === 'trip' ? (
                <>
                  <View style={styles.field}>
                    <FieldLabel>Destination</FieldLabel>
                    <TextInput value={destination} onChangeText={setDestination} placeholder="Tokyo, Japan" placeholderTextColor={colors.mutedForeground} style={styles.input} maxLength={160} />
                  </View>
                  <View style={styles.dateRow}>
                    <View style={styles.dateField}>
                      <FieldLabel>Departure</FieldLabel>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => openDatePicker('start')}
                        accessibilityRole="button"
                        accessibilityLabel="Choose departure date"
                      >
                        <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                        <Text style={[styles.dateText, !startDate && styles.selectionPlaceholder]}>{startDate || 'Choose'}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.dateField}>
                      <FieldLabel>Return</FieldLabel>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => openDatePicker('end')}
                        accessibilityRole="button"
                        accessibilityLabel="Choose return date"
                      >
                        <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                        <Text style={[styles.dateText, !endDate && styles.selectionPlaceholder]}>{endDate || 'Choose'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.field}>
                    <FieldLabel optional>Plans</FieldLabel>
                    <TextInput value={plans} onChangeText={setPlans} placeholder="Walking, dinners, meetings, beach…" placeholderTextColor={colors.mutedForeground} style={styles.input} maxLength={500} />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel optional>Luggage</FieldLabel>
                    <ChipGroup
                      options={[
                        { value: 'carry_on', label: 'Carry-on only' },
                        { value: 'checked', label: 'Checked bag' },
                        { value: 'not_sure', label: 'Not sure' },
                      ]}
                      selected={[luggage]}
                      onToggle={(value) => setLuggage(value as typeof luggage)}
                    />
                  </View>
                </>
              ) : null}

              {kind === 'wardrobe_build' ? (
                <>
                  <View style={styles.field}>
                    <FieldLabel>What do you dress for?</FieldLabel>
                    <ChipGroup options={OCCASION_OPTIONS} selected={lifestyle} onToggle={(value) => setLifestyle((current) => toggle(current, value))} />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel optional>Style direction</FieldLabel>
                    <ChipGroup options={STYLE_OPTIONS} selected={styleDirection} onToggle={(value) => setStyleDirection((current) => toggle(current, value))} />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel optional>Budget</FieldLabel>
                    <ChipGroup options={BUDGET_OPTIONS} selected={budget} onToggle={(value) => setBudget((current) => toggle(current, value))} />
                  </View>
                </>
              ) : null}

              <View style={styles.field}>
                <FieldLabel optional>Anything else?</FieldLabel>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Comfort, fit, color, or other context"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, styles.notesInput]}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.footer}>
              {validationError ? <Text style={styles.validationText}>{validationError}</Text> : null}
              <TouchableOpacity
                style={[styles.submitButton, !!validationError && styles.submitDisabled]}
                disabled={!!validationError || !workflow}
                onPress={() => workflow && onSubmit(workflow)}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!validationError }}
              >
                <Ionicons name="sparkles" size={17} color={colors.primaryForeground} />
                <Text style={styles.submitText}>{submitLabel(kind)}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        )}

        <CalendarPickerSheet
          inline
          visible={datePicker !== null}
          value={pickerValue}
          mode="date"
          minimumDate={datePicker === 'end' ? minimumEnd : today}
          onCancel={closeDatePicker}
          onConfirm={(date) => {
            const value = formatLocalCalendarDate(date);
            if (datePicker === 'start') {
              setStartDate(value);
              if (endDate && endDate < value) setEndDate('');
            } else if (datePicker === 'end') {
              setEndDate(value);
            }
            closeDatePicker();
          }}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(24, 20, 17, 0.42)' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { fontSize: 11, letterSpacing: 1.4, fontWeight: typography.weight.semibold, color: colors.primary },
  title: { fontFamily: typography.family.display, fontSize: 30, lineHeight: 34, color: colors.foreground },
  subtitle: { fontSize: typography.size.sm, lineHeight: 19, color: colors.mutedForeground },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  scroll: { flexShrink: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xl },
  field: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  optionalLabel: { fontSize: 10, letterSpacing: 1.1, color: colors.mutedForeground },
  input: { minHeight: 48, borderRadius: radii.md, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.md, fontSize: typography.size.md, color: colors.foreground },
  notesInput: { minHeight: 84, paddingTop: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 38, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontSize: typography.size.sm, color: colors.foreground },
  chipTextSelected: { color: colors.primaryForeground, fontWeight: typography.weight.semibold },
  selectionRow: { minHeight: 54, borderRadius: radii.md, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  selectionIcon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  selectionText: { flex: 1, fontSize: typography.size.md, color: colors.foreground },
  selectionPlaceholder: { color: colors.mutedForeground },
  dateRow: { flexDirection: 'row', gap: spacing.md },
  dateField: { flex: 1, gap: spacing.sm },
  dateButton: { minHeight: 48, borderRadius: radii.md, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateText: { flex: 1, fontSize: typography.size.sm, color: colors.foreground, fontVariant: ['tabular-nums'] },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  validationText: { fontSize: typography.size.xs, color: colors.mutedForeground, textAlign: 'center' },
  submitButton: { minHeight: 54, borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  submitDisabled: { opacity: 0.42 },
  submitText: { color: colors.primaryForeground, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
});
