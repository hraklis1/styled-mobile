import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { StylistEditorialUnit } from '../../features/stylist/types';
import { colors, spacing, typography } from '../../theme';
export function StylistEditorialFrame({ unit, children, onRefine }: { unit?: StylistEditorialUnit; children: ReactNode; onRefine?: (prompt: string) => void }) {
  if (!unit || unit.kind === 'prose') return <>{children}</>;
  return <View style={s.frame}>
    <Text style={s.origin}>{unit.origin === 'owned' ? 'From your wardrobe' : unit.origin === 'shopping' ? 'Selected for you · to shop' : 'A direction to explore'}</Text>
    {children}
    {!!onRefine && !!unit.actions.length && <View style={s.actions}>{unit.actions.map(action => <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={() => onRefine(action.prompt)} style={s.action}><Text style={s.label}>{action.label}</Text></Pressable>)}</View>}
  </View>;
}
const s = StyleSheet.create({ frame: { gap: spacing.sm }, origin: { ...typography.text.caption, color: colors.mutedForeground }, actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg }, action: { minHeight: 44, justifyContent: 'center' }, label: { ...typography.text.bodySmall, color: colors.foreground, textDecorationLine: 'underline' } });
