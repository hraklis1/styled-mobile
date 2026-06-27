// Temperature display helpers — one place so every surface (Home, Stylist, daily
// pick) shows the same unit. The user's `profile.tempUnit` may be 'F' | 'C' |
// 'auto' | null; we mirror the Stylist header's rule: anything other than an
// explicit 'C' renders °F.

export type ResolvedTempUnit = 'C' | 'F';

export function resolveTempUnit(tempUnit?: string | null): ResolvedTempUnit {
  return tempUnit === 'C' ? 'C' : 'F';
}

type TempReadable = { temperatureC: number; temperatureF: number };

/** Rounded temperature value in the user's preferred unit (no degree symbol). */
export function tempValue(weather: TempReadable, tempUnit?: string | null): number {
  return Math.round(resolveTempUnit(tempUnit) === 'C' ? weather.temperatureC : weather.temperatureF);
}

/** Formatted temperature like "63°F" / "17°C". */
export function formatTemp(weather: TempReadable, tempUnit?: string | null): string {
  const unit = resolveTempUnit(tempUnit);
  return `${tempValue(weather, tempUnit)}°${unit}`;
}
