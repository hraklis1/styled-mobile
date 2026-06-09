import { useState, useMemo, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useProfile, useUpdateProfile } from './useProfile';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PickerKey = 'shoe' | 'waist' | 'inseam' | 'dress' | 'heightCm'
  | 'heightFt' | 'heightIn' | 'jacket' | 'jacketLen'
  | 'chest' | 'waistM' | 'hips';

type Opt = { value: string; label: string };

// ── Size option generators ────────────────────────────────────────────────────

export function getShoeOptions(fit: string, region: string): Opt[] {
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

export function getWaistOptions(region: string): Opt[] {
  if (region === 'EU')
    return Array.from({ length: 22 }, (_, i) => { const cm = 70 + i * 2; return { value: String(cm), label: `${cm} cm` }; });
  return Array.from({ length: 17 }, (_, i) => { const n = 28 + i; return { value: String(n), label: `${n}"` }; });
}

export function getInseamOptions(region: string): Opt[] {
  if (region === 'EU')
    return Array.from({ length: 12 }, (_, i) => { const cm = 70 + i * 2; return { value: String(cm), label: `${cm} cm` }; });
  return Array.from({ length: 9 }, (_, i) => { const n = 28 + i; return { value: String(n), label: `${n}"` }; });
}

export function getDressSizeOptions(region: string): Opt[] {
  if (region === 'UK') return Array.from({ length: 10 }, (_, i) => { const s = `UK ${4 + i * 2}`; return { value: s, label: s }; });
  if (region === 'EU') return Array.from({ length: 10 }, (_, i) => { const s = `EU ${32 + i * 2}`; return { value: s, label: s }; });
  return Array.from({ length: 10 }, (_, i) => { const s = `US ${i * 2}`; return { value: s, label: s }; });
}

export function getSuitJacketOptions(region: string): Opt[] {
  if (region === 'EU')
    return Array.from({ length: 10 }, (_, i) => { const n = 44 + i * 2; return { value: String(n), label: `EU ${n}` }; });
  return Array.from({ length: 10 }, (_, i) => { const n = 34 + i * 2; return { value: String(n), label: String(n) }; });
}

export function getBodyMeasurementOptions(region: string): Opt[] {
  if (region === 'EU')
    return Array.from({ length: 91 }, (_, i) => { const n = 60 + i; return { value: `${n} cm`, label: `${n} cm` }; });
  return Array.from({ length: 37 }, (_, i) => { const n = 24 + i; return { value: `${n} in`, label: `${n} in` }; });
}

export function getHeightCmOptions(): Opt[] {
  return Array.from({ length: 101 }, (_, i) => { const n = 120 + i; return { value: `${n} cm`, label: `${n} cm` }; });
}

export const HEIGHT_FEET_OPTS: Opt[] = ['4', '5', '6', '7'].map((f) => ({ value: f, label: `${f} ft` }));
export const HEIGHT_INCH_OPTS: Opt[] = Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i} in` }));

export const JACKET_LENGTH_OPTIONS = [
  { value: 'S', label: 'Short (S)' },
  { value: 'R', label: 'Regular (R)' },
  { value: 'L', label: 'Long (L)' },
];

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useProfileForm() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  // ── Form fields ────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [stylePreference, setStylePreference] = useState<string[]>([]);
  const [colorPalette, setColorPalette] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [fitPreference, setFitPreference] = useState('');
  const [sizingRegion, setSizingRegion] = useState('');
  const [location, setLocation] = useState('');
  const [retailers, setRetailers] = useState<string[]>([]);
  const [newRetailer, setNewRetailer] = useState('');
  const [stylistVoice, setStylistVoice] = useState('shimmer');
  const [tempUnit, setTempUnit] = useState<'F' | 'C' | 'auto'>('auto');
  const [occasions, setOccasions] = useState<string[]>([]);
  const [fitNotes, setFitNotes] = useState('');
  const [sizeTop, setSizeTop] = useState('');
  const [sizeBottomWaist, setSizeBottomWaist] = useState('');
  const [sizeBottomInseam, setSizeBottomInseam] = useState('');
  const [sizeDress, setSizeDress] = useState('');
  const [sizeShoe, setSizeShoe] = useState('');
  const [sizeJacket, setSizeJacket] = useState('');
  const [sizeJacketLength, setSizeJacketLength] = useState('');
  const [measurementChest, setMeasurementChest] = useState('');
  const [measurementWaistM, setMeasurementWaistM] = useState('');
  const [measurementHips, setMeasurementHips] = useState('');
  const [measurementHeight, setMeasurementHeight] = useState('');
  const [measurementHeightFt, setMeasurementHeightFt] = useState('');
  const [measurementHeightIn, setMeasurementHeightIn] = useState('');
  const [showDressSize, setShowDressSize] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState<PickerKey | null>(null);

  const initialValues = useRef<Record<string, unknown>>({});

  // ── Load profile into form ─────────────────────────────────────────────────
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // ── Completion % ───────────────────────────────────────────────────────────
  const completionPct = useMemo(() => {
    const fields = [
      !!displayName.trim(), !!fitPreference,
      stylePreference.length > 0, colorPalette.length > 0,
      occasions.length > 0, !!budgetRange, !!sizeTop, !!location,
      retailers.length > 0, !!fitNotes.trim(),
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [displayName, fitPreference, stylePreference, colorPalette, occasions, budgetRange, sizeTop, location, retailers, fitNotes]);

  // ── Dirty check ────────────────────────────────────────────────────────────
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

  // ── Retailer helpers ───────────────────────────────────────────────────────
  const addRetailer = () => {
    const t = newRetailer.trim();
    if (t && !retailers.includes(t)) setRetailers([...retailers, t]);
    setNewRetailer('');
  };
  const removeRetailer = (r: string) => setRetailers(retailers.filter((x) => x !== r));

  // ── Reset sizing when region or fit changes ────────────────────────────────
  const resetSizing = () => {
    setSizeTop(''); setSizeShoe(''); setSizeBottomWaist(''); setSizeBottomInseam('');
    setSizeDress(''); setSizeJacket(''); setSizeJacketLength('');
    setMeasurementChest(''); setMeasurementWaistM(''); setMeasurementHips('');
    setMeasurementHeight(''); setMeasurementHeightFt(''); setMeasurementHeightIn('');
  };

  // ── Save ───────────────────────────────────────────────────────────────────
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

  // ── Picker config ──────────────────────────────────────────────────────────
  const pickerCfg: Record<PickerKey, { title: string; options: Opt[]; value: string; onSelect: (v: string) => void }> = {
    shoe: { title: 'Shoe Size', options: getShoeOptions(fitPreference, sizingRegion), value: sizeShoe, onSelect: setSizeShoe },
    waist: { title: 'Waist', options: getWaistOptions(sizingRegion), value: sizeBottomWaist, onSelect: setSizeBottomWaist },
    inseam: { title: 'Inseam', options: getInseamOptions(sizingRegion), value: sizeBottomInseam, onSelect: setSizeBottomInseam },
    dress: { title: 'Dress Size', options: getDressSizeOptions(sizingRegion), value: sizeDress, onSelect: setSizeDress },
    heightCm: { title: 'Height (cm)', options: getHeightCmOptions(), value: measurementHeight, onSelect: setMeasurementHeight },
    heightFt: { title: 'Height — Feet', options: HEIGHT_FEET_OPTS, value: measurementHeightFt, onSelect: setMeasurementHeightFt },
    heightIn: { title: 'Height — Inches', options: HEIGHT_INCH_OPTS, value: measurementHeightIn, onSelect: setMeasurementHeightIn },
    jacket: { title: 'Jacket / Blazer', options: getSuitJacketOptions(sizingRegion), value: sizeJacket, onSelect: setSizeJacket },
    jacketLen: { title: 'Jacket Length', options: JACKET_LENGTH_OPTIONS, value: sizeJacketLength, onSelect: setSizeJacketLength },
    chest: { title: 'Chest', options: getBodyMeasurementOptions(sizingRegion), value: measurementChest, onSelect: setMeasurementChest },
    waistM: { title: 'Waist Measurement', options: getBodyMeasurementOptions(sizingRegion), value: measurementWaistM, onSelect: setMeasurementWaistM },
    hips: { title: 'Hips', options: getBodyMeasurementOptions(sizingRegion), value: measurementHips, onSelect: setMeasurementHips },
  };

  return {
    // loading
    isLoading,
    // photo
    photoPreview, setPhotoPreview,
    // identity
    displayName, setDisplayName,
    stylePreference, setStylePreference,
    colorPalette, setColorPalette,
    budgetRange, setBudgetRange,
    bodyType, setBodyType,
    fitPreference, setFitPreference,
    sizingRegion, setSizingRegion,
    occasions, setOccasions,
    // sizing
    sizeTop, setSizeTop,
    sizeShoe, setSizeShoe,
    sizeBottomWaist,
    sizeBottomInseam,
    sizeDress, setSizeDress,
    sizeJacket,
    sizeJacketLength,
    measurementChest,
    measurementWaistM,
    measurementHips,
    measurementHeight,
    measurementHeightFt,
    measurementHeightIn,
    showDressSize, setShowDressSize,
    resetSizing,
    // preferences
    location, setLocation,
    retailers,
    newRetailer, setNewRetailer,
    addRetailer, removeRetailer,
    stylistVoice, setStylistVoice,
    tempUnit, setTempUnit,
    fitNotes, setFitNotes,
    // derived
    completionPct,
    isDirty,
    isSaving: updateProfile.isPending,
    handleSave,
    // picker
    activePicker, setActivePicker,
    pickerCfg,
  };
}
