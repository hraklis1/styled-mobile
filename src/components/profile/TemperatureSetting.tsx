import { SegmentRow } from './SettingsUI';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { resolveTempUnit } from '../../lib/temperature';

/** Shared control so the Settings overview and Stylist always save the same preference. */
export function TemperatureSetting() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const unit = profile?.tempUnit === 'C' || profile?.tempUnit === 'F' ? profile.tempUnit : 'auto';
  const autoUnit = resolveTempUnit(null, profile?.location);

  return <SegmentRow
    label="Temperature units"
    options={[{ value: 'auto', label: `Auto (°${autoUnit})` }, { value: 'C', label: 'Celsius (°C)' }, { value: 'F', label: 'Fahrenheit (°F)' }] as const}
    value={unit}
    detail={unit === 'auto'
      ? `Uses your saved home location${profile?.location ? `: ${profile.location}` : '. Add a home location in Stylist settings to detect units'}.`
      : 'Your selection overrides location for weather and styling.'}
    onChange={value => update.mutate({ tempUnit: value === 'auto' ? null : value })}
  />;
}
