import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../../hooks/useProfile';
import { useProfilePrompts } from '../../features/profilePrompts/ProfilePromptHost';
import { promptCompleteness, remainingPrompts } from '../../features/profilePrompts/gate';
import { colors, radii, spacing, typography } from '../../theme';

const NAMES: Record<string, string> = {
  budget: 'budget',
  sizes: 'sizes',
  fit: 'fit',
  avoids: 'what you never wear',
  retailers: 'favourite shops',
};

const SIZE = 44;
const STROKE = 3;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * Profile's way into the questions onboarding deferred. Hidden once they're
 * all answered; otherwise one tap runs the open ones in a row.
 */
export function SharpenStylistCard() {
  const { data: profile } = useProfile();
  const { askAll } = useProfilePrompts();
  if (!profile) return null;
  const open = remainingPrompts(profile);
  const left = open.length;
  if (!left) return null;
  const pct = promptCompleteness(profile);

  return (
    <Pressable
      onPress={askAll}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`Sharpen your stylist. ${left} quick ${left === 1 ? 'question' : 'questions'} left.`}
    >
      <View style={s.ring}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.hairline} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={colors.foreground}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${C * pct} ${C}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        {/* A count, not a percentage: the hub already shows one, and two that disagree read as a bug. */}
        <Text style={s.ringText}>{left}</Text>
      </View>
      <View style={s.copy}>
        <Text style={s.title}>Sharpen your stylist</Text>
        <Text style={s.sub}>
          {left} quick {left === 1 ? 'question' : 'questions'} · {open.map((k) => NAMES[k]).join(', ')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', fontSize: 15, fontWeight: typography.weight.semibold, color: colors.foreground, fontVariant: ['tabular-nums'] },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.text.actionTitle, color: colors.foreground },
  sub: { ...typography.text.caption, color: colors.mutedForeground },
});
