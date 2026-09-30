import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { WorkspaceSheet } from '../../wardrobe/scan-review/WorkspaceSheet';
import { PrimaryButton } from '../../wardrobe/scan-review/ActionBar';
import { TextLink } from '../../wardrobe/scan-review/atoms';
import { colors, spacing, typography } from '../../../theme';

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dayOffset(offset: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return isoDate(date);
}

export function WornDateSheet({ date, reduceMotion, onSelect, onClose }: {
  date: string; reduceMotion: boolean; onSelect: (date: string) => void; onClose: () => void;
}) {
  const [pending, setPending] = useState(new Date(Math.min(new Date(`${date}T12:00:00`).getTime(), Date.now())));
  const [dismissed, setDismissed] = useState(false);
  const choose = (value: string) => { onSelect(value); setDismissed(true); };
  return <WorkspaceSheet title="When did you wear it?" detent="large" reduceMotion={reduceMotion} dismissed={dismissed} onClose={onClose}
    headerAction={<TextLink label="Cancel" onPress={() => setDismissed(true)} />}
    footer={<PrimaryButton label="Use this date" onPress={() => choose(isoDate(pending))} />}>
    <ScrollView contentContainerStyle={styles.content}>
      <TextLink label="Today" onPress={() => choose(dayOffset(0))} />
      <TextLink label="Yesterday" onPress={() => choose(dayOffset(-1))} />
      <View>
        <Text style={styles.meta}>Choose a date</Text>
        <DateTimePicker value={pending} mode="date" display="inline" presentation="inline" maximumDate={new Date()} themeVariant="light" accentColor={colors.foreground} onChange={(event, value) => { if (event.type === 'set' && value && isoDate(value) <= dayOffset(0)) setPending(value); }} />
      </View>
    </ScrollView>
  </WorkspaceSheet>;
}
const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  meta: { ...typography.text.meta, color: colors.mutedForeground },
});
