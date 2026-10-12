import { confirmSheet } from '../../components/primitives/ConfirmSheet';
import React, { useState } from 'react';
import { useStylistMemory } from '../../hooks/useStylistMemory';
import { StylistMemoryCard } from '../../components/stylist/StylistMemoryCard';
import { BUDGET_OPTIONS, STYLE_OPTIONS, FIT_SILHOUETTE_OPTIONS } from '../../lib/profileOptions';
import { useProfile } from '../../hooks/useProfile';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { SettingsScaffold, Group, GroupBlock, NavRow } from '../../components/profile/SettingsUI';
import { api } from '../../lib/api';
import { colors, spacing, typography, radii } from '../../theme';

type Learned = {
  avoid: string[];
  gravitatesToward: string[];
  fingerprint: string | null;
  fingerprintUpdatedAt: string | null;
};
type Kind = 'avoid' | 'gravitatesToward' | 'fingerprint' | 'all';

const LEARNED_KEY = ['profile', 'learned'] as const;

function TagCloud({ tags, onRemove, empty }: { tags: string[]; onRemove: (tag: string) => void; empty: string }) {
  if (!tags.length) return <Text style={s.empty}>{empty}</Text>;
  return (
    <View style={s.cloud}>
      {tags.map((tag) => (
        <View key={tag} style={s.tag}>
          <Text style={s.tagText}>{tag}</Text>
          <Pressable onPress={() => onRemove(tag)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Forget ${tag}`}>
            <Ionicons name="close" size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/**
 * Shows what the stylist has inferred from conversations: the avoid and
 * gravitates-toward tags and the prose fingerprint. Users can remove any of
 * it. The server reads these fresh on every request, so removing one takes
 * effect on the next reply.
 */
function LegacyLearnedScreen() {
  const qc = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { data, isLoading } = useQuery({
    queryKey: LEARNED_KEY,
    queryFn: () => api.get<Learned>('/api/profile/learned').then((r) => r.data),
  });
  const forget = useMutation({
    mutationFn: (body: { kind: Kind; tag?: string }) => api.delete('/api/profile/learned', { data: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LEARNED_KEY }),
    onError: () => Alert.alert('Error', "Couldn't update. Please try again."),
  });

  const resetAll = () => confirmSheet({
    title: 'Reset everything learned?',
    message: 'Your stylist and shopping guides will start learning your taste again from scratch. Your profile answers and products marked “Not for me” are not affected.',
    confirmLabel: 'Reset',
    destructive: true,
    onConfirm: () => forget.mutate({ kind: 'all' }),
  });

  return (
    <SettingsScaffold title="What Styled Learned" lede="Picked up from your conversations and feedback, on top of the answers in your profile. Remove anything that isn't right.">
      {isLoading || !data ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Group title="You gravitate toward">
            <GroupBlock>
              <TagCloud tags={data.gravitatesToward} empty="Nothing yet. Like or save a few looks."
                onRemove={(tag) => forget.mutate({ kind: 'gravitatesToward', tag })} />
            </GroupBlock>
          </Group>
          <Group title="You tend to avoid">
            <GroupBlock>
              <TagCloud tags={data.avoid} empty="Nothing yet."
                onRemove={(tag) => forget.mutate({ kind: 'avoid', tag })} />
            </GroupBlock>
          </Group>
          <Group title="Style fingerprint"
            footer={data.fingerprintUpdatedAt ? `Updated ${new Date(data.fingerprintUpdatedAt).toLocaleDateString()}` : undefined}>
            <GroupBlock>
              <Text style={data.fingerprint ? s.fingerprint : s.empty}>
                {data.fingerprint ?? 'Written after a few conversations. It summarizes how you actually dress.'}
              </Text>
              {!!data.fingerprint && (
                <Pressable onPress={() => forget.mutate({ kind: 'fingerprint' })} accessibilityRole="button">
                  <Text style={s.link}>Forget this summary</Text>
                </Pressable>
              )}
            </GroupBlock>
          </Group>
          <Group title="Shopping">
            <NavRow label="Products marked “Not for me”" onPress={() => navigation.navigate('SettingsHiddenProducts')} />
          </Group>
          <Group>
            <NavRow label="Reset everything learned" destructive onPress={resetAll} />
          </Group>
        </>
      )}
    </SettingsScaffold>
  );
}

const s = StyleSheet.create({
  cloud: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingLeft: spacing.md, paddingRight: spacing.sm, minHeight: 34, borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
  tagText: { ...typography.text.bodySmall, color: colors.foreground },
  empty: { ...typography.text.bodySmall, color: colors.mutedForeground },
  fingerprint: { ...typography.text.body, color: colors.foreground, lineHeight: 23 },
  link: { ...typography.text.bodySmall, color: colors.foreground, textDecorationLine: 'underline' },
});


export function LearnedScreen() {
  const memory = useStylistMemory();
  const { data: profile } = useProfile();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const [visibleCount, setVisibleCount] = useState(20);
  if (memory.data?.enabled === false) return <LegacyLearnedScreen />;
  return <SettingsScaffold title="Your stylist’s memory" lede="What your stylist knows about you. Correct an impression or forget it at any time.">
    <Group title="What you’ve shared" footer="Your profile answers stay separate from impressions. Edit them whenever your needs change.">
      <NavRow label="Style and preferences" detail={profile?.stylePreference?.map(value => STYLE_OPTIONS.find(option => option.value === value)?.label ?? value).join(' · ') || 'Your aesthetic and the directions you enjoy'} onPress={() => navigation.navigate('EditStyle')} />
      <NavRow label="Fit, sizes and comfort" detail={[FIT_SILHOUETTE_OPTIONS.find(option => option.value === profile?.fitSilhouette)?.label, profile?.fitNotes, profile?.sizeShoe ? `Shoes: ${profile.sizeShoe}` : null].filter(Boolean).join(' · ').replaceAll('_', ' ') || 'Sizes, proportions and practical requirements'} onPress={() => navigation.navigate('EditFit')} />
      <NavRow label="Budget and brands" detail={[profile?.budgetRange?.map(value => BUDGET_OPTIONS.find(option => option.value === value)?.label ?? value).join(', '), profile?.favoriteRetailers?.join(', ')].filter(Boolean).join(' · ').replaceAll('_', ' ') || 'Your price ranges and preferred retailers'} onPress={() => navigation.navigate('EditShopping')} />
      <NavRow label="Colors and materials" onPress={() => navigation.navigate('EditColor')} />
      <NavRow label="Occasions" onPress={() => navigation.navigate('EditOccasions')} />
    </Group>
    {memory.isError && <Group><GroupBlock><Text accessibilityRole="alert" style={s.empty}>Couldn’t refresh your stylist’s memory. Any saved information below is still available.</Text><Pressable accessibilityRole="button" onPress={() => void memory.refetch()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.link}>Try again</Text></Pressable></GroupBlock></Group>}
    {!memory.data && !memory.isError && <Group><GroupBlock>{memory.fetchStatus === 'paused' ? <Text style={s.empty}>Connect to the internet to see your stylist’s memory.</Text> : <ActivityIndicator accessibilityLabel="Loading stylist memory" color={colors.primary} />}</GroupBlock></Group>}
    {memory.data?.enabled && <Group title="From your consultations" footer="Impressions are tentative. Forgetting one also prevents the same old evidence from restoring it.">
      {memory.data.entries.length ? memory.data.entries.slice(0, visibleCount).map(entry => <StylistMemoryCard key={entry.id} memory={entry} />) : <GroupBlock><Text style={s.empty}>No additional memories yet. Your stylist already uses your profile and will learn from what you share over time.</Text></GroupBlock>}
      {memory.data.entries.length > visibleCount && <NavRow label="Show more memories" onPress={() => setVisibleCount(count => count + 20)} />}
    </Group>}
    <Group title="Shopping"><NavRow label="Products marked “Not for me”" onPress={() => navigation.navigate('SettingsHiddenProducts')} /></Group>
  </SettingsScaffold>;
}
