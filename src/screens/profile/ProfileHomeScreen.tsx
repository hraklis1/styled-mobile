import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { compressImageToDataUrl } from '../../lib/compressImage';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { useProfileForm } from '../../hooks/useProfileForm';
import { useEntitlement } from '../../hooks/useEntitlement';
import { ErrorState } from '../../components/primitives/ErrorState';
import { SearchField } from '../../components/primitives/SearchField';
import { searchSettings, SETTINGS_INDEX, type SettingsSearchEntry } from './settingsSearch';
import { Group, NavRow } from '../../components/profile/SettingsUI';
import {
  BUDGET_OPTIONS,
  FIT_PREFERENCE_OPTIONS,
  FIT_SILHOUETTE_OPTIONS,
  OCCASION_OPTIONS,
  PALETTE_OPTIONS,
  STYLE_OPTIONS,
  optionLabel,
  optionLabels,
} from '../../lib/profileOptions';
import { colors, spacing, typography, radii } from '../../theme';
import type { ProfileStackScreenProps } from './types';
import { planTierLabel } from './membership';

const PROFILE_SEARCH_INDEX: SettingsSearchEntry[] = [
  { id: 'style', title: 'Style', path: 'Style DNA', icon: 'sparkles-outline', keywords: ['aesthetic', 'silhouette', 'preferences'], target: { route: 'EditStyle' } },
  { id: 'color', title: 'Color', path: 'Style DNA', icon: 'color-palette-outline', keywords: ['palette', 'jewelry', 'favorite colors'], target: { route: 'EditColor' } },
  { id: 'fit', title: 'Fit & Sizes', path: 'Style DNA', icon: 'resize-outline', keywords: ['measurements', 'shoe', 'top', 'waist', 'body'], target: { route: 'EditFit' } },
  { id: 'shopping', title: 'Shopping', path: 'Style DNA', icon: 'bag-handle-outline', keywords: ['budget', 'retailers', 'brands'], target: { route: 'EditShopping' } },
  { id: 'life', title: 'Your Life', path: 'Style DNA', icon: 'calendar-outline', keywords: ['occasions', 'work', 'lifestyle'], target: { route: 'EditOccasions' } },
  ...SETTINGS_INDEX.filter(entry => 'route' in entry.target),
];

function summary(values: string[], empty = 'Add'): string {
  const filled = values.filter(Boolean);
  return filled.length ? filled.slice(0, 3).join(' · ') : empty;
}

/**
 * The Profile hub. Leads with the person (hero and Style DNA) and moves every
 * app setting behind the gear. Each DNA row opens a focused editor with its own
 * Save, replacing the old 60-field scroll with a single Save button at the bottom.
 */
