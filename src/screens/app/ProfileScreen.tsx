import React, { useState, useRef } from 'react';
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
import { api } from '../../lib/api';
import { colors, spacing, typography, radii } from '../../theme';
import type { ProfileScreenProps } from '../../navigation/types';
import { SectionCard } from '../../components/primitives/SectionCard';
import { SelectRow } from '../../components/profile/SelectRow';
import { ProfilePickerModal } from '../../components/profile/ProfilePickerModal';
import {
  useProfileForm,
  JACKET_LENGTH_OPTIONS,
} from '../../hooks/useProfileForm';

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLE_OPTIONS = [
  'minimalist', 'classic', 'casual', 'trendy',
  'bohemian', 'edgy', 'streetwear', 'athleisure', 'smart casual',
] as const;

const PALETTE_OPTIONS = ['neutral', 'earthy', 'monochrome', 'pastels', 'jewel', 'bright'] as const;

const PALETTE_COLORS: Record<string, string[]> = {
  neutral: ['#F5F0E8', '#C8BAA8', '#9E8E7E', '#6B5B4E', '#2C2420'],
  earthy: ['#8B5E3C', '#C47A45', '#D4A853', '#7A8C50', '#5C4A3A'],
  monochrome: ['#FFFFFF', '#D1D1D1', '#888888', '#444444', '#111111'],
  pastels: ['#F9D4D8', '#D5C5F0', '#C5E8D0', '#FAD7B5', '#B5D5F0'],
  jewel: ['#15803D', '#1D4ED8', '#B91C1C', '#7E22CE', '#D97706'],
  bright: ['#EF4444', '#EAB308', '#3B82F6', '#F97316', '#22C55E'],
};

const BUDGET_OPTIONS = [
  { value: 'value_thrift', label: 'Value / Thrift ($)' },
  { value: 'contemporary_mid', label: 'Contemporary ($$)' },
  { value: 'premium', label: 'Premium ($$$)' },
  { value: 'luxury_high_end', label: 'Luxury ($$$$)' },
];

const BODY_TYPES = [
  { value: 'slim_fit', label: 'Slim Fit' },
  { value: 'athletic_tailored', label: 'Athletic / Tailored' },
  { value: 'regular_average', label: 'Regular / Average' },
  { value: 'relaxed_broad', label: 'Relaxed / Broad' },
];

const OCCASION_OPTIONS = [
  { value: 'work_office', label: 'Work / Office' },
  { value: 'casual_weekend', label: 'Casual / Weekend' },
  { value: 'date_night', label: 'Date Night' },
  { value: 'formal_events', label: 'Formal / Events' },
  { value: 'athletic_active', label: 'Athletic / Active' },
  { value: 'travel', label: 'Travel' },
];

const FIT_PREFERENCE_OPTIONS = [
  { value: 'masculine_cut', label: "Men's / Masc." },
  { value: 'feminine_cut', label: "Women's / Fem." },
  { value: 'neutral_fluid', label: 'Unisex / Fluid' },
];

const SIZING_REGION_OPTIONS = [
  { value: 'US', label: 'US' },
  { value: 'UK', label: 'UK' },
  { value: 'EU', label: 'EU' },
];

