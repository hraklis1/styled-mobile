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
  Linking,
} from 'react-native';
import Purchases from 'react-native-purchases';
import { ENTITLEMENT_ID } from '../../lib/purchases';
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
import { LocationAutocompleteInput } from '../../components/primitives/LocationAutocompleteInput';
import { BrandAutocompleteInput } from '../../components/primitives/BrandAutocompleteInput';
import { ErrorState } from '../../components/primitives/ErrorState';
import { FASHION_BRANDS } from '../../lib/fashionBrands';
import {
  BODY_TYPE_OPTIONS,
  BUDGET_OPTIONS,
  CARE_CONSTRAINT_OPTIONS,
  CATEGORY_BUDGET_KEYS,
  CATEGORY_BUDGET_LABELS,
  COLOR_CONTRAST_OPTIONS,
  COLOR_UNDERTONE_OPTIONS,
  COMFORT_OPTIONS,
  COVERAGE_OPTIONS,
  FIT_PREFERENCE_OPTIONS,
  FIT_SILHOUETTE_OPTIONS,
  MATERIAL_OPTIONS,
  METAL_OPTIONS,
  OCCASION_OPTIONS,
  PALETTE_OPTIONS,
  PATTERN_OPTIONS,
  SENSITIVE_PROPORTION_OPTIONS,
  SHOPPING_PRIORITY_OPTIONS,
  SIZING_REGION_OPTIONS,
  STYLE_OPTIONS,
  TOP_SIZES,
  optionLabel,
  optionLabels,
} from '../../lib/profileOptions';
import {
  useProfileForm,
  JACKET_LENGTH_OPTIONS,
} from '../../hooks/useProfileForm';
import { useProfile } from '../../hooks/useProfile';
import type { CategoryBudgetKey, StyleProfileDetails } from '../../types/profile';

