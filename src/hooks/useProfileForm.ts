import { useState, useMemo, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { track } from '../lib/analytics';
import {
  createEmptyStyleProfileDetails,
  hasStyleProfileDetailsValue,
  normalizeBodyType,
  normalizeBudgetRange,
  normalizeFitFields,
  normalizeOccasions,
  normalizeStylePreference,
  normalizeStyleProfileDetails,
  uniqueClean,
} from '../lib/profileOptions';
import type { Profile, StyleProfileDetails } from '../types/profile';
import { useProfile, useUpdateProfile, type ProfileInput } from './useProfile';

export type PickerKey = 'shoe' | 'waist' | 'inseam' | 'dress' | 'heightCm'
  | 'heightFt' | 'heightIn' | 'jacket' | 'jacketLen'
  | 'chest' | 'waistM' | 'hips';

type Opt = { value: string; label: string };

export type ProfileFormSnapshot = {
  photoPreview: string | null;
  displayName: string;
  stylePreference: string[];
  colorPalette: string[];
  budgetRange: string;
  bodyType: string;
  fitPreference: string;
  fitSilhouette: string;
  styleProfileDetails: StyleProfileDetails;
  sizingRegion: string;
  location: string;
  retailers: string[];
  stylistVoice: string;
  tempUnit: 'F' | 'C' | 'auto';
  occasions: string[];
  fitNotes: string;
  sizeTop: string;
  sizeBottomWaist: string;
  sizeBottomInseam: string;
  sizeDress: string;
  sizeShoe: string;
  sizeJacket: string;
  sizeJacketLength: string;
  measurementChest: string;
  measurementWaistM: string;
  measurementHips: string;
  measurementHeight: string;
  measurementHeightFt: string;
  measurementHeightIn: string;
};

type LoadedProfileForm = ProfileFormSnapshot & {
  showDressSize: boolean;
};

export function getShoeOptions(fit: string, region: string): Opt[] {
  const isFem = fit === 'feminine_cut';
  if (region === 'EU') {
    const [s, e] = isFem ? [35, 43] : [35, 60];
    return Array.from({ length: e - s + 1 }, (_, i) => {
      const n = `EU ${s + i}`;
      return { value: n, label: n };
    });
  }
  if (region === 'UK') {
    const [s, e] = isFem ? [2.5, 9.5] : [3, 14];
    const steps = Math.round((e - s) / 0.5) + 1;
    return Array.from({ length: steps }, (_, i) => {
      const n = s + i * 0.5;
      const str = `UK ${Number.isInteger(n) ? n : n.toFixed(1)}`;
      return { value: str, label: str };
    });
  }
  const [s, e] = isFem ? [5, 12] : [5, 15];
  const steps = Math.round((e - s) / 0.5) + 1;
  return Array.from({ length: steps }, (_, i) => {
    const n = s + i * 0.5;
    const str = `US ${Number.isInteger(n) ? n : n.toFixed(1)}`;
    return { value: str, label: str };
  });
}

export function getWaistOptions(region: string): Opt[] {
  if (region === 'EU') {
    return Array.from({ length: 60 }, (_, i) => {
      const cm = 60 + i;
      return { value: String(cm), label: `${cm} cm` };
    });
  }
  return Array.from({ length: 24 }, (_, i) => {
    const n = 24 + i;
    return { value: String(n), label: `${n}"` };
  });
}

export function getInseamOptions(region: string): Opt[] {
  if (region === 'EU') {
    return Array.from({ length: 30 }, (_, i) => {
      const cm = 60 + i;
      return { value: String(cm), label: `${cm} cm` };
    });
  }
  return Array.from({ length: 16 }, (_, i) => {
    const n = 24 + i;
    return { value: String(n), label: `${n}"` };
  });
}

export function getDressSizeOptions(region: string): Opt[] {
  if (region === 'UK') return Array.from({ length: 10 }, (_, i) => {
    const s = `UK ${4 + i * 2}`;
    return { value: s, label: s };
  });
  if (region === 'EU') return Array.from({ length: 10 }, (_, i) => {
    const s = `EU ${32 + i * 2}`;
    return { value: s, label: s };
  });
  return Array.from({ length: 10 }, (_, i) => {
    const s = `US ${i * 2}`;
    return { value: s, label: s };
  });
}

export function getSuitJacketOptions(region: string): Opt[] {
  if (region === 'EU') {
    return Array.from({ length: 10 }, (_, i) => {
      const n = 44 + i * 2;
      return { value: String(n), label: `EU ${n}` };
    });
  }
  return Array.from({ length: 10 }, (_, i) => {
    const n = 34 + i * 2;
    return { value: String(n), label: String(n) };
  });
}

export function getBodyMeasurementOptions(region: string): Opt[] {
  if (region === 'EU') {
    return Array.from({ length: 91 }, (_, i) => {
      const n = 60 + i;
      return { value: `${n} cm`, label: `${n} cm` };
    });
  }
  return Array.from({ length: 37 }, (_, i) => {
    const n = 24 + i;
    return { value: `${n} in`, label: `${n} in` };
  });
}

export function getHeightCmOptions(): Opt[] {
  return Array.from({ length: 101 }, (_, i) => {
    const n = 120 + i;
    return { value: `${n} cm`, label: `${n} cm` };
  });
}

export const HEIGHT_FEET_OPTS: Opt[] = ['4', '5', '6', '7'].map((f) => ({ value: f, label: `${f} ft` }));
export const HEIGHT_INCH_OPTS: Opt[] = Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i} in` }));

export const JACKET_LENGTH_OPTIONS = [
  { value: 'S', label: 'Short (S)' },
  { value: 'R', label: 'Regular (R)' },
  { value: 'L', label: 'Long (L)' },
];

function parseNumeric(value: string | null | undefined): string {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/);
  return match ? match[0] : '';
}

function measurementWithUnit(value: string, region: string): string | null {
  if (!value) return null;
  if (/[a-z"]/.test(value.toLowerCase())) return value;
  return region === 'EU' ? `${value} cm` : `${value} in`;
}

export function buildMeasurementHeight(values: Pick<ProfileFormSnapshot, 'sizingRegion' | 'measurementHeight' | 'measurementHeightFt' | 'measurementHeightIn'>): string | null {
  if (values.sizingRegion === 'EU') return values.measurementHeight || null;
  if (values.measurementHeightFt && values.measurementHeightIn !== '') {
    return `${values.measurementHeightFt}'${values.measurementHeightIn}"`;
  }
  if (values.measurementHeightFt) return `${values.measurementHeightFt} ft`;
  return null;
}