const TOP_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const STYLIST_VOICES = [
  { value: 'alloy', label: 'Alloy', description: 'Balanced & neutral' },
  { value: 'echo', label: 'Echo', description: 'Calm & reflective' },
  { value: 'fable', label: 'Fable', description: 'Warm & storytelling' },
  { value: 'onyx', label: 'Onyx', description: 'Deep & grounded' },
  { value: 'nova', label: 'Nova', description: 'Bright & upbeat' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft & breezy' },
];

// ── ProfileScreen ─────────────────────────────────────────────────────────────

export function ProfileScreen(_props: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const form = useProfileForm();

  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ── Password / delete ──────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const scrollRef = useRef<import('react-native').ScrollView>(null);

  // ── Photo pick ─────────────────────────────────────────────────────────────
  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const { dataUrl } = await compressImageToDataUrl(result.assets[0]);
      form.setPhotoPreview(dataUrl);
    }
  };

  // ── Change password ────────────────────────────────────────────────────────
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

  // ── Delete account ─────────────────────────────────────────────────────────
  const deleteAccountMutation = useMutation({
    mutationFn: (password?: string) =>
      api.delete('/api/auth/account', { data: password ? { password } : {} }),
    onSuccess: () => logout(),
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  // ── Initials ───────────────────────────────────────────────────────────────
  const initials = (form.displayName.trim() || user?.displayName?.trim() || 'ME')
    .split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const activeCfg = form.activePicker ? form.pickerCfg[form.activePicker] : null;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (form.isLoading) {
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
          {form.photoPreview
            ? <Image source={{ uri: form.photoPreview }} style={styles.avatarPhoto} />
            : <Text style={styles.avatarText}>{initials}</Text>}
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={9} color={colors.white} />
          </View>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Style Profile</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${form.completionPct}%` as any }]} />
          </View>
          <Text style={styles.progressLabel}>{form.completionPct}% complete</Text>
        </View>
        <TouchableOpacity
          onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Jump to account settings"
        >
          <Ionicons name="settings-outline" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ─────────────────── Section 1: Identity ──────────────────────── */}
        <SectionCard icon="person-outline" title="YOUR IDENTITY">

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              style={styles.input}
              value={form.displayName}
              onChangeText={form.setDisplayName}
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
                const sel = form.fitPreference === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.pill, sel && styles.pillSel]}
                    onPress={() => { form.setFitPreference(opt.value); form.setSizeShoe(''); form.setSizeDress(''); form.setShowDressSize(false); }}
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
                const sel = form.sizingRegion === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.pill, sel && styles.pillSel]}
                    onPress={() => { form.setSizingRegion(opt.value); form.resetSizing(); }}
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
                const sel = form.stylePreference.includes(s);
                const atMax = form.stylePreference.length >= 3;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, sel && styles.chipSel, !sel && atMax && styles.chipDim]}
                    onPress={() => {
                      if (sel) form.setStylePreference(form.stylePreference.filter((x) => x !== s));
                      else if (!atMax) form.setStylePreference([...form.stylePreference, s]);
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
                const sel = form.colorPalette.includes(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={styles.paletteItem}
                    onPress={() => {
                      if (sel) form.setColorPalette(form.colorPalette.filter((x) => x !== p));
                      else form.setColorPalette([...form.colorPalette, p]);
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
                const sel = form.budgetRange === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, sel && styles.chipSel]}
                    onPress={() => form.setBudgetRange(sel ? '' : opt.value)}
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
                const sel = form.bodyType === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, sel && styles.chipSel]}
                    onPress={() => form.setBodyType(sel ? '' : opt.value)}
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
                const sel = form.occasions.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, sel && styles.chipSel]}
                    onPress={() => {
                      if (sel) form.setOccasions(form.occasions.filter((x) => x !== opt.value));
                      else form.setOccasions([...form.occasions, opt.value]);
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
        <SectionCard icon="resize-outline" title="YOUR SIZE">
          <Text style={[styles.hint, { marginTop: -spacing.sm }]}>All optional. Helps suggest pieces in your size.</Text>

          {/* Top */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Top</Text>
            <View style={styles.pillRow}>
              {TOP_SIZES.map((s) => {
                const sel = form.sizeTop === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.pill, sel && styles.pillSel]}
                    onPress={() => form.setSizeTop(sel ? '' : s)}
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
            value={form.sizeShoe}
            placeholder="Select size"
            onPress={() => form.setActivePicker('shoe')}
          />

          {/* Waist + Inseam */}
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <SelectRow
                label={`Waist ${form.sizingRegion === 'EU' ? '(cm)' : '(in)'}`}
                value={form.sizeBottomWaist ? (form.sizingRegion === 'EU' ? `${form.sizeBottomWaist} cm` : `${form.sizeBottomWaist}"`) : ''}
                placeholder="Waist"
                onPress={() => form.setActivePicker('waist')}
              />
            </View>
            <View style={styles.twoColDivider} />
            <View style={{ flex: 1 }}>
              <SelectRow
                label={`Inseam ${form.sizingRegion === 'EU' ? '(cm)' : '(in)'}`}
                value={form.sizeBottomInseam ? (form.sizingRegion === 'EU' ? `${form.sizeBottomInseam} cm` : `${form.sizeBottomInseam}"`) : ''}
                placeholder="Inseam"
                onPress={() => form.setActivePicker('inseam')}
              />
            </View>
          </View>

          {/* Dress */}
          {(form.fitPreference === 'feminine_cut' || form.showDressSize) ? (
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Dress</Text>
                {form.fitPreference !== 'feminine_cut' && (
                  <TouchableOpacity onPress={() => { form.setShowDressSize(false); form.setSizeDress(''); }}>
                    <Text style={styles.removeLink}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              <SelectRow label="" value={form.sizeDress} placeholder="Select dress size" onPress={() => form.setActivePicker('dress')} />
            </View>
          ) : (
            <TouchableOpacity style={styles.addLink} onPress={() => form.setShowDressSize(true)} activeOpacity={0.7}>
              <Ionicons name="add" size={14} color={colors.mutedForeground} />
              <Text style={styles.addLinkText}>Add dress size</Text>
            </TouchableOpacity>
          )}

          {/* Height */}
          <View style={[styles.field, styles.divTop]}>
            <Text style={styles.fieldLabel}>Height</Text>
            {form.sizingRegion === 'EU' ? (
              <SelectRow label="" value={form.measurementHeight} placeholder="Select height" onPress={() => form.setActivePicker('heightCm')} />
            ) : (
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <SelectRow
                    label="Feet"
                    value={form.measurementHeightFt ? `${form.measurementHeightFt} ft` : ''}
                    placeholder="Ft"
                    onPress={() => form.setActivePicker('heightFt')}
                  />
                </View>
                <View style={styles.twoColDivider} />
                <View style={{ flex: 1 }}>
                  <SelectRow
                    label="Inches"
                    value={form.measurementHeightIn !== '' ? `${form.measurementHeightIn} in` : ''}
                    placeholder="In"
                    onPress={() => form.setActivePicker('heightIn')}
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
                  <SelectRow label="Jacket / Blazer" value={form.sizeJacket} placeholder="Size" onPress={() => form.setActivePicker('jacket')} />
                </View>
                {form.fitPreference !== 'feminine_cut' && (
                  <>
                    <View style={styles.twoColDivider} />
                    <View style={{ flex: 1 }}>
                      <SelectRow
                        label="Length"
                        value={JACKET_LENGTH_OPTIONS.find((o) => o.value === form.sizeJacketLength)?.label ?? ''}
                        placeholder="Length"
                        onPress={() => form.setActivePicker('jacketLen')}
                      />
                    </View>
                  </>
                )}
              </View>
              <SelectRow label={`Chest ${form.sizingRegion === 'EU' ? '(cm)' : '(in)'}`} value={form.measurementChest} placeholder="Chest" onPress={() => form.setActivePicker('chest')} />
              <SelectRow label={`Waist measure ${form.sizingRegion === 'EU' ? '(cm)' : '(in)'}`} value={form.measurementWaistM} placeholder="Waist" onPress={() => form.setActivePicker('waistM')} />
              <SelectRow label={`Hips ${form.sizingRegion === 'EU' ? '(cm)' : '(in)'}`} value={form.measurementHips} placeholder="Hips" onPress={() => form.setActivePicker('hips')} />
            </View>
          )}
        </SectionCard>

        {/* ─────────────────── Section 3: Preferences ───────────────────── */}
        <SectionCard icon="star-outline" title="PREFERENCES">

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Location</Text>
            <TextInput
              style={styles.input}
              value={form.location}
              onChangeText={form.setLocation}
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
                value={form.newRetailer}
                onChangeText={form.setNewRetailer}
                placeholder="e.g. Madewell"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
                onSubmitEditing={form.addRetailer}
              />
              <TouchableOpacity style={styles.addBtn} onPress={form.addRetailer} activeOpacity={0.8}>
                <Ionicons name="add" size={20} color={colors.primaryForeground} />
              </TouchableOpacity>
            </View>
            {form.retailers.length > 0 && (
              <View style={styles.tagWrap}>
                {form.retailers.map((r) => (
                  <View key={r} style={styles.tag}>
                    <Text style={styles.tagText}>{r}</Text>
                    <TouchableOpacity onPress={() => form.removeRetailer(r)} style={styles.tagX}>
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
                  style={[styles.seg, form.tempUnit === opt && styles.segSel]}
                  onPress={() => form.setTempUnit(opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.segText, form.tempUnit === opt && styles.segTextSel]}>
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
                const sel = form.stylistVoice === v.value;
                return (
                  <TouchableOpacity
                    key={v.value}
                    style={[styles.voiceCard, sel && styles.voiceCardSel]}
                    onPress={() => form.setStylistVoice(v.value)}
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
              value={form.fitNotes}
              onChangeText={form.setFitNotes}
              placeholder="e.g. I prefer longer hemlines, or I run warm and like lighter fabrics…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={200}
            />
            <Text style={styles.hint}>{form.fitNotes.length}/200 — anything structured fields can't capture.</Text>
          </View>
        </SectionCard>

        {/* ─────────────────── Section 4: Account ───────────────────────── */}
        <SectionCard icon="settings-outline" title="ACCOUNT">

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

      {/* ── Sticky Save footer ───────────────────────────────────────────── */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.saveFooterBtn, form.isDirty && styles.saveFooterBtnActive]}
          onPress={form.handleSave}
          disabled={form.isSaving || !form.isDirty}
          activeOpacity={0.8}
        >
          {form.isSaving
            ? <ActivityIndicator size="small" color={form.isDirty ? colors.primaryForeground : colors.mutedForeground} />
            : <Text style={[styles.saveFooterBtnText, form.isDirty && styles.saveFooterBtnTextActive]}>
              Save Changes
            </Text>}
        </TouchableOpacity>
      </View>

      {/* ── Picker sheet ──────────────────────────────────────────────────── */}
      {activeCfg && (
        <ProfilePickerModal
          visible
          title={activeCfg.title}
          options={activeCfg.options}
          value={activeCfg.value}
          onSelect={activeCfg.onSelect}
          onClose={() => form.setActivePicker(null)}
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
  root: { flex: 1, backgroundColor: colors.background },
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
  avatarText: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.primary },
  headerInfo: { flex: 1, gap: 4 },
  headerTitle: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.foreground },
  progressTrack: { height: 4, backgroundColor: colors.muted, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%' as any, backgroundColor: colors.primary, borderRadius: 2 },
  progressLabel: { fontSize: 10, color: colors.mutedForeground },
  stickyFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveFooterBtn: {
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveFooterBtnActive: { backgroundColor: colors.primary },
  saveFooterBtnText: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  saveFooterBtnTextActive: { color: colors.primaryForeground },

  // Scroll
  scroll: { flex: 1 },

  // Fields
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { fontSize: typography.size.xs, color: colors.mutedForeground },
  divTop: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    fontSize: typography.size.sm, color: colors.foreground,
  },
  textarea: { minHeight: 76, textAlignVertical: 'top', paddingTop: spacing.sm },

  // Pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pillSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  pillTextSel: { color: colors.white },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDim: { opacity: 0.35 },
  chipText: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium, textTransform: 'capitalize' },
  chipTextSel: { color: colors.white },

  // Palette swatches
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  paletteItem: { alignItems: 'center', gap: 4 },
  swatchRing: { width: 46, height: 46, borderRadius: 23, padding: 2, borderWidth: 2.5, borderColor: 'transparent' },
  swatchRingSel: { borderColor: colors.primary },
  swatchInner: { flex: 1, borderRadius: 20, overflow: 'hidden', flexDirection: 'row' },
  swatchSeg: { flex: 1 },
  paletteLabel: { fontSize: 10, color: colors.mutedForeground, textTransform: 'capitalize' },
  paletteLabelSel: { color: colors.primary, fontWeight: typography.weight.semibold },

  // Two-column size row
  twoCol: { flexDirection: 'row', alignItems: 'stretch' },
  twoColDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },

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
  tagX: { width: 18, height: 18, borderRadius: 9, backgroundColor: `${colors.border}80`, alignItems: 'center', justifyContent: 'center' },

  // Temp unit segment
  segRow: { flexDirection: 'row', borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', alignSelf: 'flex-start' },
  seg: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2, backgroundColor: colors.background },
  segSel: { backgroundColor: colors.primary },
  segText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  segTextSel: { color: colors.white },

  // Voice cards
  voiceCard: {
    width: '47%',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, gap: 2,
  },
  voiceCardSel: { backgroundColor: `${colors.primary}12`, borderColor: colors.primary },
  voiceName: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  voiceNameSel: { color: colors.primary },
  voiceDesc: { fontSize: 10, color: colors.mutedForeground },

  // Links
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs },
  addLinkText: { fontSize: typography.size.xs, color: colors.mutedForeground },
  removeLink: { fontSize: typography.size.xs, color: colors.error },

  // Advanced toggle
  advToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
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
  dangerZone: { borderTopWidth: 1, borderTopColor: `${colors.error}25`, paddingTop: spacing.lg, gap: spacing.sm },
  dangerTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.error },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, borderRadius: radii.lg,
    borderWidth: 1, borderColor: `${colors.error}35`,
  },
  deleteBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.error },
});

const dm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.card, borderRadius: radii.xl, padding: spacing.xl, width: '100%' },
  title: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.foreground, marginBottom: spacing.sm },
  body: { fontSize: typography.size.sm, color: colors.mutedForeground, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.muted, alignItems: 'center' },
  cancelText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  confirmBtn: { flex: 1, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.error, alignItems: 'center' },
  confirmText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.white },
});
