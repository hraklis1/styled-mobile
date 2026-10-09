import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FIT_PREFERENCE_OPTIONS } from '../../../lib/profileOptions';
import { colors, spacing, typography } from '../../../theme';
import { ImageChoiceCard } from '../components/ImageChoiceCard';
import { CUT_IMAGES, CUT_TONES } from '../imagery';
import type { StepProps } from './types';

const LABELS: Record<string, string> = {
  masculine_cut: 'Menswear',
  feminine_cut: 'Womenswear',
  neutral_fluid: 'Both, or fluid',
};

/** One tap answers and advances; the parent owns the advance beat. */
export function CutStep({ values, set, onPicked }: StepProps & { onPicked: (patch: { fitPreference: string }) => void }) {
  return (
    <View style={s.list}>
      {FIT_PREFERENCE_OPTIONS.map((o) => (
        <ImageChoiceCard
          key={o.value}
          label={LABELS[o.value] ?? o.label}
          image={CUT_IMAGES[o.value]}
          tones={CUT_TONES[o.value] ?? ['#EEE', '#DDD']}
          selected={values.fitPreference === o.value}
          aspectRatio={2.6}
          onPress={() => {
            set('fitPreference', o.value);
            onPicked({ fitPreference: o.value });
          }}
        />
      ))}
      <Text style={s.note}>Sets sizes and shapes. Change it anytime.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: spacing.md },
  note: { ...typography.text.bodySmall, color: colors.mutedForeground, marginTop: spacing.xs },
});
