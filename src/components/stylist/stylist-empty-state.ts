import type { CurrentWeather } from '../../hooks/useWeather';

export type StylistStarter = {
  title: string;
  subtitle: string;
  prompt: string;
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
      prompt: 'Help me dress for an upcoming occasion. Ask me about the plan, dress code, and how I want to feel.',
    },
    {
      title: 'Style a piece',
      subtitle: 'Build around something you own',
      prompt: 'Help me style a piece from my wardrobe. Ask me which piece I want to build around.',
    },
    {
      title: 'Pack a trip',
      subtitle: 'Plan a polished travel wardrobe',
      prompt: 'Help me pack for an upcoming trip. Ask me about the destination, dates, plans, and luggage.',
    },
    wardrobeCount > 0
      ? {
          title: 'Edit my closet',
          subtitle: 'Spot gaps and invest with intention',
          prompt: 'Give my wardrobe a thoughtful edit. Identify what I wear most, what is missing, and where I should invest next.',
        }
      : {
          title: 'Build my wardrobe',
          subtitle: 'Create a versatile foundation',
          prompt: 'Help me build a versatile wardrobe from the ground up. Ask about my lifestyle, taste, and budget before recommending what to add.',
        },
  ];
}
