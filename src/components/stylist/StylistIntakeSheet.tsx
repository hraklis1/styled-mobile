import type { StylistTripPrefill } from '../../contexts/GlobalAIStylistContext';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from '../../lib/haptics';
import { itemCoverPresentation } from '../../lib/itemImage';
import { BUDGET_OPTIONS, OCCASION_OPTIONS, STYLE_OPTIONS, type ProfileOption } from '../../lib/profileOptions';
import {
  formatLocalCalendarDate,
  parseLocalCalendarDate,
  tripSpanLabel,
  validateStylistWorkflow,
} from '../../features/stylist/workflows';
import type { StylistWorkflow } from '../../features/stylist/types';
import type { TripType } from '../../features/trips/types';
import type { Item } from '../../types/item';
import type { Profile } from '../../types/profile';
import { colors, motion, radii, spacing, stroke, typography } from '../../theme';
import { CalendarPickerSheet } from '../calendar/CalendarPickerSheet';
import { ItemPickerSheet } from '../outfits/ItemPickerSheet';

type IntakeKind = Exclude<StylistWorkflow['kind'], 'wardrobe_audit'>;
type FieldKey = 'plan' | 'piece' | 'destination' | 'dates' | 'lifestyle';

type Props = {
  visible: boolean;
  kind: IntakeKind | null;
  items: Item[];
  profile?: Profile | null;
  initialItemId?: number | null;
  /** Pre-fills a trip brief, e.g. from the selected day or a calendar event. */
  tripPrefill?: StylistTripPrefill | null;
  onClose: () => void;
  onSubmit: (workflow: StylistWorkflow) => void;
};

// Ordered so each group breaks into a full row and a shorter one at phone
// widths. "Not sure" is gone: leaving a group empty already means that.
const DRESS_CODES = ['Casual', 'Smart casual', 'Business', 'Cocktail', 'Formal'];
const FEELINGS = ['Relaxed', 'Comfortable', 'Polished', 'Confident', 'Bold'];
const PIECE_DIRECTIONS = ['Everyday', 'More casual', 'More polished', 'More formal', 'Unexpected'];
const LUGGAGE_OPTIONS: ProfileOption[] = [
  { value: 'carry_on', label: 'Carry-on only' },
  { value: 'checked', label: 'Checked bag' },
];

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

const TRIP_TYPE_OPTIONS: ProfileOption[] = [
  { value: 'city', label: 'City break' },
  { value: 'beach', label: 'Beach' },
  { value: 'business', label: 'Business' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'outdoors', label: 'Outdoors' },
  { value: 'ski', label: 'Ski & snow' },
];

const EVENING_OPTIONS: ProfileOption[] = [
  { value: '0', label: 'None' },
  { value: '1', label: 'One' },
  { value: '2', label: 'Two' },
  { value: '3', label: 'Three or more' },
];

const LAUNDRY_OPTIONS: ProfileOption[] = [
  { value: 'yes', label: 'I can do laundry' },
  { value: 'no', label: 'No laundry' },
];

function Chip({ label, selected, multi, onPress }: { label: string; selected: boolean; multi: boolean; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: motion.quick });
  }, [progress, selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(36,36,34,0)', colors.primary]),
    borderColor: interpolateColor(progress.value, [0, 1], [colors.ghostStroke, colors.primary]),
    opacity: 1 - pressed.value * 0.15,
    transform: [{ scale: reduceMotion ? 1 : 1 - pressed.value * 0.03 }],
  }));

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={() => { pressed.value = withTiming(1, { duration: motion.quick / 2 }); }}
      onPressOut={() => { pressed.value = withTiming(0, { duration: motion.quick }); }}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.chip, animatedStyle]}>
        {multi && selected ? <Ionicons name="checkmark" size={12} color={colors.primaryForeground} /> : null}
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function ChipGroup({
  options,
  selected,
  multi = false,
  onToggle,
}: {
  options: Array<string | ProfileOption>;
  selected: string[];
  multi?: boolean;
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((option) => {
        const value = typeof option === 'string' ? option : option.value;
        const label = typeof option === 'string' ? option : option.label;
        return <Chip key={value} label={label} multi={multi} selected={selected.includes(value)} onPress={() => onToggle(value)} />;
      })}
    </View>
  );
}

/**
 * One brief field: a tracked label over its control. Fades in on open with a
 * small stagger, reports its offset so a premature submit can scroll to it,
 * and pulses when it is the field holding the brief back.
 */
