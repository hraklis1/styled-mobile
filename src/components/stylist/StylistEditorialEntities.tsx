import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { colors, spacing, typography } from '../../theme';
import { STYLE_OPTIONS } from '../../lib/profileOptions';
import type { StylistAssistantMessage } from '../../features/stylist/types';

export function StylistInsight({ insight }: { insight: NonNullable<StylistAssistantMessage['insight']> }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.badge}>
      <Text style={styles.label}>{insight.label}</Text>
      <Text style={styles.hint}>{expanded ? 'Less' : 'Why it works'}</Text>
    </Pressable>
    {expanded ? <Text style={styles.body}>{insight.explanation}</Text> : null}
  </View>;
}

export function StylistTagSuggestions({ suggestion }: { suggestion: NonNullable<StylistAssistantMessage['tagSuggestions']> }) {
  const { data: profile } = useProfile();
  const update = useUpdateProfile({ silent: true });
  const [savingTag, setSavingTag] = useState<string | null>(null);
  const [failedTag, setFailedTag] = useState<string | null>(null);
  async function save(tag: string) {
    if (!profile || update.isPending || savingTag) return;
    setSavingTag(tag); setFailedTag(null);
    try { await update.mutateAsync({ stylePreference: [...new Set([...(profile.stylePreference ?? []), tag])] }); }
    catch { setFailedTag(tag); }
    finally { setSavingTag(null); }
  }
  return <View style={styles.container}>
    <Text style={styles.body}>{suggestion.rationale}</Text>
    <Text style={styles.hint}>Tap to add to your style preferences</Text>
    <View style={styles.tags}>{suggestion.tags.map(tag => {
      const saved = profile?.stylePreference?.includes(tag) ?? false;
      const label = STYLE_OPTIONS.find(option => option.value === tag)?.label ?? tag.replace(/_/g, ' ');
      return <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`${saved ? 'Saved' : 'Add'} ${label}`} accessibilityState={{ disabled: saved || !profile || !!savingTag }} disabled={saved || !profile || !!savingTag} onPress={() => void save(tag)} style={styles.badge}>
        <Text style={styles.label}>{saved ? '✓ ' : '+ '}{label}</Text>
        {savingTag === tag ? <ActivityIndicator size="small" /> : null}
      </Pressable>;
    })}</View>
    {failedTag ? <Text accessibilityRole="alert" style={styles.body}>Couldn’t save that preference. Tap it to retry.</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderColor: colors.border, borderWidth: 1, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 44 },
  label: { ...typography.text.bodySmall, color: colors.foreground },
  hint: { ...typography.text.bodySmall, color: colors.mutedForeground },
  body: { ...typography.text.body, color: colors.foreground },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
