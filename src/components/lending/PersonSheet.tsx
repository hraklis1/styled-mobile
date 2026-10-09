import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LEND_RELATIONSHIPS, type LendContact, type LendRelationship } from '../../lib/lending';
import { Chip } from './LendSheet';
import { PersonAvatar } from './PersonAvatar';
import { colors, radii, spacing, typography } from '../../theme';

/** Edit a saved lend contact: name and relationship in one place, or remove them. */
export function PersonSheet({ contact, onSave, onRemove, onClose }: {
  contact: LendContact | null;
  onSave: (patch: { name?: string; relationship?: LendRelationship }) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<LendRelationship>('friend');

  useEffect(() => {
    if (!contact) return;
    setName(contact.name);
    setRelationship(contact.relationship);
  }, [contact]);

  const trimmed = name.trim();
  const save = () => {
    if (!contact) return;
    const patch: { name?: string; relationship?: LendRelationship } = {};
    if (trimmed && trimmed !== contact.name) patch.name = trimmed;
    if (relationship !== contact.relationship) patch.relationship = relationship;
    if (Object.keys(patch).length) onSave(patch);
    else onClose();
  };

  return (
    <Modal visible={!!contact} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <PersonAvatar name={trimmed || contact?.name || ''} size={44} />
          <Text style={styles.title} numberOfLines={1}>{trimmed || contact?.name || ''}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={save}
              accessibilityLabel="Name"
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Relationship</Text>
            <View style={styles.chips}>
              {LEND_RELATIONSHIPS.map((r) => (
                <Chip key={r.id} label={r.label} active={relationship === r.id} onPress={() => setRelationship(r.id)} />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={save}
            disabled={!trimmed}
            style={[styles.primary, !trimmed && { opacity: 0.4 }]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryLabel}>Save</Text>
          </Pressable>
          <Pressable onPress={onRemove} style={styles.remove} accessibilityRole="button" accessibilityLabel={`Remove ${contact?.name ?? ''}`}>
            <Text style={styles.removeLabel}>Remove from your people</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.lg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.page, paddingBottom: spacing.md,
  },
  title: { ...typography.text.editorialTitle, fontSize: 24, lineHeight: 30, color: colors.foreground, flex: 1 },
  cancel: { ...typography.text.meta, color: colors.mutedForeground },
  body: { flex: 1, paddingHorizontal: spacing.page, gap: spacing.xl },
  section: { gap: spacing.sm },
  label: { ...typography.text.meta, color: colors.foreground },
  input: {
    ...typography.text.bodySmall, color: colors.foreground, minHeight: 48, paddingHorizontal: spacing.md,
    borderRadius: radii.field, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.card,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { paddingHorizontal: spacing.page, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  primary: { minHeight: 52, borderRadius: radii.action, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { ...typography.text.bodySmall, color: colors.primaryForeground, fontWeight: '600' },
  remove: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  removeLabel: { ...typography.text.meta, color: colors.destructive },
});
