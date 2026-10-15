import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useEditStylistMemory, type StylistMemory } from '../../hooks/useStylistMemory';
import { colors, spacing, typography, radii } from '../../theme';

export function StylistMemoryCard({ memory }: { memory: StylistMemory }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.statement);
  const mutation = useEditStylistMemory();
  const save = async (statement?: string) => {
    if (mutation.isPending) return;
    try { await mutation.mutateAsync({ id: memory.id, statement }); setEditing(false); }
    catch { /* Keep the draft and show the inline retry message. */ }
  };
  return <View style={s.card}>
    <Text style={s.source}>{memory.kind === 'explicit' ? 'You told your stylist' : memory.source === 'legacy' ? 'Earlier impression · unconfirmed' : 'A developing impression'}{memory.occurredAt ? ` · ${new Date(memory.occurredAt).toLocaleDateString()}` : ''}</Text>
    {editing ? <TextInput accessibilityLabel="Correct this memory" value={draft} onChangeText={setDraft} multiline maxLength={400} style={s.input} autoFocus /> : <Text style={s.statement} numberOfLines={expanded ? undefined : 4}>{memory.statement}</Text>}
    {!editing && memory.statement.length > 240 && <Pressable accessibilityRole="button" onPress={() => setExpanded(!expanded)} style={s.action}><Text style={s.label}>{expanded ? 'Show less' : 'Read full impression'}</Text></Pressable>}
    {!!memory.sourceQuote && !editing && <Text style={s.quote}>From your words: “{memory.sourceQuote}”</Text>}
    {mutation.isError && <Text accessibilityRole="alert" style={s.error}>Couldn’t save the change. Your edit is still here; try again.</Text>}
    <View style={s.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Save memory correction' : `Correct: ${memory.statement}`} disabled={mutation.isPending || (editing && !draft.trim())} onPress={() => editing ? void save(draft.trim()) : setEditing(true)} style={s.action}>
        <Text style={s.label}>{mutation.isPending ? 'Saving…' : editing ? 'Save correction' : 'Correct'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Cancel memory correction' : `Forget: ${memory.statement}`} disabled={mutation.isPending} onPress={() => editing ? (setEditing(false), setDraft(memory.statement)) : void save()} style={s.action}>
        <Text style={s.label}>{editing ? 'Cancel' : 'Forget'}</Text>
      </Pressable>
    </View>
  </View>;
}
const s = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.sm }, source: { ...typography.text.caption, color: colors.mutedForeground },
  statement: { ...typography.text.body, color: colors.foreground }, quote: { ...typography.text.bodySmall, color: colors.mutedForeground },
  input: { ...typography.text.body, color: colors.foreground, backgroundColor: colors.surfaceSubtle, padding: spacing.md, borderRadius: radii.md, minHeight: 88 },
  actions: { flexDirection: 'row', gap: spacing.lg }, action: { minHeight: 44, justifyContent: 'center' },
  label: { ...typography.text.bodySmall, color: colors.foreground, textDecorationLine: 'underline' }, error: { ...typography.text.bodySmall, color: colors.destructive },
});
