import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import type { StylistAskDoneEvent } from '../../features/stylist/types';
import { StylistRichText } from './StylistRichText';
export function StylistChecklist({ checklist }: { checklist: NonNullable<StylistAskDoneEvent['checklist']> }) {
  return <View style={s.list}>
    <Text accessibilityRole="header" style={s.title}>{checklist.title}</Text>
    {!!checklist.intro && <StylistRichText text={checklist.intro} />}
    {checklist.entries.map((entry, index) => <View key={index} style={s.row}>
      <Text style={s.number}>{String(index + 1).padStart(2, '0')}</Text>
      <View style={s.copy}><Text style={s.label}>{entry.label}</Text>{!!entry.detail && <Text style={s.detail}>{entry.detail}</Text>}</View>
    </View>)}
  </View>;
}
const s = StyleSheet.create({ list: { gap: spacing.md }, title: { ...typography.text.editorialTitle, color: colors.foreground }, row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, number: { ...typography.text.caption, color: colors.mutedForeground, paddingTop: 3 }, copy: { flex: 1, gap: spacing.xs }, label: { ...typography.text.body, color: colors.foreground, fontWeight: '600' }, detail: { ...typography.text.bodySmall, color: colors.mutedForeground, lineHeight: 22 } });