export function hasAnySizingData(values: Pick<ProfileFormSnapshot,
  'sizeTop' | 'sizeBottomWaist' | 'sizeBottomInseam' | 'sizeDress' | 'sizeShoe' | 'sizeJacket' | 'sizeJacketLength' |
  'measurementChest' | 'measurementWaistM' | 'measurementHips' | 'measurementHeight' | 'measurementHeightFt' | 'measurementHeightIn'
>): boolean {
  return Object.values(values).some((value) => String(value ?? '').trim().length > 0);
}

export function hasCutDependentSizingData(values: Pick<ProfileFormSnapshot, 'sizeDress' | 'sizeShoe'>): boolean {
  return !!values.sizeDress || !!values.sizeShoe;
}

export function getSizingRegionResetAction(
  current: string,
  next: string,
  values: Pick<ProfileFormSnapshot,
    'sizeTop' | 'sizeBottomWaist' | 'sizeBottomInseam' | 'sizeDress' | 'sizeShoe' | 'sizeJacket' | 'sizeJacketLength' |
    'measurementChest' | 'measurementWaistM' | 'measurementHips' | 'measurementHeight' | 'measurementHeightFt' | 'measurementHeightIn'
  >,
): 'noop' | 'set' | 'confirm-reset' {
  if (next === current) return 'noop';
  return hasAnySizingData(values) ? 'confirm-reset' : 'set';
}