function Field({
  label,
  index,
  pulse = 0,
  onY,
  children,
}: {
  label: string;
  index: number;
  pulse?: number;
  onY?: (y: number) => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!pulse || reduceMotion) return;
    scale.value = withSequence(
      withTiming(1.02, { duration: motion.slow / 2 }),
      withTiming(1, { duration: motion.slow / 2 }),
    );
  }, [pulse, reduceMotion, scale]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(80 + index * 40).duration(motion.base)}
      onLayout={onY ? (event) => onY(event.nativeEvent.layout.y) : undefined}
      style={[styles.field, pulseStyle]}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </Animated.View>
  );
}

function UnderlineInput({ serif = false, flagged = false, style, ...props }: TextInputProps & { serif?: boolean; flagged?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
      placeholderTextColor={colors.mutedForeground}
      style={[
        styles.input,
        serif ? styles.inputSerif : styles.inputSans,
        (focused || flagged) && styles.inputActive,
        style,
      ]}
    />
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

function promptForKind(kind: IntakeKind | null): string {
  switch (kind) {
    case 'occasion': return 'Tell me where you’re going.';
    case 'style_piece': return 'Pick a piece and I’ll build around it.';
    case 'trip': return 'Where to, and for how long?';
    case 'wardrobe_build': return 'Tell me how you live, and I’ll fill the gaps.';
    default: return 'Tell me a little more.';
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

function itemCaption(item: Item): string | null {
  const parts = [item.category, item.color].filter(Boolean) as string[];
  if (!parts.length) return null;
  const text = parts.join(' · ').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function StylistIntakeSheet({ visible, kind: kindProp, items, profile, initialItemId, tripPrefill, onClose, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  // Hold the last brief while the modal fades out, so closing never flashes a
  // generic "Styling brief" when the parent clears `kind` first.
  const lastKind = useRef<IntakeKind | null>(kindProp);
  if (kindProp) lastKind.current = kindProp;
  const kind = kindProp ?? lastKind.current;
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Partial<Record<FieldKey, number>>>({});
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
  const [tripTypes, setTripTypes] = useState<TripType[]>([]);
  const [dressyEvenings, setDressyEvenings] = useState<number | null>(null);
  const [laundry, setLaundry] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [lifestyle, setLifestyle] = useState<string[]>([]);
  const [styleDirection, setStyleDirection] = useState<string[]>([]);
  const [budget, setBudget] = useState<string[]>([]);
  const [itemPickerVisible, setItemPickerVisible] = useState(false);
  const [datePicker, setDatePicker] = useState<'start' | 'end' | null>(null);
  const [nudge, setNudge] = useState<{ key: FieldKey; count: number } | null>(null);
  const [flagged, setFlagged] = useState<FieldKey | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPlan('');
    setDressCode('');
    setFeeling('');
    setSelectedItemId(kind === 'style_piece' ? initialItemId ?? null : null);
    setPieceOccasion('');
    setPieceDirection('');
    const prefill = kind === 'trip' ? tripPrefill : null;
    setDestination(prefill?.destination ?? '');
    setStartDate(prefill?.startDate ?? '');
    setEndDate(prefill?.endDate ?? '');
    setPlans('');
    setLuggage('not_sure');
    setNotes('');
    setLifestyle(profile?.occasions ?? []);
    setStyleDirection(profile?.stylePreference ?? []);
    setBudget(profile?.budgetRange ?? []);
    setItemPickerVisible(false);
    setDatePicker(null);
    setNudge(null);
    setFlagged(null);
  }, [initialItemId, tripPrefill, kind, profile?.budgetRange, profile?.occasions, profile?.stylePreference, visible]);

  useEffect(() => {
    if (!flagged) return;
    const timer = setTimeout(() => setFlagged(null), 1400);
    return () => clearTimeout(timer);
  }, [flagged, nudge]);

  const openDatePicker = (which: 'start' | 'end') => {
    setDatePicker(which);
  };

  const closeDatePicker = () => {
    setDatePicker(null);
  };

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const selectedCover = itemCoverPresentation(selectedItem);
  const span = tripSpanLabel(startDate, endDate);

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
          ...(tripTypes.length ? { tripTypes } : {}),
          ...(dressyEvenings != null ? { dressyEvenings } : {}),
          ...(laundry != null ? { laundry } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(tripPrefill?.eventId != null ? { eventId: tripPrefill.eventId } : {}),
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
  }, [budget, destination, dressCode, endDate, feeling, kind, lifestyle, luggage, notes, pieceDirection, pieceOccasion, plan, plans, selectedItemId, startDate, styleDirection, tripTypes, dressyEvenings, laundry, tripPrefill?.eventId]);

  const validationError = workflow ? validateStylistWorkflow(workflow, items) : 'Choose a piece from your wardrobe.';
  const ready = !validationError && !!workflow;

  const missingField = (): FieldKey | null => {
    switch (kind) {
      case 'occasion': return 'plan';
      case 'style_piece': return 'piece';
      case 'trip': return destination.trim() ? 'dates' : 'destination';
      case 'wardrobe_build': return 'lifestyle';
      default: return null;
    }
  };

  const handleSubmit = () => {
    if (ready && workflow) {
      onSubmit(workflow);
      return;
    }
    const key = missingField();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (validationError) AccessibilityInfo.announceForAccessibility(validationError);
    if (!key) return;
    const y = fieldY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.lg), animated: true });
    setNudge((current) => ({ key, count: (current?.count ?? 0) + 1 }));
    setFlagged(key);
  };

  const pulseFor = (key: FieldKey) => (nudge?.key === key ? nudge.count : 0);
  const trackY = (key: FieldKey) => (y: number) => { fieldY.current[key] = y; };

  const pickerValue = datePicker === 'end'
    ? parseLocalCalendarDate(endDate) ?? parseLocalCalendarDate(startDate) ?? new Date()
    : parseLocalCalendarDate(startDate) ?? new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minimumEnd = parseLocalCalendarDate(startDate) ?? today;

  let fieldIndex = 0;
  const nextIndex = () => fieldIndex++;

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
                <Text style={styles.eyebrow}>Your brief</Text>
                <Text style={styles.title}>{titleForKind(kind)}</Text>
                <View style={styles.rule} />
                <Text style={styles.prompt}>{promptForKind(kind)}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close styling brief" hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.inkSubtle} />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {kind === 'occasion' ? (
                <>
                  <Field label="What’s the plan?" index={nextIndex()} pulse={pulseFor('plan')} onY={trackY('plan')}>
                    <UnderlineInput serif flagged={flagged === 'plan'} value={plan} onChangeText={setPlan} placeholder="Dinner and drinks" maxLength={300} />
                  </Field>
                  <Field label="Dress code" index={nextIndex()}>
                    <ChipGroup options={DRESS_CODES} selected={dressCode ? [dressCode] : []} onToggle={(value) => setDressCode(value === dressCode ? '' : value)} />
                  </Field>
                  <Field label="How should it feel?" index={nextIndex()}>
                    <ChipGroup options={FEELINGS} selected={feeling ? [feeling] : []} onToggle={(value) => setFeeling(value === feeling ? '' : value)} />
                  </Field>
                </>
              ) : null}

              {kind === 'style_piece' ? (
                <>
                  <Field label="Wardrobe piece" index={nextIndex()} pulse={pulseFor('piece')} onY={trackY('piece')}>
                    <TouchableOpacity
                      style={styles.pieceRow}
                      activeOpacity={0.7}
                      onPress={() => setItemPickerVisible(true)}
                      accessibilityRole="button"
                      accessibilityLabel={selectedItem ? `Change wardrobe piece. ${selectedItem.name} selected` : 'Choose a wardrobe piece'}
                    >
                      <View style={[styles.pieceFrame, selectedItem ? styles.pieceFrameFilled : styles.pieceFrameEmpty, flagged === 'piece' && styles.pieceFrameFlagged]}>
                        {selectedCover.uri ? (
                          <Image source={{ uri: selectedCover.uri }} style={selectedCover.contentFit === 'cover' ? styles.pieceImageCover : styles.pieceImage} contentFit={selectedCover.contentFit} transition={motion.quick} />
                        ) : (
                          <Ionicons name="shirt-outline" size={24} color={colors.mutedForeground} />
                        )}
                      </View>
                      <View style={styles.pieceCopy}>
                        <Text style={styles.pieceTitle} numberOfLines={2}>{selectedItem?.name ?? 'Choose from your closet'}</Text>
                        <Text style={styles.pieceCaption} numberOfLines={1}>
                          {selectedItem ? itemCaption(selectedItem) ?? 'From your closet' : 'Tap to browse your pieces'}
                        </Text>
                        {selectedItem ? <Text style={styles.textAction}>Change</Text> : null}
                      </View>
                    </TouchableOpacity>
                  </Field>
                  <Field label="Occasion" index={nextIndex()}>
                    <UnderlineInput value={pieceOccasion} onChangeText={setPieceOccasion} placeholder="Weekend dinner, office, everyday…" maxLength={120} />
                  </Field>
                  <Field label="Direction" index={nextIndex()}>
                    <ChipGroup options={PIECE_DIRECTIONS} selected={pieceDirection ? [pieceDirection] : []} onToggle={(value) => setPieceDirection(value === pieceDirection ? '' : value)} />
                  </Field>
                </>
              ) : null}

              {kind === 'trip' ? (
                <>
                  <Field label="Destination" index={nextIndex()} pulse={pulseFor('destination')} onY={trackY('destination')}>
                    <UnderlineInput serif flagged={flagged === 'destination'} value={destination} onChangeText={setDestination} placeholder="Tokyo, Japan" maxLength={160} />
                  </Field>
                  <Field label="Dates" index={nextIndex()} pulse={pulseFor('dates')} onY={trackY('dates')}>
                    <View style={[styles.dateRow, flagged === 'dates' && styles.inputActive]}>
                      <TouchableOpacity
                        style={styles.dateHalf}
                        onPress={() => openDatePicker('start')}
                        accessibilityRole="button"
                        accessibilityLabel={span ? `Departure, ${span.range.split(' → ')[0]}. Change` : 'Choose departure date'}
                      >
                        <Text style={[styles.dateText, !startDate && styles.placeholder]} numberOfLines={1}>
                          {span?.range.split(' → ')[0] ?? 'Departure'}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.dateArrow}>→</Text>
                      <TouchableOpacity
                        style={[styles.dateHalf, styles.dateHalfEnd]}
                        onPress={() => openDatePicker('end')}
                        accessibilityRole="button"
                        accessibilityLabel={endDate && span ? `Return, ${span.range.split(' → ')[1]}. Change` : 'Choose return date'}
                      >
                        <Text style={[styles.dateText, !endDate && styles.placeholder]} numberOfLines={1}>
                          {(endDate && span?.range.split(' → ')[1]) || 'Return'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {span?.nights ? <Text style={styles.dateCaption}>{span.nights}</Text> : null}
                  </Field>
                  <Field label="Kind of trip" index={nextIndex()}>
                    <ChipGroup multi options={TRIP_TYPE_OPTIONS} selected={tripTypes} onToggle={(value) => setTripTypes((current) => (toggle(current, value) as TripType[]).slice(0, 4))} />
                  </Field>
                  <Field label="Plans" index={nextIndex()}>
                    <UnderlineInput value={plans} onChangeText={setPlans} placeholder="Walking, dinners, meetings, beach…" maxLength={500} />
                  </Field>
                  <Field label="Luggage" index={nextIndex()}>
                    <ChipGroup
                      options={LUGGAGE_OPTIONS}
                      selected={luggage === 'not_sure' ? [] : [luggage]}
                      onToggle={(value) => setLuggage(value === luggage ? 'not_sure' : value as typeof luggage)}
                    />
                  </Field>
                  <Field label="Dressy evenings" index={nextIndex()}>
                    <ChipGroup
                      options={EVENING_OPTIONS}
                      selected={dressyEvenings == null ? [] : [String(Math.min(dressyEvenings, 3))]}
                      onToggle={(value) => setDressyEvenings((current) => (current != null && String(Math.min(current, 3)) === value ? null : Number(value)))}
                    />
                  </Field>
                  <Field label="Laundry" index={nextIndex()}>
                    <ChipGroup
                      options={LAUNDRY_OPTIONS}
                      selected={laundry == null ? [] : [laundry ? 'yes' : 'no']}
                      onToggle={(value) => setLaundry((current) => (current != null && (current ? 'yes' : 'no') === value ? null : value === 'yes'))}
                    />
                  </Field>
                </>
              ) : null}

              {kind === 'wardrobe_build' ? (
                <>
                  <Field label="What do you dress for?" index={nextIndex()} pulse={pulseFor('lifestyle')} onY={trackY('lifestyle')}>
                    <ChipGroup multi options={OCCASION_OPTIONS} selected={lifestyle} onToggle={(value) => setLifestyle((current) => toggle(current, value))} />
                  </Field>
                  <Field label="Style direction" index={nextIndex()}>
                    <ChipGroup multi options={STYLE_OPTIONS} selected={styleDirection} onToggle={(value) => setStyleDirection((current) => toggle(current, value))} />
                  </Field>
                  <Field label="Budget" index={nextIndex()}>
                    <ChipGroup multi options={BUDGET_OPTIONS} selected={budget} onToggle={(value) => setBudget((current) => toggle(current, value))} />
                  </Field>
                </>
              ) : null}

              <Field label="Anything else?" index={nextIndex()}>
                <UnderlineInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Comfort, fit, colour, or other context"
                  style={styles.notesInput}
                  multiline
                  maxLength={500}
                />
              </Field>
            </ScrollView>

            <View style={styles.footer}>
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(246,245,242,0)', colors.background]}
                style={styles.footerFade}
              />
              <TouchableOpacity
                style={[styles.submitButton, !ready && styles.submitDisabled]}
                activeOpacity={ready ? 0.85 : 1}
                onPress={handleSubmit}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready }}
                accessibilityHint={validationError ?? undefined}
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
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.page, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  headerCopy: { flex: 1 },
  eyebrow: { ...typography.text.masthead, color: colors.inkSubtle },
  title: { ...typography.text.editorialSheet, color: colors.foreground, marginTop: spacing.sm },
  rule: { width: 24, height: stroke.hairline, backgroundColor: colors.foreground, opacity: 0.35, marginTop: spacing.md },
  prompt: { ...typography.text.editorialItalic, color: colors.mutedForeground, marginTop: spacing.md },
  closeButton: { width: 44, height: 44, marginTop: -spacing.sm, marginRight: -spacing.md, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  content: { paddingHorizontal: spacing.page, paddingTop: spacing.xs, paddingBottom: spacing.xxl, gap: spacing.xxl },
  field: { gap: spacing.md },
  fieldLabel: { ...typography.text.eyebrow, color: colors.inkSubtle },
  input: {
    paddingHorizontal: 0,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: colors.controlOutline,
    color: colors.foreground,
  },
  inputSerif: {
    ...typography.text.editorialBody,
    fontWeight: undefined,
    lineHeight: typography.inputLineHeight(typography.text.editorialBody.fontSize),
    minHeight: 40,
  },
  inputSans: {
    ...typography.text.body,
    lineHeight: typography.inputLineHeight(typography.text.body.fontSize),
    minHeight: 36,
  },
  inputActive: { borderBottomColor: colors.foreground, borderBottomWidth: stroke.fine },
  notesInput: { lineHeight: typography.text.body.lineHeight, maxHeight: 4 * typography.text.body.lineHeight + spacing.md, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    height: 36,
    borderRadius: 18,
    borderWidth: stroke.fine,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chipText: { ...typography.text.bodySmall, fontWeight: typography.weight.medium, color: colors.foreground },
  chipTextSelected: { color: colors.primaryForeground },
  pieceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  pieceFrame: { width: 88, height: 110, borderRadius: radii.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pieceFrameEmpty: { borderWidth: stroke.fine, borderStyle: 'dashed', borderColor: colors.controlOutline },
  pieceFrameFilled: { backgroundColor: colors.imageMat },
  pieceFrameFlagged: { borderColor: colors.foreground },
  pieceImage: { width: '86%', height: '86%' },
  pieceImageCover: { width: '100%', height: '100%' },
  pieceCopy: { flex: 1, gap: spacing.xs },
  pieceTitle: { ...typography.text.editorialCard, color: colors.foreground },
  pieceCaption: { ...typography.text.caption, color: colors.mutedForeground },
  textAction: { ...typography.text.bodySmall, color: colors.action, textDecorationLine: 'underline', marginTop: spacing.xs },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: stroke.hairline,
    borderBottomColor: colors.controlOutline,
  },
  dateHalf: { flex: 1, paddingTop: spacing.xs, paddingBottom: spacing.sm, minHeight: 44, justifyContent: 'center' },
  dateHalfEnd: { alignItems: 'flex-end' },
  dateText: { ...typography.text.editorialBodyCompact, color: colors.foreground, fontVariant: ['tabular-nums'] },
  dateArrow: { ...typography.text.body, color: colors.mutedForeground, paddingHorizontal: spacing.md },
  dateCaption: { ...typography.text.caption, color: colors.mutedForeground },
  placeholder: { color: colors.mutedForeground },
  footer: { paddingHorizontal: spacing.page, paddingTop: spacing.sm },
  footerFade: { position: 'absolute', left: 0, right: 0, top: -spacing.xl, height: spacing.xl },
  submitButton: { minHeight: 54, borderRadius: radii.lg, borderCurve: 'continuous', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  submitDisabled: { opacity: 0.35 },
  submitText: { ...typography.text.body, color: colors.primaryForeground, fontWeight: typography.weight.semibold },
});
