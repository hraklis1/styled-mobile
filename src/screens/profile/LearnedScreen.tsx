import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
export function LearnedScreen() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: LEARNED_KEY,
    queryFn: () => api.get<Learned>('/api/profile/learned').then((r) => r.data),
  });
  const forget = useMutation({
    mutationFn: (body: { kind: Kind; tag?: string }) => api.delete('/api/profile/learned', { data: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LEARNED_KEY }),
    onError: () => Alert.alert('Error', "Couldn't update. Please try again."),
  });

  const resetAll = () => Alert.alert('Reset everything learned?', 'Your stylist will start learning your taste again from scratch. Your profile answers are not affected.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Reset', style: 'destructive', onPress: () => forget.mutate({ kind: 'all' }) },
  ]);

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
