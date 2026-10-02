import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { SettingsScaffold, Group, GroupBlock, SegmentRow, ToggleRow } from '../../components/profile/SettingsUI';
import { LocationAutocompleteInput } from '../../components/primitives/LocationAutocompleteInput';
import { styles as fieldStyles } from '../../components/profile/fields';
import { useAppPreferences } from '../../hooks/useAppPreferences';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { resolveTempUnit } from '../../lib/temperature';
import { resolveCurrencyCode } from '../../lib/currency';
import { CURRENCY_OPTIONS } from '../../lib/appPreferences';
import { SelectionGroup } from '../../components/primitives/SelectionGroup';
import type { StylistAdventurousness, StylistTone } from '../../types/profile';

const TONES: { value: StylistTone; label: string }[] = [
  { value: 'concise', label: 'Concise' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
];
const TONE_DETAIL: Record<StylistTone, string> = {
  concise: 'Just the look, with a line on why.',
  balanced: 'The look plus a little styling reasoning.',
  detailed: 'Explains proportion, color and texture choices.',
};
const RANGES: { value: StylistAdventurousness; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'experimental', label: 'Bold' },
];
const RANGE_DETAIL: Record<StylistAdventurousness, string> = {
  classic: 'Proven, timeless combinations.',
  balanced: 'Mostly familiar, with the occasional twist.',
  experimental: 'Unexpected pairings and bolder color and pattern.',
};

/**
 * How the stylist talks and what it assumes. Every control applies right away:
 * tone and range shape the prompt (server/appPreferences.ts), and units and
 * currency change what Today's Look, the stylist and shopping show.
 */
export function StylistSettingsScreen() {
  const { prefs, setPrefs } = useAppPreferences();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [location, setLocation] = useState(profile?.location ?? '');
  useEffect(() => { setLocation(profile?.location ?? ''); }, [profile?.location]);

  const saveLocation = (value: string) => {
    const next = value.trim();
    setLocation(next);
    if (next !== (profile?.location ?? '')) update.mutate({ location: next || null });
  };

  // A city typed without picking a suggestion is saved when the screen closes.
  const latest = useRef({ location, saveLocation });
  latest.current = { location, saveLocation };
  useEffect(() => () => latest.current.saveLocation(latest.current.location), []);

  const tempUnit = (profile?.tempUnit === 'C' || profile?.tempUnit === 'F') ? profile.tempUnit : 'auto';
  const autoTemp = resolveTempUnit(null, location);
  const autoCurrency = resolveCurrencyCode(location);

  return (
    <SettingsScaffold title="Stylist" lede="How your stylist talks to you, and the defaults it works from.">
      <Group>
        <SegmentRow label="Answer length" options={TONES} value={prefs.stylistTone}
          detail={TONE_DETAIL[prefs.stylistTone]}
          onChange={(value) => setPrefs({ stylistTone: value })} />
        <SegmentRow label="Styling range" options={RANGES} value={prefs.adventurousness}
          detail={RANGE_DETAIL[prefs.adventurousness]}
          onChange={(value) => setPrefs({ adventurousness: value })} />
        <ToggleRow label="Suggest pieces to buy" value={prefs.shoppingLinksInAnswers}
          detail="When off, your stylist only shops when you ask."
          onChange={(value) => setPrefs({ shoppingLinksInAnswers: value })} />
      </Group>

      <Group title="Home" footer="Used when location is off, for local weather and for nearby stores.">
        <GroupBlock>
          <LocationAutocompleteInput
            value={location}
            onChangeText={setLocation}
            onSelect={saveLocation}
            dropdownPlacement="inline"
            placeholder="e.g. Brooklyn, NY"
          />
        </GroupBlock>
      </Group>

      <Group title="Units">
        <SegmentRow
          label="Temperature"
          options={[{ value: 'auto', label: `Auto (°${autoTemp})` }, { value: 'C', label: '°C' }, { value: 'F', label: '°F' }] as const}
          value={tempUnit}
          onChange={(value) => update.mutate({ tempUnit: value === 'auto' ? null : value })}
        />
        <GroupBlock>
          <View style={fieldStyles.field}>
            <Text style={fieldStyles.fieldLabel}>Currency</Text>
            <SelectionGroup
              mode="single"
              layout="pill"
              caption={null}
              options={[
                { value: 'auto', label: `Auto (${autoCurrency})` },
                ...CURRENCY_OPTIONS.map((option) => ({ value: option.value, label: `${option.symbol} ${option.value}` })),
              ]}
              value={prefs.currency ?? 'auto'}
              onChange={(value) => setPrefs({ currency: value === 'auto' ? null : value })}
            />
            <Text style={fieldStyles.hint}>Prices from your stylist and shopping are shown in this currency.</Text>
          </View>
        </GroupBlock>
      </Group>
    </SettingsScaffold>
  );
}
