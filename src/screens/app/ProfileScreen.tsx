import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { compressImageToDataUrl } from '../../lib/compressImage';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { api } from '../../lib/api';
import { colors, spacing, typography, radii } from '../../theme';
import type { ProfileScreenProps } from '../../navigation/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLE_OPTIONS = [
  'minimalist', 'classic', 'casual', 'trendy',
  'bohemian', 'edgy', 'streetwear', 'athleisure', 'smart casual',
] as const;

const PALETTE_OPTIONS = ['neutral', 'earthy', 'monochrome', 'pastels', 'jewel', 'bright'] as const;

const PALETTE_COLORS: Record<string, string[]> = {
  neutral:    ['#F5F0E8', '#C8BAA8', '#9E8E7E', '#6B5B4E', '#2C2420'],
  earthy:     ['#8B5E3C', '#C47A45', '#D4A853', '#7A8C50', '#5C4A3A'],
  monochrome: ['#FFFFFF', '#D1D1D1', '#888888', '#444444', '#111111'],
  pastels:    ['#F9D4D8', '#D5C5F0', '#C5E8D0', '#FAD7B5', '#B5D5F0'],
  jewel:      ['#15803D', '#1D4ED8', '#B91C1C', '#7E22CE', '#D97706'],
  bright:     ['#EF4444', '#EAB308', '#3B82F6', '#F97316', '#22C55E'],
};

const BUDGET_OPTIONS = [
  { value: 'value_thrift',      label: 'Value / Thrift ($)' },
  { value: 'contemporary_mid',  label: 'Contemporary ($$)' },
  { value: 'premium',           label: 'Premium ($$$)' },
  { value: 'luxury_high_end',   label: 'Luxury ($$$$)' },
];

const BODY_TYPES = [
  { value: 'slim_fit',          label: 'Slim Fit' },
  { value: 'athletic_tailored', label: 'Athletic / Tailored' },
  { value: 'regular_average',   label: 'Regular / Average' },
  { value: 'relaxed_broad',     label: 'Relaxed / Broad' },
];

const OCCASION_OPTIONS = [
  { value: 'work_office',     label: 'Work / Office' },
  { value: 'casual_weekend',  label: 'Casual / Weekend' },
  { value: 'date_night',      label: 'Date Night' },
  { value: 'formal_events',   label: 'Formal / Events' },
  { value: 'athletic_active', label: 'Athletic / Active' },
  { value: 'travel',          label: 'Travel' },
];

const FIT_PREFERENCE_OPTIONS = [
  { value: 'masculine_cut', label: "Men's / Masc." },
  { value: 'feminine_cut',  label: "Women's / Fem." },
  { value: 'neutral_fluid', label: 'Unisex / Fluid' },
];

const SIZING_REGION_OPTIONS = [
  { value: 'US', label: 'US' },
  { value: 'UK', label: 'UK' },
  { value: 'EU', label: 'EU' },
];

