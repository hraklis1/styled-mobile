import React, { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SelectionGroup } from '../../../components/primitives/SelectionGroup';
import { derivePalette } from '../../../lib/onboardingDefaults';
import { ONBOARDING_STYLE_OPTIONS, PALETTE_OPTIONS } from '../../../lib/profileOptions';
import { colors, spacing, typography } from '../../../theme';
import { ImageChoiceCard } from '../components/ImageChoiceCard';
import { AESTHETIC_IMAGES, AESTHETIC_TONES } from '../imagery';
import type { StepProps } from './types';

export const AESTHETIC_MIN = 2;
export const AESTHETIC_MAX = 4;

const shown = new Set(ONBOARDING_STYLE_OPTIONS.map((o) => o.value));

/** Picks among the eight shown options, in pick order. */
export function visibleAesthetics(stylePreference: readonly string[]): string[] {
  return stylePreference.filter((v) => shown.has(v));
}

export function AestheticStep({ values, set }: StepProps) {
  const [shake, setShake] = useState<{ value: string; n: number } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const picks = visibleAesthetics(values.stylePreference);
  // Profile-only styles (trend-forward, preppy, athleisure) survive a retake untouched.
  const hidden = values.stylePreference.filter((v) => !shown.has(v));
  const atCap = picks.length >= AESTHETIC_MAX;

  const toggle = (value: string) => {
    if (picks.includes(value)) {
      set('stylePreference', [...picks.filter((v) => v !== value), ...hidden]);
    } else if (atCap) {
      setShake((prev) => ({ value, n: (prev?.n ?? 0) + 1 }));
    } else {
      set('stylePreference', [...picks, value, ...hidden]);
    }
  };

  const palette = values.paletteTouched ? values.colorPalette : derivePalette(values.stylePreference);

  return (
    <View>
      <View style={s.grid}>
        {ONBOARDING_STYLE_OPTIONS.map((o) => {
          const index = picks.indexOf(o.value);
          return (
            <View key={o.value} style={s.cell}>
              <ImageChoiceCard
                label={o.label}
                description={o.description}
                image={AESTHETIC_IMAGES[o.value]}
                tones={AESTHETIC_TONES[o.value] ?? ['#EEE', '#DDD']}
                selected={index >= 0}
                order={index >= 0 ? index + 1 : undefined}
                dimmed={atCap && index < 0}
                shakeSignal={shake?.value === o.value ? shake.n : 0}
                onPress={() => toggle(o.value)}
              />
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setPaletteOpen((open) => !open);
        }}
        style={s.refine}
        accessibilityRole="button"
        accessibilityState={{ expanded: paletteOpen }}
      >
        <Text style={s.refineText}>Refine colours</Text>
        <Ionicons name={paletteOpen ? 'chevron-up' : 'chevron-forward'} size={14} color={colors.mutedForeground} />
      </Pressable>

      {paletteOpen ? (
        <View style={s.palette}>
          {!values.paletteTouched && palette.length ? (
            <Text style={s.paletteNote}>Matched to your picks. Tap to change.</Text>
          ) : null}
          <SelectionGroup
            mode="multi"
            options={PALETTE_OPTIONS}
            values={palette}
            onChange={(next) => {
              set('colorPalette', next);
              set('paletteTouched', true);
            }}
            layout="swatch"
            max={3}
          />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  cell: { width: '50%', padding: spacing.xs },
  refine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, marginTop: spacing.md },
  refineText: { ...typography.text.bodySmall, color: colors.mutedForeground },
  palette: { marginTop: spacing.xs, gap: spacing.sm },
  paletteNote: { ...typography.text.caption, color: colors.inkSubtle },
});
