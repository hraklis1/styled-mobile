import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { LocationAutocompleteInput } from '../../../components/primitives/LocationAutocompleteInput';
import { useActiveStylingLocation } from '../../../hooks/useActiveStylingLocation';
import { useStylingWeatherToday } from '../../../hooks/useWeather';
import type { StylingLocationContext } from '../../../lib/stylingLocation';
import { deviceCountryCode } from '../../../lib/onboardingDefaults';
import { colors, radii, spacing, typography } from '../../../theme';
import type { StepProps } from './types';

// The server's `summary` repeats the temperature; the card already shows it.
const CONDITION_LABELS: Record<string, string> = { sunny: 'Sunny', rainy: 'Rain', cold: 'Cold', mild: 'Mild' };

/**
 * Location, asked by showing what it buys: a forecast card that fills in
 * once we know where you are. The OS prompt only appears after the user has
 * seen why. A typed city works just as well; skipping falls back to season.
 */
export function ClimateStep({ values, set }: StepProps) {
  const { activeLocation, permissionStatus, requestCurrentLocation } = useActiveStylingLocation();
  const granted = permissionStatus === 'granted';
  // The device location when we have it; otherwise the city the user picked,
  // which isn't saved yet so the app-wide active location can't see it. Only
  // a picked suggestion counts — previewing every keystroke would geocode
  // and fetch weather per letter.
  const [pickedCity, setPickedCity] = useState(values.location.trim());
  const typedCity = pickedCity;
  const previewLocation: StylingLocationContext =
    activeLocation.coords || !typedCity
      ? activeLocation
      : { source: 'home', label: typedCity, isFallback: false };
  const today = useStylingWeatherToday(previewLocation);
  const weather = { data: today.data?.current };
  const [requesting, setRequesting] = useState(false);
  const [typing, setTyping] = useState(false);
  const fahrenheit = deviceCountryCode() === 'US';

  const handleRequest = async () => {
    setRequesting(true);
    try {
      await requestCurrentLocation();
    } finally {
      setRequesting(false);
    }
  };

  const temp = weather.data ? Math.round(fahrenheit ? weather.data.temperatureF : weather.data.temperatureC) : null;
  const place = weather.data?.locationLabel ?? (pickedCity || null);

  return (
    <View style={s.root}>
      <View style={s.card} accessibilityLabel={temp != null ? `${temp} degrees, ${weather.data?.summary ?? ''}` : undefined}>
        <Text style={s.cardKicker}>TODAY</Text>
        {temp != null ? (
          <Animated.View entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}>
            <Text style={s.temp}>
              {temp}°
            </Text>
            <Text style={s.cardLine}>{[CONDITION_LABELS[weather.data!.condition], place].filter(Boolean).join(' · ')}</Text>
          </Animated.View>
        ) : place ? (
          <>
            <Text style={s.tempMuted}>{place}</Text>
            <Text style={s.cardLine}>We'll dress you for the weather here.</Text>
          </>
        ) : (
          <>
            <Text style={s.tempMuted}>—°</Text>
            <Text style={s.cardLine}>Your forecast appears here.</Text>
          </>
        )}
      </View>

      {!granted ? (
        <Pressable
          onPress={handleRequest}
          disabled={requesting}
          style={({ pressed }) => [s.locationBtn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          {requesting ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <Ionicons name="navigate-outline" size={18} color={colors.foreground} />
          )}
          <Text style={s.locationText}>Use my location</Text>
        </Pressable>
      ) : null}

      {permissionStatus === 'denied' && !typing ? (
        <Text style={s.hint}>Location is off. A city works just as well.</Text>
      ) : null}

      {typing ? (
        <LocationAutocompleteInput
          value={values.location}
          onChangeText={(v) => set('location', v)}
          onSelect={(v) => {
            set('location', v);
            setPickedCity(v.trim());
          }}
          placeholder="e.g. London, UK"
          showUseMyLocation={false}
          dropdownPlacement="inline"
          autoFocus
        />
      ) : (
        <Pressable onPress={() => setTyping(true)} style={s.link} accessibilityRole="button">
          <Text style={s.linkText}>{values.location ? `Home city: ${values.location}` : 'Enter a city instead'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: spacing.md },
  card: {
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    minHeight: 168,
    justifyContent: 'flex-end',
  },
  cardKicker: { ...typography.text.masthead, color: colors.mutedForeground, marginBottom: 'auto' },
  temp: { ...typography.text.editorialHero, fontSize: 64, lineHeight: 70, color: colors.foreground },
  tempMuted: { ...typography.text.editorialHero, color: colors.mutedForeground },
  cardLine: { ...typography.text.bodySmall, color: colors.inkSubtle, marginTop: spacing.xs },
  locationBtn: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.foreground,
  },
  locationText: { fontSize: typography.text.body.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  hint: { ...typography.text.caption, color: colors.mutedForeground, textAlign: 'center' },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...typography.text.bodySmall, color: colors.mutedForeground, textDecorationLine: 'underline' },
});
