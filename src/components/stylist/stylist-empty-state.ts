import type { CurrentWeather } from '../../hooks/useWeather';

export type StylistStarter = {
  title: string;
  subtitle: string;
  workflowKind: 'occasion' | 'style_piece' | 'trip' | 'wardrobe_audit' | 'wardrobe_build';
};

export function formatWeatherLead(weather: CurrentWeather, tempUnit: 'C' | 'F'): string {
  const temp = tempUnit === 'C' ? weather.temperatureC : weather.temperatureF;
  const descriptor = weather.summary.replace(/\s*(at\s+)?-?\d+\s*°\s*[CF]?\.?\s*$/i, '').trim();
  return descriptor ? `${descriptor} at ${temp}°${tempUnit}` : `${temp}°${tempUnit}`;
}

/**
 * What "Style me today" sends. Deliberately weather-free: the server resolves the
 * day's forecast itself, and a description taken from current conditions
 * ("mild and pleasant") contradicted it whenever rain was due later.
 */
export const TODAY_REQUEST = 'What should I wear today?';

/** The line shown under "Style me today": current conditions, for display only. */
export function buildTodaySubtitle(weather: CurrentWeather | undefined, tempUnit: 'C' | 'F'): string {
  if (!weather) return 'An outfit for the day ahead';
  const lead = formatWeatherLead(weather, tempUnit);
  if (weather.condition === 'cold') return `${lead} — warm and put together`;
  if (weather.condition === 'rainy') return `${lead} — dressed for the rain`;
  return `${lead} right now`;
}

export function buildStylistStarters(wardrobeCount: number): StylistStarter[] {
  return [
    {
      title: 'Dress for a plan',
      subtitle: 'Match the occasion, dress code, and mood',
      workflowKind: 'occasion',
    },
    {
      title: 'Style a piece',
      subtitle: 'Build around something you own',
      workflowKind: 'style_piece',
    },
    {
      title: 'Pack a trip',
      subtitle: 'Plan a polished travel wardrobe',
      workflowKind: 'trip',
    },
    wardrobeCount > 0
      ? {
          title: 'Edit my closet',
          subtitle: 'Spot gaps and invest with intention',
          workflowKind: 'wardrobe_audit',
        }
      : {
          title: 'Build my wardrobe',
          subtitle: 'Create a versatile foundation',
          workflowKind: 'wardrobe_build',
        },
  ];
}
