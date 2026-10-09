import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import { ONBOARDING_OCCASION_OPTIONS } from '../../../lib/profileOptions';
import { spacing } from '../../../theme';
import { ChoiceRow } from '../components/ChoiceRow';
import type { StepProps } from './types';

export const OCCASION_MAX = 3;

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  work: 'briefcase-outline',
  weekends: 'cafe-outline',
  evenings: 'wine-outline',
  events: 'ribbon-outline',
  active: 'barbell-outline',
  travel: 'airplane-outline',
  campus: 'school-outline',
};

export function OccasionStep({ values, set }: StepProps) {
  const picks = values.occasionPicks;
  const atCap = picks.length >= OCCASION_MAX;

  return (
    <View style={s.list}>
      {ONBOARDING_OCCASION_OPTIONS.map((o, i) => {
        const selected = picks.includes(o.value);
        return (
          <ChoiceRow
            key={o.value}
            index={i}
            label={o.label}
            icon={ICONS[o.value] ?? 'ellipse-outline'}
            selected={selected}
            dimmed={atCap && !selected}
            onPress={() => {
              if (selected) set('occasionPicks', picks.filter((v) => v !== o.value));
              else if (!atCap) set('occasionPicks', [...picks, o.value]);
            }}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: spacing.sm },
});
