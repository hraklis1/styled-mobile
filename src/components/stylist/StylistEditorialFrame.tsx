import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { StylistEditorialUnit } from '../../features/stylist/types';
import { colors, spacing, typography } from '../../theme';

function originLabel(unit: StylistEditorialUnit): string | null {
  if (unit.kind === 'plan') return 'Packing plan · from your wardrobe';
  if (unit.kind === 'audit') return 'Wardrobe review';
  if (unit.kind === 'suggestion') return 'Ideas to consider · not in your wardrobe';
  if (unit.kind === 'comparison') return unit.origin === 'owned' ? 'Compared from your wardrobe' : 'Compared for you';
  // Checklists and look cards carry their own heading and eyebrow; a second label just stacks.
  if (unit.kind === 'checklist' || unit.kind === 'look') return null;
  if (unit.origin === 'shopping') return 'Selected for you · to shop';
  if (unit.origin === 'owned') return 'From your wardrobe';
  return 'An idea to try';
}

export function StylistEditorialFrame({ unit, children, onRefine }: { unit?: StylistEditorialUnit; children: ReactNode; onRefine?: (prompt: string) => void }) {
  if (!unit || unit.kind === 'prose') return <>{children}</>;
  const label = originLabel(unit);
  return <View style={s.frame}>
    {label ? <Text style={s.origin}>{label}</Text> : null}
    {children}
    {!!onRefine && !!unit.actions.length && <View style={s.actions}>{unit.actions.map(action => (
      <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={() => onRefine(action.prompt)}
        style={({ pressed }) => [s.action, pressed && s.pressed]} hitSlop={4}>
        <Text style={s.label}>{action.label}</Text>
      </Pressable>
    ))}</View>}
  </View>;
}
const s = StyleSheet.create({
  frame: { gap: spacing.sm },
  origin: { ...typography.text.eyebrow, color: colors.mutedForeground },
  // Refinements read as quiet text links, like the follow-up chips above the
  // composer, so a look card carries one filled and one outlined button, not three styles.
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, paddingTop: spacing.xs },
  action: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  label: { ...typography.text.bodySmall, color: colors.action, textDecorationLine: 'underline' },
});