export function ProfileHomeScreen({ navigation }: ProfileStackScreenProps<'ProfileHome'>) {
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const results = searchSettings(query, PROFILE_SEARCH_INDEX);
  const insets = useSafeAreaInsets();
  const parent = useNavigation();
  const { user } = useAuth();
  const { isError, refetch } = useProfile();
  const form = useProfileForm();
  const updatePhoto = useUpdateProfile();
  const { planTier, credits, isPremium } = useEntitlement();

  if (isError) return <ErrorState message="Couldn't load your profile" onRetry={refetch} />;
  if (form.isLoading) {
    return <View style={s.loading}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  const details = form.styleProfileDetails;
  const name = form.displayName.trim() || user?.displayName?.trim() || '';
  const initials = (name || 'ME').split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase();
  const aesthetic = optionLabels(STYLE_OPTIONS, form.stylePreference).slice(0, 3);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const { dataUrl } = await compressImageToDataUrl(result.assets[0]);
    updatePhoto.mutate({ photoUrl: dataUrl }, { onError: () => Alert.alert('Error', "Couldn't update your photo.") });
  };

  const nextStep = !form.stylePreference.length ? 'Add your aesthetic to personalize every look.'
    : !(form.sizeTop || form.sizeShoe || form.sizeBottomWaist) ? 'Add sizes to sharpen fit-sensitive picks.'
    : !form.budgetRange.length ? 'Set a budget so shopping picks land in range.'
    : !form.occasions.length ? 'Add the occasions you dress for.'
    : null;

  return (
    <View style={s.root}>
      <View style={[s.topBar, { paddingTop: spacing.md }]}>
        <Pressable onPress={() => parent.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Settings">
          <Ionicons name="settings-outline" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xxxl }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <SearchField value={query} onChangeText={setQuery} placeholder="Search profile & settings"
          accessibilityLabel="Search profile and settings" autoCorrect={false} autoCapitalize="none"
          clearButtonMode="never" style={{ flex: 0 }} />
        {searching ? (results.length ? (
          <Group title={`${results.length} ${results.length === 1 ? 'result' : 'results'}`}>
            {results.map(entry => <NavRow key={entry.id} icon={entry.icon} label={entry.title} detail={entry.path}
              onPress={() => { if ('route' in entry.target) navigation.navigate(entry.target.route); }} />)}
          </Group>
        ) : (
          <View style={s.empty} accessibilityLiveRegion="polite">
            <Text style={s.emptyTitle}>No matches for “{query.trim()}”</Text>
            <Text style={s.emptyBody}>Try “sizes”, “budget”, or “temperature”.</Text>
          </View>
        )) : (<>
        <View style={s.hero}>
          <Pressable onPress={pickPhoto} style={s.avatar} accessibilityRole="button" accessibilityLabel="Change profile photo">
            {form.photoPreview
              ? <Image source={{ uri: form.photoPreview }} style={s.avatarPhoto} />
              : <Text style={s.avatarText}>{initials}</Text>}
            <View style={s.avatarBadge}>
              {updatePhoto.isPending
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Ionicons name="camera" size={11} color={colors.white} />}
            </View>
          </Pressable>
          <Text style={s.name} accessibilityRole="header">{name || 'Your profile'}</Text>
          <Text style={s.aesthetic}>{aesthetic.length ? aesthetic.join(' · ') : 'Tell us your style'}</Text>

          <View style={s.completion}>
            <View style={s.track}><View style={[s.fill, { width: `${form.completionPct}%` }]} /></View>
            <Text style={s.completionText}>
              {form.completionPct}% complete{nextStep ? ` — ${nextStep}` : ''}
            </Text>
          </View>
        </View>

        <Group title="Style DNA" footer="Each section feeds Today's Look, your stylist, and shopping picks.">
          <NavRow icon="sparkles-outline" label="Style"
            value={summary([...aesthetic.slice(0, 1), form.fitSilhouette ? optionLabel(FIT_SILHOUETTE_OPTIONS, form.fitSilhouette) : ''])}
            onPress={() => navigation.navigate('EditStyle')} />
          <NavRow icon="color-palette-outline" label="Color"
            value={summary([...optionLabels(PALETTE_OPTIONS, form.colorPalette), ...details.favoriteColors])}
            onPress={() => navigation.navigate('EditColor')} />
          <NavRow icon="resize-outline" label="Fit & Sizes"
            value={summary([
              form.fitPreference ? optionLabel(FIT_PREFERENCE_OPTIONS, form.fitPreference) : '',
              form.sizeTop ? `Top ${form.sizeTop}` : '',
              form.sizeShoe ? `Shoe ${form.sizeShoe}` : '',
            ])}
            onPress={() => navigation.navigate('EditFit')} />
          <NavRow icon="bag-handle-outline" label="Shopping"
            value={summary([optionLabels(BUDGET_OPTIONS, form.budgetRange).map((label) => label.replace(/ \(.*\)/, '')).join(', '), ...form.retailers.slice(0, 1)])}
            onPress={() => navigation.navigate('EditShopping')} />
          <NavRow icon="calendar-outline" label="Your Life"
            value={summary(optionLabels(OCCASION_OPTIONS, form.occasions))}
            onPress={() => navigation.navigate('EditOccasions')} />
        </Group>

        <Group>
          <NavRow icon="diamond-outline" label="Membership"
            value={credits ? `${credits.total} credits` : undefined}
            badge={isPremium ? undefined : 'Upgrade'}
            detail={planTierLabel(planTier)}
            onPress={() => navigation.navigate('SettingsMembership')} />
          <NavRow icon="bulb-outline" label="What Styled has learned"
            detail="Tastes picked up from your conversations"
            onPress={() => navigation.navigate('SettingsLearned')} />
        </Group>
        </>)}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { paddingVertical: spacing.xxl, gap: spacing.sm, alignItems: 'center' },
  emptyTitle: { ...typography.text.body, color: colors.foreground, textAlign: 'center' },
  emptyBody: { ...typography.text.caption, color: colors.mutedForeground, textAlign: 'center' },
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, minHeight: 44 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceSelected, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarPhoto: { width: 96, height: 96, borderRadius: 48 },
  avatarText: { ...typography.text.editorialTitle, color: colors.foreground, transform: [{ translateY: 2.8 }] }, // Newsreader caps sit 0.1em high
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background,
  },
  name: { ...typography.text.editorialHero, color: colors.foreground, textAlign: 'center' },
  aesthetic: { ...typography.text.editorialItalic, color: colors.mutedForeground, textAlign: 'center' },
  completion: { alignSelf: 'stretch', gap: spacing.xs, marginTop: spacing.md },
  track: { height: 3, borderRadius: radii.full, backgroundColor: colors.surfaceSelected, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accentInk },
  completionText: { ...typography.text.caption, color: colors.mutedForeground, textAlign: 'center' },
});