const TOP_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const STYLIST_VOICES = [
  { value: 'alloy',   label: 'Alloy',   description: 'Balanced & neutral' },
  { value: 'echo',    label: 'Echo',    description: 'Calm & reflective' },
  { value: 'fable',   label: 'Fable',   description: 'Warm & storytelling' },
  { value: 'onyx',    label: 'Onyx',    description: 'Deep & grounded' },
  { value: 'nova',    label: 'Nova',    description: 'Bright & upbeat' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft & breezy' },
];

const JACKET_LENGTH_OPTIONS = [
  { value: 'S', label: 'Short (S)' },
  { value: 'R', label: 'Regular (R)' },
  { value: 'L', label: 'Long (L)' },
];

// ── Size option generators ────────────────────────────────────────────────────

type Opt = { value: string; label: string };

function getShoeOptions(fit: string, region: string): Opt[] {
  const isFem = fit === 'feminine_cut';
  if (region === 'EU') {
    const [s, e] = isFem ? [35, 43] : [38, 50];
    return Array.from({ length: e - s + 1 }, (_, i) => { const n = `EU ${s + i}`; return { value: n, label: n }; });
  }
  if (region === 'UK') {
    const [s, e] = isFem ? [2.5, 9.5] : [5.5, 14.5];
    const steps = Math.round((e - s) / 0.5) + 1;
    return Array.from({ length: steps }, (_, i) => {
      const n = s + i * 0.5;
      const str = `UK ${Number.isInteger(n) ? n : n.toFixed(1)}`;
      return { value: str, label: str };
    });
  }
  const [s, e] = isFem ? [5, 12] : [6, 15];
  const steps = Math.round((e - s) / 0.5) + 1;
  return Array.from({ length: steps }, (_, i) => {
    const n = s + i * 0.5;
    const str = `US ${Number.isInteger(n) ? n : n.toFixed(1)}`;
    return { value: str, label: str };
  });
}

function getWaistOptions(region: string): Opt[] {
  if (region === 'EU')
    return Array.from({ length: 22 }, (_, i) => { const cm = 70 + i * 2; return { value: String(cm), label: `${cm} cm` }; });
  return Array.from({ length: 17 }, (_, i) => { const n = 28 + i; return { value: String(n), label: `${n}"` }; });
}

function getInseamOptions(region: string): Opt[] {
  if (region === 'EU')
    return Array.from({ length: 12 }, (_, i) => { const cm = 70 + i * 2; return { value: String(cm), label: `${cm} cm` }; });
  return Array.from({ length: 9 }, (_, i) => { const n = 28 + i; return { value: String(n), label: `${n}"` }; });
}

function getDressSizeOptions(region: string): Opt[] {
  if (region === 'UK') return Array.from({ length: 10 }, (_, i) => { const s = `UK ${4 + i * 2}`; return { value: s, label: s }; });
  if (region === 'EU') return Array.from({ length: 10 }, (_, i) => { const s = `EU ${32 + i * 2}`; return { value: s, label: s }; });
  return Array.from({ length: 10 }, (_, i) => { const s = `US ${i * 2}`; return { value: s, label: s }; });
}

function getSuitJacketOptions(region: string): Opt[] {
  if (region === 'EU')
    return Array.from({ length: 10 }, (_, i) => { const n = 44 + i * 2; return { value: String(n), label: `EU ${n}` }; });
  return Array.from({ length: 10 }, (_, i) => { const n = 34 + i * 2; return { value: String(n), label: String(n) }; });
}

function getBodyMeasurementOptions(region: string): Opt[] {
  if (region === 'EU')
    return Array.from({ length: 91 }, (_, i) => { const n = 60 + i; return { value: `${n} cm`, label: `${n} cm` }; });
  return Array.from({ length: 37 }, (_, i) => { const n = 24 + i; return { value: `${n} in`, label: `${n} in` }; });
}

function getHeightCmOptions(): Opt[] {
  return Array.from({ length: 101 }, (_, i) => { const n = 120 + i; return { value: `${n} cm`, label: `${n} cm` }; });
}

const HEIGHT_FEET_OPTS: Opt[] = ['4', '5', '6', '7'].map((f) => ({ value: f, label: `${f} ft` }));
const HEIGHT_INCH_OPTS: Opt[] = Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i} in` }));

// ── PickerModal ───────────────────────────────────────────────────────────────

const PICKER_ITEM_H = 50;

function PickerModal({
  visible, title, options, value, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  options: Opt[];
  value: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const selectedIdx = options.findIndex((o) => o.value === value);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pm.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[pm.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={pm.handle} />
        <View style={pm.header}>
          <Text style={pm.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={pm.doneBtn}>
            <Text style={pm.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          getItemLayout={(_d, idx) => ({ length: PICKER_ITEM_H, offset: PICKER_ITEM_H * idx, index: idx })}
          initialScrollIndex={selectedIdx > 0 ? selectedIdx : 0}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={pm.row}
              onPress={() => { onSelect(item.value); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[pm.rowLabel, item.value === value && pm.rowLabelSel]}>{item.label}</Text>
              {item.value === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={pm.sep} />}
        />
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    maxHeight: '70%',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center',
    marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title:   { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.foreground },
  doneBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  doneText:{ fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, height: PICKER_ITEM_H },
  rowLabel:{ fontSize: typography.size.sm, color: colors.foreground },
  rowLabelSel: { color: colors.primary, fontWeight: typography.weight.semibold },
  sep:     { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
});

// ── SectionCard ───────────────────────────────────────────────────────────────

function SectionCard({ icon, label, children }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sc.card}>
      <View style={sc.heading}>
        <Ionicons name={icon} size={13} color={colors.primary} />
        <Text style={sc.label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: spacing.lg, marginBottom: spacing.lg,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: {
    fontSize: 10, fontWeight: typography.weight.bold,
    color: colors.mutedForeground, letterSpacing: 1.2, textTransform: 'uppercase',
  },
});

// ── SelectRow ─────────────────────────────────────────────────────────────────

function SelectRow({ label, value, placeholder, onPress }: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={sr.row} onPress={onPress} activeOpacity={0.7}>
      <View style={sr.inner}>
        {!!label && <Text style={sr.label}>{label}</Text>}
        <Text style={value ? sr.value : sr.placeholder}>{value || placeholder}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.border} />
    </TouchableOpacity>
  );
}

const sr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  inner:       { flex: 1, gap: 2 },
  label:       { fontSize: typography.size.xs, color: colors.mutedForeground },
  value:       { fontSize: typography.size.sm, color: colors.foreground, fontWeight: typography.weight.medium },
  placeholder: { fontSize: typography.size.sm, color: colors.mutedForeground },
});

// ── ProfileScreen ─────────────────────────────────────────────────────────────

type PickerKey = 'shoe' | 'waist' | 'inseam' | 'dress' | 'heightCm'
  | 'heightFt' | 'heightIn' | 'jacket' | 'jacketLen'
  | 'chest' | 'waistM' | 'hips';

export function ProfileScreen(_props: ProfileScreenProps) {
  const insets   = useSafeAreaInsets();
  const { user, logout }             = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile                = useUpdateProfile();

  // ── Form state ──────────────────────────────────────────────────────────
  const [displayName, setDisplayName]           = useState('');
  const [stylePreference, setStylePreference]   = useState<string[]>([]);
  const [colorPalette, setColorPalette]         = useState<string[]>([]);
  const [budgetRange, setBudgetRange]           = useState('');
  const [bodyType, setBodyType]                 = useState('');
  const [fitPreference, setFitPreference]       = useState('');
  const [sizingRegion, setSizingRegion]         = useState('');
  const [location, setLocation]                 = useState('');
  const [retailers, setRetailers]               = useState<string[]>([]);
  const [newRetailer, setNewRetailer]           = useState('');
  const [stylistVoice, setStylistVoice]         = useState('shimmer');
  const [tempUnit, setTempUnit]                 = useState<'F' | 'C' | 'auto'>('auto');
  const [occasions, setOccasions]               = useState<string[]>([]);
  const [fitNotes, setFitNotes]                 = useState('');
  const [sizeTop, setSizeTop]                   = useState('');
  const [sizeBottomWaist, setSizeBottomWaist]   = useState('');
  const [sizeBottomInseam, setSizeBottomInseam] = useState('');
  const [sizeDress, setSizeDress]               = useState('');
  const [sizeShoe, setSizeShoe]                 = useState('');
  const [sizeJacket, setSizeJacket]             = useState('');
  const [sizeJacketLength, setSizeJacketLength] = useState('');
  const [measurementChest, setMeasurementChest] = useState('');
  const [measurementWaistM, setMeasurementWaistM] = useState('');
  const [measurementHips, setMeasurementHips]   = useState('');
  const [measurementHeight, setMeasurementHeight] = useState('');
  const [measurementHeightFt, setMeasurementHeightFt] = useState('');
  const [measurementHeightIn, setMeasurementHeightIn] = useState('');
  const [showDressSize, setShowDressSize]       = useState(false);
  const [advancedOpen, setAdvancedOpen]         = useState(false);
  const [photoPreview, setPhotoPreview]         = useState<string | null>(null);

  // ── Password / delete ────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword]   = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  // ── Active picker ────────────────────────────────────────────────────────
  const [activePicker, setActivePicker] = useState<PickerKey | null>(null);

  // ── Dirty tracking ────────────────────────────────────────────────────────
  const initialValues = useRef<Record<string, unknown>>({});

  // ── Load profile into form ───────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;

    setPhotoPreview(profile.photoUrl ?? null);
    setDisplayName(profile.displayName ?? '');
    setStylePreference(profile.stylePreference ?? []);
    setColorPalette(profile.colorPalette ?? []);
    setBudgetRange(profile.budgetRange ?? '');
    setBodyType(profile.bodyType ?? '');
    setFitPreference(profile.fitPreference ?? '');
    setSizingRegion(profile.sizingRegion ?? '');
    setLocation(profile.location ?? '');
    setRetailers(profile.favoriteRetailers ?? []);
    setStylistVoice(profile.stylistVoice ?? 'shimmer');
    setTempUnit((profile.tempUnit as 'F' | 'C' | null) ?? 'auto');
    setOccasions(profile.occasions ?? []);
    setFitNotes(profile.fitNotes ?? '');
    setSizeTop(profile.sizeTop ?? '');

    const bottomParts = (profile.sizeBottom ?? '').match(/^(\d+)[x×](\d+)$/i);
    setSizeBottomWaist(bottomParts ? bottomParts[1] : '');
    setSizeBottomInseam(bottomParts ? bottomParts[2] : '');

    setSizeDress(profile.sizeDress ?? '');
    if (profile.sizeDress) setShowDressSize(true);
    setSizeShoe(profile.sizeShoe ?? '');

    const jkt = profile.suitJacket ?? '';
    if (jkt && /[SRL]$/.test(jkt)) {
      setSizeJacket(jkt.slice(0, -1));
      setSizeJacketLength(jkt.slice(-1));
    } else {
      setSizeJacket(jkt);
      setSizeJacketLength('');
    }

    setMeasurementChest(profile.measurementChest ?? '');
    setMeasurementWaistM(profile.measurementWaist ?? '');
    setMeasurementHips(profile.measurementHips ?? '');

    const ht = profile.measurementHeight ?? '';
    const ftMatch = ht.match(/^(\d+)'(\d+)"?$/);
    if (ftMatch) {
      setMeasurementHeightFt(ftMatch[1]);
      setMeasurementHeightIn(ftMatch[2]);
      setMeasurementHeight('');
    } else {
      setMeasurementHeight(ht);
      setMeasurementHeightFt('');
      setMeasurementHeightIn('');
    }

    initialValues.current = {
      photoUrl: profile.photoUrl ?? null,
      displayName: profile.displayName ?? '',
      stylePreference: JSON.stringify(profile.stylePreference ?? []),
      colorPalette: JSON.stringify(profile.colorPalette ?? []),
      budgetRange: profile.budgetRange ?? '',
      bodyType: profile.bodyType ?? '',
      fitPreference: profile.fitPreference ?? '',
      sizingRegion: profile.sizingRegion ?? '',
      location: profile.location ?? '',
      retailers: JSON.stringify(profile.favoriteRetailers ?? []),
      stylistVoice: profile.stylistVoice ?? 'shimmer',
      tempUnit: (profile.tempUnit as 'F' | 'C' | null) ?? 'auto',
      occasions: JSON.stringify(profile.occasions ?? []),
      fitNotes: profile.fitNotes ?? '',
      sizeTop: profile.sizeTop ?? '',
      sizeBottomWaist: bottomParts ? bottomParts[1] : '',
      sizeBottomInseam: bottomParts ? bottomParts[2] : '',
      sizeDress: profile.sizeDress ?? '',
      sizeShoe: profile.sizeShoe ?? '',
      sizeJacket: jkt && /[SRL]$/.test(jkt) ? jkt.slice(0, -1) : jkt,
      sizeJacketLength: jkt && /[SRL]$/.test(jkt) ? jkt.slice(-1) : '',
      measurementChest: profile.measurementChest ?? '',
      measurementWaistM: profile.measurementWaist ?? '',
      measurementHips: profile.measurementHips ?? '',
      measurementHeight: ftMatch ? '' : ht,
      measurementHeightFt: ftMatch ? ftMatch[1] : '',
      measurementHeightIn: ftMatch ? ftMatch[2] : '',
    };
  }, [profile]);

  // ── Completion % ─────────────────────────────────────────────────────────
  const completionPct = useMemo(() => {
    const fields = [
      !!displayName.trim(), !!fitPreference,
      stylePreference.length > 0, colorPalette.length > 0,
      occasions.length > 0, !!budgetRange, !!sizeTop, !!location,
      retailers.length > 0, !!fitNotes.trim(),
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [displayName, fitPreference, stylePreference, colorPalette, occasions, budgetRange, sizeTop, location, retailers, fitNotes]);

  // ── Dirty check ───────────────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    const iv = initialValues.current;
    if (!Object.prototype.hasOwnProperty.call(iv, 'displayName')) return false;
    return (
      photoPreview !== iv.photoUrl ||
      displayName !== iv.displayName ||
      JSON.stringify(stylePreference) !== iv.stylePreference ||
      JSON.stringify(colorPalette) !== iv.colorPalette ||
      budgetRange !== iv.budgetRange || bodyType !== iv.bodyType ||
      fitPreference !== iv.fitPreference || sizingRegion !== iv.sizingRegion ||
      location !== iv.location || JSON.stringify(retailers) !== iv.retailers ||
      stylistVoice !== iv.stylistVoice || tempUnit !== iv.tempUnit ||
      JSON.stringify(occasions) !== iv.occasions || fitNotes !== iv.fitNotes ||
      sizeTop !== iv.sizeTop || sizeBottomWaist !== iv.sizeBottomWaist ||
      sizeBottomInseam !== iv.sizeBottomInseam || sizeDress !== iv.sizeDress ||
      sizeShoe !== iv.sizeShoe || sizeJacket !== iv.sizeJacket ||
      sizeJacketLength !== iv.sizeJacketLength ||
      measurementChest !== iv.measurementChest ||
      measurementWaistM !== iv.measurementWaistM ||
      measurementHips !== iv.measurementHips ||
      measurementHeight !== iv.measurementHeight ||
      measurementHeightFt !== iv.measurementHeightFt ||
      measurementHeightIn !== iv.measurementHeightIn
    );
  }, [
    photoPreview, displayName, stylePreference, colorPalette, budgetRange, bodyType,
    fitPreference, sizingRegion, location, retailers, stylistVoice, tempUnit,
    occasions, fitNotes, sizeTop, sizeBottomWaist, sizeBottomInseam, sizeDress,
    sizeShoe, sizeJacket, sizeJacketLength, measurementChest, measurementWaistM,
    measurementHips, measurementHeight, measurementHeightFt, measurementHeightIn,
  ]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = () => {
    updateProfile.mutate(
      {
        photoUrl: photoPreview || null,
        displayName: displayName.trim() || null,
        stylePreference: stylePreference.length > 0 ? stylePreference : null,
        colorPalette: colorPalette.length > 0 ? colorPalette : null,
        budgetRange: budgetRange || null,
        bodyType: bodyType || null,
        fitPreference: fitPreference || null,
        sizingRegion: sizingRegion || null,
        location: location || null,
        favoriteRetailers: retailers.length > 0 ? retailers : null,
        stylistVoice: stylistVoice || null,
        tempUnit: tempUnit === 'auto' ? null : tempUnit,
        occasions: occasions.length > 0 ? occasions : null,
        fitNotes: fitNotes.trim() || null,
        sizeTop: sizeTop || null,
        sizeBottom: sizeBottomWaist && sizeBottomInseam
          ? `${sizeBottomWaist}x${sizeBottomInseam}`
          : sizeBottomWaist || null,
        sizeDress: sizeDress || null,
        sizeShoe: sizeShoe || null,
        suitJacket: sizeJacket
          ? sizingRegion !== 'EU' && fitPreference !== 'feminine_cut' && sizeJacketLength
            ? `${sizeJacket}${sizeJacketLength}`
            : sizeJacket
          : null,
        measurementChest: measurementChest || null,
        measurementWaist: measurementWaistM || null,
        measurementHips: measurementHips || null,
        measurementInseam: null,
        measurementHeight: sizingRegion === 'EU'
          ? measurementHeight || null
          : measurementHeightFt && measurementHeightIn !== ''
            ? `${measurementHeightFt}'${measurementHeightIn}"`
            : measurementHeightFt || null,
      },
      {
        onSuccess: () => {
          Alert.alert('Saved', 'Profile updated successfully.');
          initialValues.current = {
            photoUrl: photoPreview,
            displayName, stylePreference: JSON.stringify(stylePreference),
            colorPalette: JSON.stringify(colorPalette), budgetRange, bodyType,
            fitPreference, sizingRegion, location, retailers: JSON.stringify(retailers),
            stylistVoice, tempUnit, occasions: JSON.stringify(occasions), fitNotes,
            sizeTop, sizeBottomWaist, sizeBottomInseam, sizeDress, sizeShoe,
            sizeJacket, sizeJacketLength, measurementChest, measurementWaistM,
            measurementHips, measurementHeight, measurementHeightFt, measurementHeightIn,
          };
        },
        onError: (err: Error) => Alert.alert('Error', err.message),
      }
    );
  };

  // ── Photo pick ───────────────────────────────────────────────────────────
  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const { dataUrl } = await compressImageToDataUrl(result.assets[0]);
      setPhotoPreview(dataUrl);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const changePasswordMutation = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post('/api/auth/change-password', body),
    onSuccess: () => {
      Alert.alert('Updated', 'Your password has been changed.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const handleChangePassword = () => {
    if (newPassword.length < 8) { Alert.alert('Too short', 'New password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert("Doesn't match", 'New password and confirmation must match.'); return; }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  // ── Delete account ────────────────────────────────────────────────────────
  const deleteAccountMutation = useMutation({
    mutationFn: (password?: string) =>
      api.delete('/api/auth/account', { data: password ? { password } : {} }),
    onSuccess: () => logout(),
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  // ── Retailers ─────────────────────────────────────────────────────────────
  const addRetailer = () => {
    const t = newRetailer.trim();
    if (t && !retailers.includes(t)) setRetailers([...retailers, t]);
    setNewRetailer('');
  };

  // ── Initials ──────────────────────────────────────────────────────────────
  const initials = (displayName.trim() || user?.displayName?.trim() || 'ME')
    .split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  // ── Picker config ─────────────────────────────────────────────────────────
  const pickerCfg: Record<PickerKey, { title: string; options: Opt[]; value: string; onSelect: (v: string) => void }> = {
    shoe:      { title: 'Shoe Size',          options: getShoeOptions(fitPreference, sizingRegion), value: sizeShoe,          onSelect: setSizeShoe },
    waist:     { title: 'Waist',              options: getWaistOptions(sizingRegion),               value: sizeBottomWaist,   onSelect: setSizeBottomWaist },
    inseam:    { title: 'Inseam',             options: getInseamOptions(sizingRegion),              value: sizeBottomInseam,  onSelect: setSizeBottomInseam },
    dress:     { title: 'Dress Size',         options: getDressSizeOptions(sizingRegion),           value: sizeDress,         onSelect: setSizeDress },
    heightCm:  { title: 'Height (cm)',        options: getHeightCmOptions(),                        value: measurementHeight, onSelect: setMeasurementHeight },
    heightFt:  { title: 'Height — Feet',      options: HEIGHT_FEET_OPTS,                            value: measurementHeightFt, onSelect: setMeasurementHeightFt },
    heightIn:  { title: 'Height — Inches',    options: HEIGHT_INCH_OPTS,                            value: measurementHeightIn, onSelect: setMeasurementHeightIn },
    jacket:    { title: 'Jacket / Blazer',    options: getSuitJacketOptions(sizingRegion),          value: sizeJacket,        onSelect: setSizeJacket },
    jacketLen: { title: 'Jacket Length',      options: JACKET_LENGTH_OPTIONS,                       value: sizeJacketLength,  onSelect: setSizeJacketLength },
    chest:     { title: 'Chest',              options: getBodyMeasurementOptions(sizingRegion),     value: measurementChest,  onSelect: setMeasurementChest },
    waistM:    { title: 'Waist Measurement',  options: getBodyMeasurementOptions(sizingRegion),     value: measurementWaistM, onSelect: setMeasurementWaistM },
    hips:      { title: 'Hips',               options: getBodyMeasurementOptions(sizingRegion),     value: measurementHips,   onSelect: setMeasurementHips },
  };

  const activeCfg = activePicker ? pickerCfg[activePicker] : null;

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading || !profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >

      {/* ── Fixed header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.avatar} onPress={handlePickPhoto} activeOpacity={0.8}>
          {photoPreview
            ? <Image source={{ uri: photoPreview }} style={styles.avatarPhoto} />
            : <Text style={styles.avatarText}>{initials}</Text>}
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={9} color={colors.white} />
          </View>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Style Profile</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completionPct}%` as any }]} />
          </View>
          <Text style={styles.progressLabel}>{completionPct}% complete</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, isDirty && styles.saveBtnActive]}
          onPress={handleSave}
          disabled={updateProfile.isPending || !isDirty}
          activeOpacity={0.8}
        >
          {updateProfile.isPending
            ? <ActivityIndicator size="small" color={isDirty ? colors.primaryForeground : colors.mutedForeground} />
            : <Text style={[styles.saveBtnText, isDirty && styles.saveBtnTextActive]}>Save</Text>}
        </TouchableOpacity>
      </View>

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl * 2 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ─────────────────── Section 1: Identity ──────────────────────── */}
        <SectionCard icon="person-outline" label="YOUR IDENTITY">

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Alex"
              placeholderTextColor={colors.mutedForeground}
              maxLength={80}
            />
            <Text style={styles.hint}>How your stylist addresses you.</Text>
          </View>

          {/* Fit Preference */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Fit Preference</Text>
            <View style={styles.pillRow}>
              {FIT_PREFERENCE_OPTIONS.map((opt) => {
                const sel = fitPreference === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.pill, sel && styles.pillSel]}
                    onPress={() => { setFitPreference(opt.value); setSizeShoe(''); setSizeDress(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, sel && styles.pillTextSel]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Sizing Region */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Sizing Region</Text>
            <View style={styles.pillRow}>
              {SIZING_REGION_OPTIONS.map((opt) => {
                const sel = sizingRegion === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.pill, sel && styles.pillSel]}
                    onPress={() => {
                      setSizingRegion(opt.value);
                      setSizeTop(''); setSizeShoe(''); setSizeBottomWaist(''); setSizeBottomInseam('');
                      setSizeDress(''); setSizeJacket(''); setSizeJacketLength('');
                      setMeasurementChest(''); setMeasurementWaistM(''); setMeasurementHips('');
                      setMeasurementHeight(''); setMeasurementHeightFt(''); setMeasurementHeightIn('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, sel && styles.pillTextSel]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Style Preference */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Style Preference{'  '}
              <Text style={styles.hint}>up to 3</Text>
            </Text>
            <View style={styles.chipWrap}>
              {STYLE_OPTIONS.map((s) => {
                const sel = stylePreference.includes(s);
                const atMax = stylePreference.length >= 3;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, sel && styles.chipSel, !sel && atMax && styles.chipDim]}
                    onPress={() => {
                      if (sel) setStylePreference(stylePreference.filter((x) => x !== s));
                      else if (!atMax) setStylePreference([...stylePreference, s]);
                    }}
                    disabled={!sel && atMax}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSel]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Color Palette */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Color Palette</Text>
            <View style={styles.paletteRow}>
              {PALETTE_OPTIONS.map((p) => {
                const sel = colorPalette.includes(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={styles.paletteItem}
                    onPress={() => {
                      if (sel) setColorPalette(colorPalette.filter((x) => x !== p));
                      else setColorPalette([...colorPalette, p]);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.swatchRing, sel && styles.swatchRingSel]}>
                      <View style={styles.swatchInner}>
                        {(PALETTE_COLORS[p] ?? []).map((color, i) => (
                          <View key={i} style={[styles.swatchSeg, { backgroundColor: color }]} />
                        ))}
                      </View>
                    </View>
                    <Text style={[styles.paletteLabel, sel && styles.paletteLabelSel]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Budget */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Budget</Text>
            <View style={styles.chipWrap}>
              {BUDGET_OPTIONS.map((opt) => {
                const sel = budgetRange === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, sel && styles.chipSel]}
                    onPress={() => setBudgetRange(sel ? '' : opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSel]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Fit Profile */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Fit Profile</Text>
            <View style={styles.chipWrap}>
              {BODY_TYPES.map((opt) => {
                const sel = bodyType === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, sel && styles.chipSel]}
                    onPress={() => setBodyType(sel ? '' : opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSel]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Occasions */}
          <View style={[styles.field, styles.divTop]}>
            <Text style={styles.fieldLabel}>Occasions</Text>
            <Text style={styles.hint}>What do you typically dress for?</Text>
            <View style={[styles.chipWrap, { marginTop: spacing.sm }]}>
              {OCCASION_OPTIONS.map((opt) => {
                const sel = occasions.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, sel && styles.chipSel]}
                    onPress={() => {
                      if (sel) setOccasions(occasions.filter((x) => x !== opt.value));
                      else setOccasions([...occasions, opt.value]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSel]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </SectionCard>

        {/* ─────────────────── Section 2: Your Size ─────────────────────── */}
        <SectionCard icon="resize-outline" label="YOUR SIZE">
          <Text style={[styles.hint, { marginTop: -spacing.sm }]}>All optional. Helps suggest pieces in your size.</Text>

          {/* Top */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Top</Text>
            <View style={styles.pillRow}>
              {TOP_SIZES.map((s) => {
                const sel = sizeTop === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.pill, sel && styles.pillSel]}
                    onPress={() => setSizeTop(sel ? '' : s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, sel && styles.pillTextSel]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Shoe */}
          <SelectRow
            label="Shoe"
            value={sizeShoe}
            placeholder="Select size"
            onPress={() => setActivePicker('shoe')}
          />

          {/* Waist + Inseam */}
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <SelectRow
                label={`Waist ${sizingRegion === 'EU' ? '(cm)' : '(in)'}`}
                value={sizeBottomWaist ? (sizingRegion === 'EU' ? `${sizeBottomWaist} cm` : `${sizeBottomWaist}"`) : ''}
                placeholder="Waist"
                onPress={() => setActivePicker('waist')}
              />
            </View>
            <View style={styles.twoColDivider} />
            <View style={{ flex: 1 }}>
              <SelectRow
                label={`Inseam ${sizingRegion === 'EU' ? '(cm)' : '(in)'}`}
                value={sizeBottomInseam ? (sizingRegion === 'EU' ? `${sizeBottomInseam} cm` : `${sizeBottomInseam}"`) : ''}
                placeholder="Inseam"
                onPress={() => setActivePicker('inseam')}
              />
            </View>
          </View>

          {/* Dress */}
          {(fitPreference === 'feminine_cut' || showDressSize) ? (
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Dress</Text>
                {fitPreference !== 'feminine_cut' && (
                  <TouchableOpacity onPress={() => { setShowDressSize(false); setSizeDress(''); }}>
                    <Text style={styles.removeLink}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              <SelectRow label="" value={sizeDress} placeholder="Select dress size" onPress={() => setActivePicker('dress')} />
            </View>
          ) : (
            <TouchableOpacity style={styles.addLink} onPress={() => setShowDressSize(true)} activeOpacity={0.7}>
              <Ionicons name="add" size={14} color={colors.mutedForeground} />
              <Text style={styles.addLinkText}>Add dress size</Text>
            </TouchableOpacity>
          )}

          {/* Height */}
          <View style={[styles.field, styles.divTop]}>
            <Text style={styles.fieldLabel}>Height</Text>
            {sizingRegion === 'EU' ? (
              <SelectRow label="" value={measurementHeight} placeholder="Select height" onPress={() => setActivePicker('heightCm')} />
            ) : (
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <SelectRow
                    label="Feet"
                    value={measurementHeightFt ? `${measurementHeightFt} ft` : ''}
                    placeholder="Ft"
                    onPress={() => setActivePicker('heightFt')}
                  />
                </View>
                <View style={styles.twoColDivider} />
                <View style={{ flex: 1 }}>
                  <SelectRow
                    label="Inches"
                    value={measurementHeightIn !== '' ? `${measurementHeightIn} in` : ''}
                    placeholder="In"
                    onPress={() => setActivePicker('heightIn')}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Advanced measurements toggle */}
          <TouchableOpacity style={styles.advToggle} onPress={() => setAdvancedOpen((v) => !v)} activeOpacity={0.7}>
            <Ionicons name={advancedOpen ? 'chevron-down' : 'chevron-forward'} size={12} color={colors.mutedForeground} />
            <Text style={styles.advToggleText}>Advanced tailoring measurements</Text>
          </TouchableOpacity>

          {advancedOpen && (
            <View style={{ gap: spacing.xs }}>
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <SelectRow label="Jacket / Blazer" value={sizeJacket} placeholder="Size" onPress={() => setActivePicker('jacket')} />
                </View>
                {fitPreference !== 'feminine_cut' && (
                  <>
                    <View style={styles.twoColDivider} />
                    <View style={{ flex: 1 }}>
                      <SelectRow
                        label="Length"
                        value={JACKET_LENGTH_OPTIONS.find((o) => o.value === sizeJacketLength)?.label ?? ''}
                        placeholder="Length"
                        onPress={() => setActivePicker('jacketLen')}
                      />
                    </View>
                  </>
                )}
              </View>
              <SelectRow label={`Chest ${sizingRegion === 'EU' ? '(cm)' : '(in)'}`} value={measurementChest} placeholder="Chest" onPress={() => setActivePicker('chest')} />
              <SelectRow label={`Waist measure ${sizingRegion === 'EU' ? '(cm)' : '(in)'}`} value={measurementWaistM} placeholder="Waist" onPress={() => setActivePicker('waistM')} />
              <SelectRow label={`Hips ${sizingRegion === 'EU' ? '(cm)' : '(in)'}`} value={measurementHips} placeholder="Hips" onPress={() => setActivePicker('hips')} />
            </View>
          )}
        </SectionCard>

        {/* ─────────────────── Section 3: Preferences ───────────────────── */}
        <SectionCard icon="star-outline" label="PREFERENCES">

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Brooklyn, NY"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={styles.hint}>Used as a fallback for weather-based suggestions.</Text>
          </View>

          {/* Favorite Shops */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Favorite Shops</Text>
            <View style={styles.retailerInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newRetailer}
                onChangeText={setNewRetailer}
                placeholder="e.g. Madewell"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
                onSubmitEditing={addRetailer}
              />
              <TouchableOpacity style={styles.addBtn} onPress={addRetailer} activeOpacity={0.8}>
                <Ionicons name="add" size={20} color={colors.primaryForeground} />
              </TouchableOpacity>
            </View>
            {retailers.length > 0 && (
              <View style={styles.tagWrap}>
                {retailers.map((r) => (
                  <View key={r} style={styles.tag}>
                    <Text style={styles.tagText}>{r}</Text>
                    <TouchableOpacity
                      onPress={() => setRetailers(retailers.filter((x) => x !== r))}
                      style={styles.tagX}
                    >
                      <Ionicons name="close" size={11} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Temperature Units */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Temperature Units</Text>
            <View style={styles.segRow}>
              {(['auto', 'C', 'F'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.seg, tempUnit === opt && styles.segSel]}
                  onPress={() => setTempUnit(opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.segText, tempUnit === opt && styles.segTextSel]}>
                    {opt === 'auto' ? 'Auto' : `°${opt}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Stylist Voice */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Stylist Voice</Text>
            <Text style={styles.hint}>Voice used when reading outfit suggestions aloud.</Text>
            <View style={[styles.chipWrap, { marginTop: spacing.sm }]}>
              {STYLIST_VOICES.map((v) => {
                const sel = stylistVoice === v.value;
                return (
                  <TouchableOpacity
                    key={v.value}
                    style={[styles.voiceCard, sel && styles.voiceCardSel]}
                    onPress={() => setStylistVoice(v.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.voiceName, sel && styles.voiceNameSel]}>{v.label}</Text>
                    <Text style={styles.voiceDesc}>{v.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Fit Notes */}
          <View style={[styles.field, styles.divTop]}>
            <Text style={styles.fieldLabel}>Fit Notes</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={fitNotes}
              onChangeText={setFitNotes}
              placeholder="e.g. I prefer longer hemlines, or I run warm and like lighter fabrics…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={200}
            />
            <Text style={styles.hint}>{fitNotes.length}/200 — anything structured fields can't capture.</Text>
          </View>
        </SectionCard>

        {/* ─────────────────── Section 4: Account ───────────────────────── */}
        <SectionCard icon="settings-outline" label="ACCOUNT">

          {/* Change password (local auth only) */}
          {user?.authProvider === 'local' && (
            <View style={styles.field}>
              <Text style={styles.subTitle}>Security</Text>
              {user?.email && (
                <View style={styles.emailRow}>
                  <Text style={styles.emailKey}>Signed in as</Text>
                  <Text style={styles.emailVal}>{user.email}</Text>
                </View>
              )}
              <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" placeholderTextColor={colors.mutedForeground} secureTextEntry />
              <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={newPassword} onChangeText={setNewPassword} placeholder="New password (min. 8 characters)" placeholderTextColor={colors.mutedForeground} secureTextEntry />
              <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor={colors.mutedForeground} secureTextEntry />
              <TouchableOpacity
                style={[styles.outlineBtn, { marginTop: spacing.md }]}
                onPress={handleChangePassword}
                disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                activeOpacity={0.8}
              >
                {changePasswordMutation.isPending
                  ? <ActivityIndicator size="small" color={colors.foreground} />
                  : <Text style={styles.outlineBtnText}>Update password</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Sign out */}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => Alert.alert('Sign out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => logout() },
            ])}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>

          {/* Danger zone */}
          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>Danger Zone</Text>
            <Text style={styles.hint}>Permanently delete your account and all wardrobe data. This cannot be undone.</Text>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteModalVisible(true)} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.deleteBtnText}>Delete my account</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>
      </ScrollView>

      {/* ── Picker sheet ──────────────────────────────────────────────────── */}
      {activeCfg && (
        <PickerModal
          visible
          title={activeCfg.title}
          options={activeCfg.options}
          value={activeCfg.value}
          onSelect={activeCfg.onSelect}
          onClose={() => setActivePicker(null)}
        />
      )}

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setDeleteModalVisible(false); setDeletePassword(''); }}
      >
        <KeyboardAvoidingView style={dm.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={dm.card}>
            <Text style={dm.title}>Delete account?</Text>
            <Text style={dm.body}>
              This will permanently erase your profile, wardrobe, outfits, and events.
              There is no way to recover this data.
            </Text>
            {user?.authProvider === 'local' && (
              <TextInput
                style={[styles.input, { marginTop: spacing.md }]}
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Confirm with your password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
              />
            )}
            <View style={dm.actions}>
              <TouchableOpacity
                style={dm.cancelBtn}
                onPress={() => { setDeleteModalVisible(false); setDeletePassword(''); }}
                activeOpacity={0.7}
              >
                <Text style={dm.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dm.confirmBtn, (deleteAccountMutation.isPending) && { opacity: 0.6 }]}
                disabled={deleteAccountMutation.isPending || (user?.authProvider === 'local' && !deletePassword)}
                onPress={() => deleteAccountMutation.mutate(user?.authProvider === 'local' ? deletePassword : undefined)}
                activeOpacity={0.8}
              >
                {deleteAccountMutation.isPending
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={dm.confirmText}>Yes, delete everything</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  // Fixed header
  header: {
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 48, height: 48, borderRadius: radii.lg,
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarPhoto: { width: 48, height: 48, borderRadius: radii.lg },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.card,
  },
  avatarText:    { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.primary },
  headerInfo:    { flex: 1, gap: 4 },
  headerTitle:   { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.foreground },
  progressTrack: { height: 4, backgroundColor: colors.muted, borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: '100%' as any, backgroundColor: colors.primary, borderRadius: 2 },
  progressLabel: { fontSize: 10, color: colors.mutedForeground },
  saveBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radii.full, backgroundColor: colors.muted, minWidth: 56, alignItems: 'center',
  },
  saveBtnActive:     { backgroundColor: colors.primary },
  saveBtnText:       { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  saveBtnTextActive: { color: colors.primaryForeground },

  // Scroll
  scroll: { flex: 1 },

  // Fields
  field:    { gap: spacing.xs },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint:     { fontSize: typography.size.xs, color: colors.mutedForeground },
  divTop:   { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    fontSize: typography.size.sm, color: colors.foreground,
  },
  textarea: { minHeight: 76, textAlignVertical: 'top', paddingTop: spacing.sm },

  // Pills (horizontal, small set)
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pillSel:     { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText:    { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  pillTextSel: { color: colors.white },

  // Chips (multi-row wrap)
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSel:     { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDim:     { opacity: 0.35 },
  chipText:    { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium, textTransform: 'capitalize' },
  chipTextSel: { color: colors.white },

  // Palette swatches
  paletteRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  paletteItem:   { alignItems: 'center', gap: 4 },
  swatchRing:    { width: 46, height: 46, borderRadius: 23, padding: 2, borderWidth: 2.5, borderColor: 'transparent' },
  swatchRingSel: { borderColor: colors.primary },
  swatchInner:   { flex: 1, borderRadius: 20, overflow: 'hidden', flexDirection: 'row' },
  swatchSeg:     { flex: 1 },
  paletteLabel:    { fontSize: 10, color: colors.mutedForeground, textTransform: 'capitalize' },
  paletteLabelSel: { color: colors.primary, fontWeight: typography.weight.semibold },

  // Two-column size row
  twoCol:       { flexDirection: 'row', alignItems: 'stretch' },
  twoColDivider:{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },

  // Retailers
  retailerInputRow: { flexDirection: 'row', gap: spacing.sm },
  addBtn: {
    width: 42, height: 42, borderRadius: radii.md,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.secondary, borderRadius: radii.full,
    paddingLeft: spacing.md, paddingRight: spacing.xs + 2, paddingVertical: spacing.xs,
  },
  tagText: { fontSize: typography.size.xs, color: colors.secondaryForeground, fontWeight: typography.weight.medium },
  tagX:    { width: 18, height: 18, borderRadius: 9, backgroundColor: `${colors.border}80`, alignItems: 'center', justifyContent: 'center' },

  // Temp unit segment
  segRow: { flexDirection: 'row', borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', alignSelf: 'flex-start' },
  seg:    { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2, backgroundColor: colors.background },
  segSel: { backgroundColor: colors.primary },
  segText:    { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  segTextSel: { color: colors.white },

  // Voice cards
  voiceCard: {
    width: '47%',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, gap: 2,
  },
  voiceCardSel: { backgroundColor: `${colors.primary}12`, borderColor: colors.primary },
  voiceName:    { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  voiceNameSel: { color: colors.primary },
  voiceDesc:    { fontSize: 10, color: colors.mutedForeground },

  // Links
  addLink:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs },
  addLinkText: { fontSize: typography.size.xs, color: colors.mutedForeground },
  removeLink:  { fontSize: typography.size.xs, color: colors.error },

  // Advanced toggle
  advToggle:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  advToggleText: { fontSize: typography.size.xs, color: colors.mutedForeground },

  // Account section
  subTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.muted, borderRadius: radii.md, marginTop: spacing.xs },
  emailKey: { fontSize: typography.size.xs, color: colors.mutedForeground },
  emailVal: { fontSize: typography.size.xs, color: colors.foreground, fontWeight: typography.weight.medium },
  outlineBtn: {
    borderRadius: radii.lg, paddingVertical: spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted,
  },
  outlineBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.lg, borderRadius: radii.lg,
    borderWidth: 1, borderColor: `${colors.error}30`,
  },
  signOutText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.error },
  dangerZone:  { borderTopWidth: 1, borderTopColor: `${colors.error}25`, paddingTop: spacing.lg, gap: spacing.sm },
  dangerTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.error },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, borderRadius: radii.lg,
    borderWidth: 1, borderColor: `${colors.error}35`,
  },
  deleteBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.error },
});

const dm = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  card:       { backgroundColor: colors.card, borderRadius: radii.xl, padding: spacing.xl, width: '100%' },
  title:      { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.foreground, marginBottom: spacing.sm },
  body:       { fontSize: typography.size.sm, color: colors.mutedForeground, lineHeight: 20 },
  actions:    { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn:  { flex: 1, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.muted, alignItems: 'center' },
  cancelText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  confirmBtn: { flex: 1, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.error, alignItems: 'center' },
  confirmText:{ fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.white },
});