export function getFitPreferenceResetAction(
  current: string,
  next: string,
  values: Pick<ProfileFormSnapshot, 'sizeDress' | 'sizeShoe'>,
): 'noop' | 'set' | 'confirm-reset' {
  if (next === current) return 'noop';
  return hasCutDependentSizingData(values) ? 'confirm-reset' : 'set';
}

export function buildProfileUpdatePayload(values: ProfileFormSnapshot): ProfileInput {
  const styleProfileDetails = normalizeStyleProfileDetails(values.styleProfileDetails);
  const { fitPreference, fitSilhouette } = normalizeFitFields(values.fitPreference, values.fitSilhouette);

  return {
    photoUrl: values.photoPreview || null,
    displayName: values.displayName.trim() || null,
    stylePreference: normalizeStylePreference(values.stylePreference).length > 0
      ? normalizeStylePreference(values.stylePreference)
      : null,
    colorPalette: uniqueClean(values.colorPalette).length > 0 ? uniqueClean(values.colorPalette) : null,
    budgetRange: normalizeBudgetRange(values.budgetRange) || null,
    bodyType: normalizeBodyType(values.bodyType) || null,
    fitPreference: fitPreference || null,
    fitSilhouette: fitSilhouette || null,
    styleProfileDetails: hasStyleProfileDetailsValue(styleProfileDetails) ? styleProfileDetails : null,
    sizingRegion: values.sizingRegion || null,
    location: values.location.trim() || null,
    favoriteRetailers: uniqueClean(values.retailers).length > 0 ? uniqueClean(values.retailers) : null,
    stylistVoice: values.stylistVoice || null,
    tempUnit: values.tempUnit === 'auto' ? null : values.tempUnit,
    occasions: normalizeOccasions(values.occasions).length > 0 ? normalizeOccasions(values.occasions) : null,
    fitNotes: values.fitNotes.trim() || null,
    sizeTop: values.sizeTop || null,
    sizeBottom: values.sizeBottomWaist && values.sizeBottomInseam
      ? `${values.sizeBottomWaist}x${values.sizeBottomInseam}`
      : values.sizeBottomWaist || null,
    sizeDress: values.sizeDress || null,
    sizeShoe: values.sizeShoe || null,
    suitJacket: values.sizeJacket
      ? values.sizingRegion !== 'EU' && fitPreference !== 'feminine_cut' && values.sizeJacketLength
        ? `${values.sizeJacket}${values.sizeJacketLength}`
        : values.sizeJacket
      : null,
    measurementChest: values.measurementChest || null,
    measurementWaist: values.measurementWaistM || null,
    measurementHips: values.measurementHips || null,
    measurementInseam: measurementWithUnit(values.sizeBottomInseam, values.sizingRegion),
    measurementHeight: buildMeasurementHeight(values),
  };
}