const STYLIST_VOICES = [
  { value: 'alloy', label: 'Alloy', description: 'Balanced and neutral' },
  { value: 'echo', label: 'Echo', description: 'Calm and reflective' },
  { value: 'fable', label: 'Fable', description: 'Warm and storytelling' },
  { value: 'onyx', label: 'Onyx', description: 'Deep and grounded' },
  { value: 'nova', label: 'Nova', description: 'Bright and upbeat' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft and breezy' },
];

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL;
const ACCOUNT_DELETION_URL = process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL;

type DetailArrayKey =
  | 'styleAvoids'
  | 'favoriteColors'
  | 'avoidedColors'
  | 'materialLikes'
  | 'materialAvoids'
  | 'patternLikes'
  | 'patternAvoids'
  | 'brandAvoids'
  | 'shoppingPriorities'
  | 'careConstraints';

type SensitiveArrayKey = 'proportions' | 'coverage' | 'comfort';
type SizeExtraKey = keyof StyleProfileDetails['sizeExtras'];

function toggleValue(values: string[], value: string, max?: number): string[] {
  if (values.includes(value)) return values.filter((entry) => entry !== value);
  if (max && values.length >= max) return values;
  return [...values, value];
}

function uniqueAppend(values: string[], value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return values;
  if (values.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) return values;
  return [...values, trimmed];
}

function SummaryLine({ values, empty = 'Not set' }: { values: string[]; empty?: string }) {
  const text = values.length ? values.slice(0, 4).join(' · ') : empty;
  return <Text style={styles.summaryLine} numberOfLines={1}>{text}</Text>;
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{children}</Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

function OptionChips({
  options,
  values,
  onChange,
  max,
}: {
  options: { value: string; label: string; description?: string }[];
  values: string[];
  onChange: (values: string[]) => void;
  max?: number;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const selected = values.includes(opt.value);
        const disabled = !selected && !!max && values.length >= max;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, selected && styles.chipSel, disabled && styles.chipDim]}
            onPress={() => onChange(toggleValue(values, opt.value, max))}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSel]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SingleChips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; description?: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, selected && styles.chipSel]}
            onPress={() => onChange(selected ? '' : opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSel]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PalettePicker({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <View style={styles.paletteRow}>
      {PALETTE_OPTIONS.map((palette) => {
        const selected = values.includes(palette.value);
        return (
          <TouchableOpacity
            key={palette.value}
            style={styles.paletteItem}
            onPress={() => onChange(toggleValue(values, palette.value))}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${palette.label} palette`}
          >
            <View style={[styles.swatchRing, selected && styles.swatchRingSel]}>
              <View style={styles.swatchInner}>
                {palette.colors.map((color) => (
                  <View key={color} style={[styles.swatchSeg, { backgroundColor: color }]} />
                ))}
              </View>
            </View>
            <Text style={[styles.paletteLabel, selected && styles.paletteLabelSel]}>{palette.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TextTagInput({
  label,
  placeholder,
  value,
  onChangeText,
  tags,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  tags: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="done"
          onSubmitEditing={() => onAdd(value)}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(value)} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
      <TagList tags={tags} onRemove={onRemove} />
    </View>
  );
}

function BrandTagInput({
  label,
  placeholder,
  value,
  onChangeText,
  tags,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  tags: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.inputRow}>
        <BrandAutocompleteInput
          value={value}
          onChangeText={onChangeText}
          onSelect={onAdd}
          suggestions={FASHION_BRANDS.filter((brand) => !tags.includes(brand))}
          placeholder={placeholder}
          style={styles.brandInput}
          containerStyle={{ flex: 1 }}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(value)} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
      <TagList tags={tags} onRemove={onRemove} />
    </View>
  );
}

function TagList({ tags, onRemove }: { tags: string[]; onRemove: (tag: string) => void }) {
  if (!tags.length) return null;
  return (
    <View style={styles.tagWrap}>
      {tags.map((tag) => (
        <View key={tag} style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
          <TouchableOpacity onPress={() => onRemove(tag)} style={styles.tagX} accessibilityLabel={`Remove ${tag}`}>
            <Ionicons name="close" size={11} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function CategoryBudgets({
  budgets,
  onChange,
}: {
  budgets: Partial<Record<CategoryBudgetKey, string | null>>;
  onChange: (key: CategoryBudgetKey, value: string) => void;
}) {
  return (
    <View style={styles.categoryBudgetGrid}>
      {CATEGORY_BUDGET_KEYS.map((key) => (
        <View key={key} style={styles.categoryBudgetRow}>
          <Text style={styles.categoryBudgetLabel}>{CATEGORY_BUDGET_LABELS[key]}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.budgetPills}>
            {BUDGET_OPTIONS.map((option) => {
              const selected = budgets[key] === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.miniChip, selected && styles.chipSel]}
                  onPress={() => onChange(key, selected ? '' : option.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.miniChipText, selected && styles.chipTextSel]}>{option.label.replace(' / thrift', '').replace(' ($)', '')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

export function ProfileScreen(_props: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const form = useProfileForm();
  const { isError: profileError, refetch: refetchProfile } = useProfile();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [newFavoriteColor, setNewFavoriteColor] = useState('');
  const [newAvoidedColor, setNewAvoidedColor] = useState('');
  const [newStyleAvoid, setNewStyleAvoid] = useState('');
  const [newBrandAvoid, setNewBrandAvoid] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const scrollRef = useRef<import('react-native').ScrollView>(null);

  const details = form.styleProfileDetails;

  const updateDetailArray = (key: DetailArrayKey, values: string[]) => {
    form.updateStyleProfileDetails((current) => ({ ...current, [key]: values }));
  };

  const updateExclusiveDetailArray = (
    key: 'materialLikes' | 'materialAvoids' | 'patternLikes' | 'patternAvoids',
    oppositeKey: 'materialLikes' | 'materialAvoids' | 'patternLikes' | 'patternAvoids',
    values: string[],
  ) => {
    form.updateStyleProfileDetails((current) => ({
      ...current,
      [key]: values,
      [oppositeKey]: current[oppositeKey].filter((entry) => !values.includes(entry)),
    }));
  };

  const addDetailTag = (key: DetailArrayKey, value: string, clear: (value: string) => void) => {
    updateDetailArray(key, uniqueAppend(details[key] ?? [], value));
    clear('');
  };

  const removeDetailTag = (key: DetailArrayKey, value: string) => {
    updateDetailArray(key, (details[key] ?? []).filter((entry) => entry !== value));
  };

  const updateSensitiveArray = (key: SensitiveArrayKey, values: string[]) => {
    form.updateStyleProfileDetails((current) => ({
      ...current,
      sensitiveFit: { ...current.sensitiveFit, [key]: values },
    }));
  };

  const setColorAnalysisValue = (key: 'undertone' | 'contrast', value: string) => {
    form.updateStyleProfileDetails((current) => ({
      ...current,
      colorAnalysis: { ...current.colorAnalysis, [key]: value || null },
    }));
  };

  const setSizeExtra = (key: SizeExtraKey, value: string) => {
    form.updateStyleProfileDetails((current) => ({
      ...current,
      sizeExtras: { ...current.sizeExtras, [key]: value.trim() || null },
    }));
  };

  const setCategoryBudget = (key: CategoryBudgetKey, value: string) => {
    form.updateStyleProfileDetails((current) => ({
      ...current,
      categoryBudgets: { ...current.categoryBudgets, [key]: value || null },
    }));
  };

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

  const changePasswordMutation = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post('/api/auth/change-password', body),
    onSuccess: () => {
      Alert.alert('Updated', 'Your password has been changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const handleChangePassword = () => {
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Doesn't match", 'New password and confirmation must match.');
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    try {
      const info = await Purchases.restorePurchases();
      const premium = !!info.entitlements.active[ENTITLEMENT_ID];
      Alert.alert(
        premium ? 'Restored' : 'No Subscription Found',
        premium ? 'Your subscription has been restored successfully.' : "We couldn't find an active subscription to restore.",
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const deleteAccountMutation = useMutation({
    mutationFn: (password?: string) =>
      api.delete('/api/auth/account', { data: password ? { password } : {} }),
    onSuccess: () => logout(),
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const initials = (form.displayName.trim() || user?.displayName?.trim() || 'ME')
    .split(/\s+/)
    .map((word: string) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const styleSummaryValues = [
    ...optionLabels(STYLE_OPTIONS, form.stylePreference).slice(0, 2),
    form.fitSilhouette ? optionLabel(FIT_SILHOUETTE_OPTIONS, form.fitSilhouette) : '',
  ].filter(Boolean);

  const activeCfg = form.activePicker ? form.pickerCfg[form.activePicker] : null;

  const openExternalUrl = async (label: string, url?: string) => {
    if (!url) {
      Alert.alert('Not configured', `${label} is not configured for this build.`);
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Unable to open link', `Could not open ${label.toLowerCase()}.`);
      return;
    }
    await Linking.openURL(url);
  };

  if (profileError) {
    return <ErrorState message="Couldn't load your profile" onRetry={refetchProfile} />;
  }

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
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.avatar}
          onPress={handlePickPhoto}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
        >
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
          <View style={styles.summaryMeta}>
            <Text style={styles.styleSummary} numberOfLines={1}>
              {styleSummaryValues.length ? styleSummaryValues.join(' · ') : 'Add your style preferences'}
            </Text>
            <Text style={styles.progressLabel}>{form.completionPct}%</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Jump to account settings"
        >
          <Ionicons name="settings-outline" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionCard icon="sparkles-outline" title="STYLE DNA">
          <View style={styles.field}>
            <FieldLabel>Display name</FieldLabel>
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

          <View style={styles.field}>
            <FieldLabel hint="up to 3">Aesthetic</FieldLabel>
            <OptionChips
              options={STYLE_OPTIONS}
              values={form.stylePreference}
              onChange={form.setStylePreference}
              max={3}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>Silhouette</FieldLabel>
            <SingleChips
              options={FIT_SILHOUETTE_OPTIONS}
              value={form.fitSilhouette}
              onChange={form.setFitSilhouette}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>Color palette</FieldLabel>
            <PalettePicker values={form.colorPalette} onChange={form.setColorPalette} />
          </View>

          <View style={styles.twoColFields}>
            <TextTagInput
              label="Specific colors I love"
              placeholder="e.g. oxblood"
              value={newFavoriteColor}
              onChangeText={setNewFavoriteColor}
              tags={details.favoriteColors}
              onAdd={(value) => addDetailTag('favoriteColors', value, setNewFavoriteColor)}
              onRemove={(value) => removeDetailTag('favoriteColors', value)}
            />
            <TextTagInput
              label="Colors to avoid"
              placeholder="e.g. neon yellow"
              value={newAvoidedColor}
              onChangeText={setNewAvoidedColor}
              tags={details.avoidedColors}
              onAdd={(value) => addDetailTag('avoidedColors', value, setNewAvoidedColor)}
              onRemove={(value) => removeDetailTag('avoidedColors', value)}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>Color analysis</FieldLabel>
            <Text style={styles.hint}>Optional signals for jewelry, contrast, and color temperature.</Text>
            <View style={styles.chipSubgroup}>
              <Text style={styles.chipSubgroupLabel}>Temperature</Text>
              <SingleChips
                options={COLOR_UNDERTONE_OPTIONS}
                value={details.colorAnalysis.undertone ?? ''}
                onChange={(value) => setColorAnalysisValue('undertone', value)}
              />
            </View>
            <View style={styles.chipSubgroup}>
              <Text style={styles.chipSubgroupLabel}>Contrast</Text>
              <SingleChips
                options={COLOR_CONTRAST_OPTIONS}
                value={details.colorAnalysis.contrast ?? ''}
                onChange={(value) => setColorAnalysisValue('contrast', value)}
              />
            </View>
            <View style={styles.chipSubgroup}>
              <Text style={styles.chipSubgroupLabel}>Metals</Text>
              <OptionChips
                options={METAL_OPTIONS}
                values={details.colorAnalysis.metalPreference}
                onChange={(values) => form.updateStyleProfileDetails((current) => ({
                  ...current,
                  colorAnalysis: { ...current.colorAnalysis, metalPreference: values },
                }))}
              />
            </View>
          </View>

          <View style={styles.field}>
            <FieldLabel>Materials to seek</FieldLabel>
            <OptionChips
              options={MATERIAL_OPTIONS}
              values={details.materialLikes}
              onChange={(values) => updateExclusiveDetailArray('materialLikes', 'materialAvoids', values)}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>Materials to avoid</FieldLabel>
            <OptionChips
              options={MATERIAL_OPTIONS}
              values={details.materialAvoids}
              onChange={(values) => updateExclusiveDetailArray('materialAvoids', 'materialLikes', values)}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>Patterns I like</FieldLabel>
            <OptionChips
              options={PATTERN_OPTIONS}
              values={details.patternLikes}
              onChange={(values) => updateExclusiveDetailArray('patternLikes', 'patternAvoids', values)}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>Patterns to avoid</FieldLabel>
            <OptionChips
              options={PATTERN_OPTIONS}
              values={details.patternAvoids}
              onChange={(values) => updateExclusiveDetailArray('patternAvoids', 'patternLikes', values)}
            />
          </View>

          <TextTagInput
            label="Style avoids"
            placeholder="e.g. boxy cropped jackets"
            value={newStyleAvoid}
            onChangeText={setNewStyleAvoid}
            tags={details.styleAvoids}
            onAdd={(value) => addDetailTag('styleAvoids', value, setNewStyleAvoid)}
            onRemove={(value) => removeDetailTag('styleAvoids', value)}
          />

          <View style={[styles.field, styles.divTop]}>
            <FieldLabel>Occasions</FieldLabel>
            <OptionChips
              options={OCCASION_OPTIONS}
              values={form.occasions}
              onChange={form.setOccasions}
            />
          </View>
        </SectionCard>

        <SectionCard
          icon="resize-outline"
          title="FIT & SIZING"
          collapsible
          initiallyExpanded={false}
          summary={<SummaryLine values={[
            form.fitPreference ? optionLabel(FIT_PREFERENCE_OPTIONS, form.fitPreference) : '',
            form.sizeTop ? `Top ${form.sizeTop}` : '',
            form.sizeShoe ? `Shoe ${form.sizeShoe}` : '',
            form.sizeBottomWaist ? `Waist ${form.sizeBottomWaist}` : '',
          ].filter(Boolean)} />}
        >
          <Text style={styles.hint}>Sizing is optional, private, and used to improve fit-sensitive recommendations.</Text>

          <View style={styles.field}>
            <FieldLabel>Preferred cut</FieldLabel>
            <SingleChips
              options={FIT_PREFERENCE_OPTIONS}
              value={form.fitPreference}
              onChange={form.setFitPreference}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>Proportions</FieldLabel>
            <OptionChips
              options={BODY_TYPE_OPTIONS}
              values={form.bodyType ? [form.bodyType] : []}
              onChange={(values) => form.setBodyType(values.at(-1) ?? '')}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>Sizing region</FieldLabel>
            <SingleChips
              options={SIZING_REGION_OPTIONS}
              value={form.sizingRegion}
              onChange={form.setSizingRegion}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>Top</FieldLabel>
            <View style={styles.pillRow}>
              {TOP_SIZES.map((size) => {
                const selected = form.sizeTop === size;
                return (
                  <TouchableOpacity
                    key={size}
                    style={[styles.pill, selected && styles.pillSel]}
                    onPress={() => form.setSizeTop(selected ? '' : size)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, selected && styles.pillTextSel]}>{size}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <SelectRow
            label="Shoe"
            value={form.sizeShoe}
            placeholder="Select size"
            onPress={() => form.setActivePicker('shoe')}
          />

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

          <View style={[styles.field, styles.divTop]}>
            <FieldLabel>Height</FieldLabel>
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

          <TouchableOpacity style={styles.advToggle} onPress={() => setAdvancedOpen((value) => !value)} activeOpacity={0.7}>
            <Ionicons name={advancedOpen ? 'chevron-down' : 'chevron-forward'} size={12} color={colors.mutedForeground} />
            <Text style={styles.advToggleText}>Advanced fit details</Text>
          </TouchableOpacity>

          {advancedOpen && (
            <View style={{ gap: spacing.lg }}>
              <Text style={styles.hint}>These details are optional. Add only what you want the stylist to consider.</Text>
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <SelectRow label="Jacket / blazer" value={form.sizeJacket} placeholder="Size" onPress={() => form.setActivePicker('jacket')} />
                </View>
                {form.fitPreference !== 'feminine_cut' && (
                  <>
                    <View style={styles.twoColDivider} />
                    <View style={{ flex: 1 }}>
                      <SelectRow
                        label="Length"
                        value={JACKET_LENGTH_OPTIONS.find((option) => option.value === form.sizeJacketLength)?.label ?? ''}
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

              <View style={styles.field}>
                <FieldLabel>Sensitive fit notes</FieldLabel>
                <OptionChips
                  options={SENSITIVE_PROPORTION_OPTIONS}
                  values={details.sensitiveFit.proportions}
                  onChange={(values) => updateSensitiveArray('proportions', values)}
                />
                <OptionChips
                  options={COVERAGE_OPTIONS}
                  values={details.sensitiveFit.coverage}
                  onChange={(values) => updateSensitiveArray('coverage', values)}
                />
                <OptionChips
                  options={COMFORT_OPTIONS}
                  values={details.sensitiveFit.comfort}
                  onChange={(values) => updateSensitiveArray('comfort', values)}
                />
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={details.sensitiveFit.notes ?? ''}
                  onChangeText={(value) => form.updateStyleProfileDetails((current) => ({
                    ...current,
                    sensitiveFit: { ...current.sensitiveFit, notes: value },
                  }))}
                  placeholder="Private fit details your stylist should keep in mind..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  maxLength={240}
                />
              </View>

              <View style={styles.sizeExtrasGrid}>
                {([
                  ['neck', 'Neck'],
                  ['sleeve', 'Sleeve'],
                  ['shoeWidth', 'Shoe width'],
                  ['heelComfort', 'Heel comfort'],
                  ['braSize', 'Bra size'],
                  ['hat', 'Hat'],
                  ['belt', 'Belt'],
                  ['ring', 'Ring'],
                  ['eyewear', 'Eyewear'],
                  ['watch', 'Watch'],
                ] as Array<[SizeExtraKey, string]>).map(([key, label]) => (
                  <View key={key} style={styles.sizeExtraField}>
                    <Text style={styles.sizeExtraLabel}>{label}</Text>
                    <TextInput
                      style={styles.input}
                      value={details.sizeExtras[key] ?? ''}
                      onChangeText={(value) => setSizeExtra(key, value)}
                      placeholder="Optional"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </SectionCard>

        <SectionCard
          icon="bag-handle-outline"
          title="SHOPPING INTELLIGENCE"
          collapsible
          initiallyExpanded={false}
          summary={<SummaryLine values={[
            form.budgetRange ? optionLabel(BUDGET_OPTIONS, form.budgetRange) : '',
            ...form.retailers.slice(0, 2),
            details.brandAvoids.length ? `${details.brandAvoids.length} avoids` : '',
          ].filter(Boolean)} />}
        >
          <View style={styles.field}>
            <FieldLabel>Budget tier</FieldLabel>
            <SingleChips options={BUDGET_OPTIONS} value={form.budgetRange} onChange={form.setBudgetRange} />
          </View>

          <View style={styles.field}>
            <FieldLabel>Category budgets</FieldLabel>
            <CategoryBudgets budgets={details.categoryBudgets} onChange={setCategoryBudget} />
          </View>

          <BrandTagInput
            label="Favorite brands and shops"
            placeholder="e.g. Toteme"
            value={form.newRetailer}
            onChangeText={form.setNewRetailer}
            tags={form.retailers}
            onAdd={form.addRetailer}
            onRemove={form.removeRetailer}
          />

          <BrandTagInput
            label="Brands to avoid"
            placeholder="e.g. brand you never want"
            value={newBrandAvoid}
            onChangeText={setNewBrandAvoid}
            tags={details.brandAvoids}
            onAdd={(value) => addDetailTag('brandAvoids', value, setNewBrandAvoid)}
            onRemove={(value) => removeDetailTag('brandAvoids', value)}
          />

          <View style={styles.field}>
            <FieldLabel>Shopping priorities</FieldLabel>
            <OptionChips
              options={SHOPPING_PRIORITY_OPTIONS}
              values={details.shoppingPriorities}
              onChange={(values) => updateDetailArray('shoppingPriorities', values)}
            />
          </View>

          <View style={styles.field}>
            <FieldLabel>Care constraints</FieldLabel>
            <OptionChips
              options={CARE_CONSTRAINT_OPTIONS}
              values={details.careConstraints}
              onChange={(values) => updateDetailArray('careConstraints', values)}
            />
          </View>
        </SectionCard>

        <SectionCard
          icon="options-outline"
          title="STYLIST SETTINGS"
          collapsible
          initiallyExpanded={false}
          summary={<SummaryLine values={[
            form.location || 'No home city',
            form.tempUnit === 'auto' ? 'Auto temp' : `${form.tempUnit} temp`,
            optionLabel(STYLIST_VOICES, form.stylistVoice),
          ]} />}
        >
          <View style={styles.field}>
            <FieldLabel>Home location</FieldLabel>
            <LocationAutocompleteInput
              value={form.location}
              onChangeText={form.setLocation}
              onSelect={form.setLocation}
              placeholder="e.g. Brooklyn, NY"
            />
            <Text style={styles.hint}>Used when current location is off or unavailable, and for local recommendations.</Text>
          </View>

          <View style={styles.field}>
            <FieldLabel>Temperature units</FieldLabel>
            <View style={styles.segRow}>
              {(['auto', 'C', 'F'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.seg, form.tempUnit === opt && styles.segSel]}
                  onPress={() => form.setTempUnit(opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.segText, form.tempUnit === opt && styles.segTextSel]}>
                    {opt === 'auto' ? 'Auto' : opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <FieldLabel>Stylist voice</FieldLabel>
            <View style={styles.voiceGrid}>
              {STYLIST_VOICES.map((voice) => {
                const selected = form.stylistVoice === voice.value;
                return (
                  <TouchableOpacity
                    key={voice.value}
                    style={[styles.voiceCard, selected && styles.voiceCardSel]}
                    onPress={() => form.setStylistVoice(voice.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.voiceName, selected && styles.voiceNameSel]}>{voice.label}</Text>
                    <Text style={styles.voiceDesc}>{voice.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <FieldLabel>Stylist notes</FieldLabel>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.fitNotes}
              onChangeText={form.setFitNotes}
              placeholder="Anything structured fields cannot capture..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={240}
            />
            <Text style={styles.hint}>{form.fitNotes.length}/240</Text>
          </View>
        </SectionCard>

        <SectionCard icon="settings-outline" title="ACCOUNT" collapsible initiallyExpanded={false}>
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
                accessibilityRole="button"
                accessibilityLabel="Update password"
                accessibilityState={{ disabled: changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword }}
              >
                {changePasswordMutation.isPending
                  ? <ActivityIndicator size="small" color={colors.foreground} />
                  : <Text style={styles.outlineBtnText}>Update password</Text>}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestorePurchases}
            disabled={isRestoring}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            accessibilityState={{ disabled: isRestoring }}
          >
            {isRestoring
              ? <ActivityIndicator size="small" color={colors.mutedForeground} />
              : <Ionicons name="refresh-outline" size={18} color={colors.mutedForeground} />}
            <Text style={styles.restoreBtnText}>{isRestoring ? 'Restoring...' : 'Restore Purchases'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => Alert.alert('Sign out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => logout() },
            ])}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>

          <View style={styles.legalSection}>
            <Text style={styles.subTitle}>Privacy and support</Text>
            <Text style={styles.hint}>
              Styled processes wardrobe photos, profile preferences, location when requested,
              and usage diagnostics to provide styling features and improve reliability.
            </Text>
            {[
              { label: 'Privacy Policy', url: PRIVACY_URL },
              { label: 'Terms of Service', url: TERMS_URL },
              { label: 'Contact Support', url: SUPPORT_URL },
              { label: 'Delete account outside the app', url: ACCOUNT_DELETION_URL },
            ].map((link) => (
              <TouchableOpacity
                key={link.label}
                style={styles.legalLink}
                onPress={() => openExternalUrl(link.label, link.url)}
                accessibilityRole="link"
                accessibilityLabel={link.label}
                activeOpacity={0.7}
              >
                <Text style={styles.legalLinkText}>{link.label}</Text>
                <Ionicons name="open-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>Danger Zone</Text>
            <Text style={styles.hint}>Permanently delete your account and all wardrobe data. This cannot be undone.</Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => setDeleteModalVisible(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Delete my account"
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.deleteBtnText}>Delete my account</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>
      </ScrollView>

      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.saveFooterBtn, form.isDirty && styles.saveFooterBtnActive]}
          onPress={form.handleSave}
          disabled={form.isSaving || !form.isDirty}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Save profile changes"
          accessibilityState={{ disabled: form.isSaving || !form.isDirty }}
        >
          {form.isSaving
            ? <ActivityIndicator size="small" color={form.isDirty ? colors.primaryForeground : colors.mutedForeground} />
            : <Text style={[styles.saveFooterBtnText, form.isDirty && styles.saveFooterBtnTextActive]}>Save Changes</Text>}
        </TouchableOpacity>
      </View>

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
                style={[dm.confirmBtn, deleteAccountMutation.isPending && { opacity: 0.6 }]}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: {
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPhoto: { width: 58, height: 58, borderRadius: radii.lg },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  avatarText: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.primary },
  headerInfo: { flex: 1, gap: 4 },
  headerTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.foreground, letterSpacing: 0 },
  progressTrack: { height: 4, backgroundColor: colors.muted, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%' as any, backgroundColor: colors.primary, borderRadius: 2 },
  summaryMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  styleSummary: { flex: 1, fontSize: typography.size.xs, color: colors.mutedForeground },
  progressLabel: { fontSize: 10, color: colors.primary, fontWeight: typography.weight.semibold },
  scroll: { flex: 1 },
  stickyFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  hint: { fontSize: typography.size.xs, color: colors.mutedForeground },
  summaryLine: { fontSize: typography.size.xs, color: colors.mutedForeground },
  divTop: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 0,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
  brandInput: {
    height: 42,
    borderWidth: 0,
    backgroundColor: colors.surfaceSubtle,
    fontSize: typography.size.sm,
  },
  textarea: { minHeight: 76, textAlignVertical: 'top', paddingTop: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  chipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDim: { opacity: 0.35 },
  chipText: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  chipTextSel: { color: colors.white },
  chipSubgroup: { gap: spacing.xs },
  chipSubgroupLabel: { fontSize: 11, color: colors.mutedForeground, fontWeight: typography.weight.semibold },
  miniChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  miniChipText: { fontSize: 10, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  paletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  paletteItem: { alignItems: 'center', gap: 4 },
  swatchRing: { width: 46, height: 46, borderRadius: 23, padding: 2, borderWidth: 2.5, borderColor: 'transparent' },
  swatchRingSel: { borderColor: colors.primary },
  swatchInner: { flex: 1, borderRadius: 20, overflow: 'hidden', flexDirection: 'row' },
  swatchSeg: { flex: 1 },
  paletteLabel: { fontSize: 10, color: colors.mutedForeground },
  paletteLabelSel: { color: colors.primary, fontWeight: typography.weight.semibold },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
  },
  pillSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.medium },
  pillTextSel: { color: colors.white },
  twoCol: { flexDirection: 'row', alignItems: 'stretch' },
  twoColDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  twoColFields: { gap: spacing.lg },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondary,
    borderRadius: radii.full,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs + 2,
    paddingVertical: spacing.xs,
  },
  tagText: { fontSize: typography.size.xs, color: colors.secondaryForeground, fontWeight: typography.weight.medium },
  tagX: { width: 18, height: 18, borderRadius: 9, backgroundColor: `${colors.border}80`, alignItems: 'center', justifyContent: 'center' },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs },
  addLinkText: { fontSize: typography.size.xs, color: colors.mutedForeground },
  removeLink: { fontSize: typography.size.xs, color: colors.error },
  advToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  advToggleText: { fontSize: typography.size.xs, color: colors.mutedForeground },
  sizeExtrasGrid: { gap: spacing.md },
  sizeExtraField: { gap: spacing.xs },
  sizeExtraLabel: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.semibold },
  categoryBudgetGrid: { gap: spacing.sm },
  categoryBudgetRow: { gap: spacing.xs },
  categoryBudgetLabel: { fontSize: typography.size.xs, color: colors.mutedForeground, fontWeight: typography.weight.semibold },
  budgetPills: { gap: spacing.xs, paddingVertical: 2 },
  segRow: { flexDirection: 'row', borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', alignSelf: 'flex-start' },
  seg: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2, backgroundColor: colors.background },
  segSel: { backgroundColor: colors.primary },
  segText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  segTextSel: { color: colors.white },
  voiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  voiceCard: {
    width: '47%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
    gap: 2,
  },
  voiceCardSel: { backgroundColor: `${colors.primary}12`, borderColor: colors.primary },
  voiceName: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  voiceNameSel: { color: colors.primary },
  voiceDesc: { fontSize: 10, color: colors.mutedForeground },
  subTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.muted, borderRadius: radii.md, marginTop: spacing.xs },
  emailKey: { fontSize: typography.size.xs, color: colors.mutedForeground },
  emailVal: { fontSize: typography.size.xs, color: colors.foreground, fontWeight: typography.weight.medium },
  outlineBtn: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  outlineBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.foreground },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  restoreBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.error}30`,
  },
  signOutText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.error },
  legalSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, gap: spacing.sm },
  legalLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legalLinkText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.primary },
  dangerZone: { borderTopWidth: 1, borderTopColor: `${colors.error}25`, paddingTop: spacing.lg, gap: spacing.sm },
  dangerTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.error },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.error}35`,
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
