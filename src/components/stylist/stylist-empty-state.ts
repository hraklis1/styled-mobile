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

export function buildTodayPrompt(weather: CurrentWeather | undefined, tempUnit: 'C' | 'F'): string {
  const day = new Date().toLocaleDateString('en', { weekday: 'long' });

  if (!weather) return 'What should I wear today?';

  const lead = formatWeatherLead(weather, tempUnit);
  if (weather.condition === 'cold') return `${lead} — help me stay warm and stylish`;
  if (weather.condition === 'rainy') return `${lead} — what should I wear?`;
  return `${lead} — what should I wear ${day}?`;
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