export function parseLoadedProfileForm(profile: Profile): LoadedProfileForm {
  const normalizedFit = normalizeFitFields(profile.fitPreference, profile.fitSilhouette);
  const bottomParts = (profile.sizeBottom ?? '').match(/^(\d+)(?:[xXx×](\d+))?$/);
  const jkt = profile.suitJacket ?? '';
  const ht = profile.measurementHeight ?? '';
  const ftMatch = ht.match(/^(\d+)'(\d+)"?$/);
  const ftOnlyMatch = ht.match(/^(\d+)\s*ft$/i);

  return {
    photoPreview: profile.photoUrl ?? null,
    displayName: profile.displayName ?? '',
    stylePreference: normalizeStylePreference(profile.stylePreference),
    colorPalette: uniqueClean(profile.colorPalette),
    budgetRange: normalizeBudgetRange(profile.budgetRange),
    bodyType: normalizeBodyType(profile.bodyType),
    fitPreference: normalizedFit.fitPreference,
    fitSilhouette: normalizedFit.fitSilhouette,
    styleProfileDetails: normalizeStyleProfileDetails(profile.styleProfileDetails),
    sizingRegion: profile.sizingRegion ?? '',
    location: profile.location ?? '',
    retailers: uniqueClean(profile.favoriteRetailers),
    stylistVoice: profile.stylistVoice ?? 'shimmer',
    tempUnit: (profile.tempUnit as 'F' | 'C' | null) ?? 'auto',
    occasions: normalizeOccasions(profile.occasions),
    fitNotes: profile.fitNotes ?? '',
    sizeTop: profile.sizeTop ?? '',
    sizeBottomWaist: bottomParts ? bottomParts[1] : '',
    sizeBottomInseam: bottomParts?.[2] ?? parseNumeric(profile.measurementInseam),
    sizeDress: profile.sizeDress ?? '',
    sizeShoe: profile.sizeShoe ?? '',
    sizeJacket: jkt && /[SRL]$/.test(jkt) ? jkt.slice(0, -1) : jkt,
    sizeJacketLength: jkt && /[SRL]$/.test(jkt) ? jkt.slice(-1) : '',
    measurementChest: profile.measurementChest ?? '',
    measurementWaistM: profile.measurementWaist ?? '',
    measurementHips: profile.measurementHips ?? '',
    measurementHeight: ftMatch || ftOnlyMatch ? '' : ht,
    measurementHeightFt: ftMatch ? ftMatch[1] : ftOnlyMatch ? ftOnlyMatch[1] : '',
    measurementHeightIn: ftMatch ? ftMatch[2] : '',
    showDressSize: !!profile.sizeDress,
  };
}

function snapshotKey(values: ProfileFormSnapshot): Record<string, unknown> {
  return {
    ...values,
    stylePreference: JSON.stringify(values.stylePreference),
    colorPalette: JSON.stringify(values.colorPalette),
    retailers: JSON.stringify(values.retailers),
    occasions: JSON.stringify(values.occasions),
    styleProfileDetails: JSON.stringify(normalizeStyleProfileDetails(values.styleProfileDetails)),
  };
}

export function useProfileForm() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [stylePreference, setStylePreference] = useState<string[]>([]);
  const [colorPalette, setColorPalette] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [fitPreference, setFitPreferenceState] = useState('');
  const [fitSilhouette, setFitSilhouette] = useState('');
  const [styleProfileDetails, setStyleProfileDetails] = useState<StyleProfileDetails>(() => createEmptyStyleProfileDetails());
  const [sizingRegion, setSizingRegionState] = useState('');
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

  const currentSnapshot: ProfileFormSnapshot = {
    photoPreview,
    displayName,
    stylePreference,
    colorPalette,
    budgetRange,
    bodyType,
    fitPreference,
    fitSilhouette,
    styleProfileDetails,
    sizingRegion,
    location,
    retailers,
    stylistVoice,
    tempUnit,
    occasions,
    fitNotes,
    sizeTop,
    sizeBottomWaist,
    sizeBottomInseam,
    sizeDress,
    sizeShoe,
    sizeJacket,
    sizeJacketLength,
    measurementChest,
    measurementWaistM,
    measurementHips,
    measurementHeight,
    measurementHeightFt,
    measurementHeightIn,
  };

  useEffect(() => {
    if (!profile) return;

    const loaded = parseLoadedProfileForm(profile);
    setPhotoPreview(loaded.photoPreview);
    setDisplayName(loaded.displayName);
    setStylePreference(loaded.stylePreference);
    setColorPalette(loaded.colorPalette);
    setBudgetRange(loaded.budgetRange);
    setBodyType(loaded.bodyType);
    setFitPreferenceState(loaded.fitPreference);
    setFitSilhouette(loaded.fitSilhouette);
    setStyleProfileDetails(loaded.styleProfileDetails);
    setSizingRegionState(loaded.sizingRegion);
    setLocation(loaded.location);
    setRetailers(loaded.retailers);
    setStylistVoice(loaded.stylistVoice);
    setTempUnit(loaded.tempUnit);
    setOccasions(loaded.occasions);
    setFitNotes(loaded.fitNotes);
    setSizeTop(loaded.sizeTop);
    setSizeBottomWaist(loaded.sizeBottomWaist);
    setSizeBottomInseam(loaded.sizeBottomInseam);
    setSizeDress(loaded.sizeDress);
    setSizeShoe(loaded.sizeShoe);
    setSizeJacket(loaded.sizeJacket);
    setSizeJacketLength(loaded.sizeJacketLength);
    setMeasurementChest(loaded.measurementChest);
    setMeasurementWaistM(loaded.measurementWaistM);
    setMeasurementHips(loaded.measurementHips);
    setMeasurementHeight(loaded.measurementHeight);
    setMeasurementHeightFt(loaded.measurementHeightFt);
    setMeasurementHeightIn(loaded.measurementHeightIn);
    setShowDressSize(loaded.showDressSize);

    initialValues.current = snapshotKey(loaded);
  }, [profile]);

  const completionPct = useMemo(() => {
    const details = normalizeStyleProfileDetails(styleProfileDetails);
    const fields = [
      !!displayName.trim(),
      !!fitPreference,
      !!fitSilhouette,
      stylePreference.length > 0,
      colorPalette.length > 0 || details.favoriteColors.length > 0,
      occasions.length > 0,
      !!budgetRange,
      !!sizeTop || !!sizeShoe || !!sizeBottomWaist,
      !!location,
      retailers.length > 0,
      details.shoppingPriorities.length > 0,
      details.styleAvoids.length > 0 || details.brandAvoids.length > 0,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [displayName, fitPreference, fitSilhouette, stylePreference, colorPalette, occasions, budgetRange, sizeTop, sizeShoe, sizeBottomWaist, location, retailers, styleProfileDetails]);

  const isDirty = useMemo(() => {
    const iv = initialValues.current;
    if (!Object.prototype.hasOwnProperty.call(iv, 'displayName')) return false;
    const snapshot = snapshotKey(currentSnapshot);
    return Object.keys(snapshot).some((key) => snapshot[key] !== iv[key]);
  }, [currentSnapshot]);

  const addRetailer = (name?: string) => {
    const t = (name ?? newRetailer).trim();
    if (t && !retailers.some((r) => r.toLowerCase() === t.toLowerCase())) setRetailers([...retailers, t]);
    setNewRetailer('');
  };
  const removeRetailer = (r: string) => setRetailers(retailers.filter((x) => x !== r));

  const resetSizing = () => {
    setSizeTop('');
    setSizeShoe('');
    setSizeBottomWaist('');
    setSizeBottomInseam('');
    setSizeDress('');
    setSizeJacket('');
    setSizeJacketLength('');
    setMeasurementChest('');
    setMeasurementWaistM('');
    setMeasurementHips('');
    setMeasurementHeight('');
    setMeasurementHeightFt('');
    setMeasurementHeightIn('');
  };

  const setSizingRegion = (next: string) => {
    const action = getSizingRegionResetAction(sizingRegion, next, currentSnapshot);
    if (action === 'noop') return;
    const apply = () => {
      setSizingRegionState(next);
      resetSizing();
    };
    if (action === 'confirm-reset') {
      Alert.alert(
        'Change sizing region?',
        'This clears saved sizes and measurements so the new region does not mix units.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Change', style: 'destructive', onPress: apply },
        ],
      );
      return;
    }
    apply();
  };

  const setFitPreference = (next: string) => {
    const action = getFitPreferenceResetAction(fitPreference, next, currentSnapshot);
    if (action === 'noop') return;
    const apply = () => {
      setFitPreferenceState(next);
      setSizeShoe('');
      setSizeDress('');
      setShowDressSize(false);
    };
    if (action === 'confirm-reset') {
      Alert.alert(
        'Change preferred cut?',
        'Shoe and dress sizing can change across cut systems. Clear those dependent sizes?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Change', style: 'destructive', onPress: apply },
        ],
      );
      return;
    }
    apply();
  };

  const updateStyleProfileDetails = (updater: (details: StyleProfileDetails) => StyleProfileDetails) => {
    setStyleProfileDetails((current) => normalizeStyleProfileDetails(updater(normalizeStyleProfileDetails(current))));
  };

  const handleSave = () => {
    const payload = buildProfileUpdatePayload(currentSnapshot);
    updateProfile.mutate(
      payload,
      {
        onSuccess: () => {
          track('profile_updated');
          Alert.alert('Saved', 'Profile updated successfully.');
          initialValues.current = snapshotKey({
            ...currentSnapshot,
            stylePreference: payload.stylePreference ?? [],
            colorPalette: payload.colorPalette ?? [],
            budgetRange: payload.budgetRange ?? '',
            bodyType: payload.bodyType ?? '',
            fitPreference: payload.fitPreference ?? '',
            fitSilhouette: payload.fitSilhouette ?? '',
            styleProfileDetails: payload.styleProfileDetails ?? createEmptyStyleProfileDetails(),
            occasions: payload.occasions ?? [],
            retailers: payload.favoriteRetailers ?? [],
          });
        },
        onError: (err: Error) => Alert.alert('Error', err.message),
      },
    );
  };

  const pickerCfg: Record<PickerKey, { title: string; options: Opt[]; value: string; onSelect: (v: string) => void }> = {
    shoe: { title: 'Shoe Size', options: getShoeOptions(fitPreference, sizingRegion), value: sizeShoe, onSelect: setSizeShoe },
    waist: { title: 'Waist', options: getWaistOptions(sizingRegion), value: sizeBottomWaist, onSelect: setSizeBottomWaist },
    inseam: { title: 'Inseam', options: getInseamOptions(sizingRegion), value: sizeBottomInseam, onSelect: setSizeBottomInseam },
    dress: { title: 'Dress Size', options: getDressSizeOptions(sizingRegion), value: sizeDress, onSelect: setSizeDress },
    heightCm: { title: 'Height (cm)', options: getHeightCmOptions(), value: measurementHeight, onSelect: setMeasurementHeight },
    heightFt: { title: 'Height - Feet', options: HEIGHT_FEET_OPTS, value: measurementHeightFt, onSelect: setMeasurementHeightFt },
    heightIn: { title: 'Height - Inches', options: HEIGHT_INCH_OPTS, value: measurementHeightIn, onSelect: setMeasurementHeightIn },
    jacket: { title: 'Jacket / Blazer', options: getSuitJacketOptions(sizingRegion), value: sizeJacket, onSelect: setSizeJacket },
    jacketLen: { title: 'Jacket Length', options: JACKET_LENGTH_OPTIONS, value: sizeJacketLength, onSelect: setSizeJacketLength },
    chest: { title: 'Chest', options: getBodyMeasurementOptions(sizingRegion), value: measurementChest, onSelect: setMeasurementChest },
    waistM: { title: 'Waist Measurement', options: getBodyMeasurementOptions(sizingRegion), value: measurementWaistM, onSelect: setMeasurementWaistM },
    hips: { title: 'Hips', options: getBodyMeasurementOptions(sizingRegion), value: measurementHips, onSelect: setMeasurementHips },
  };

  return {
    isLoading,
    photoPreview, setPhotoPreview,
    displayName, setDisplayName,
    stylePreference, setStylePreference,
    colorPalette, setColorPalette,
    budgetRange, setBudgetRange,
    bodyType, setBodyType,
    fitPreference, setFitPreference,
    fitSilhouette, setFitSilhouette,
    styleProfileDetails, setStyleProfileDetails, updateStyleProfileDetails,
    sizingRegion, setSizingRegion,
    occasions, setOccasions,
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
    location, setLocation,
    retailers,
    newRetailer, setNewRetailer,
    addRetailer, removeRetailer,
    stylistVoice, setStylistVoice,
    tempUnit, setTempUnit,
    fitNotes, setFitNotes,
    completionPct,
    isDirty,
    isSaving: updateProfile.isPending,
    handleSave,
    activePicker, setActivePicker,
    pickerCfg,
  };
}
