import { buildStylistStarters, buildTodaySubtitle, formatWeatherLead, landingDateline, TODAY_REQUEST } from '../stylist-empty-state';
import type { CurrentWeather } from '../../../hooks/useWeather';

const mildWeather: CurrentWeather = {
  condition: 'mild',
  temperatureC: 16,
  temperatureF: 61,
  summary: 'Mild and pleasant at 16°C',
};

describe('stylist empty-state prompts', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-11T16:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('formats weather in the preferred temperature unit without duplicating the source temperature', () => {
    expect(formatWeatherLead(mildWeather, 'C')).toBe('Mild and pleasant at 16°C');
    expect(formatWeatherLead(mildWeather, 'F')).toBe('Mild and pleasant at 61°F');
  });

  it('builds weather-aware subtitles and a weather-free request', () => {
    expect(buildTodaySubtitle(mildWeather, 'C')).toBe('Mild and pleasant at 16°C right now');
    expect(buildTodaySubtitle({ ...mildWeather, condition: 'cold' }, 'C')).toBe('Mild and pleasant at 16°C — warm and put together');
    expect(buildTodaySubtitle({ ...mildWeather, condition: 'rainy' }, 'F')).toBe('Mild and pleasant at 61°F — dressed for the rain');
    expect(buildTodaySubtitle(undefined, 'C')).toBe('An outfit for the day ahead');
    // The request itself never asserts weather; the server reads the forecast.
    expect(TODAY_REQUEST).toBe('What should I wear today?');
  });

  it('keeps all four service payloads and adapts the wardrobe service', () => {
    const withWardrobe = buildStylistStarters(12);
    const withoutWardrobe = buildStylistStarters(0);

    expect(withWardrobe.map(({ title }) => title)).toEqual([
      'Dress for a plan',
      'Style a piece',
      'Pack a trip',
      'Edit my closet',
    ]);
    expect(withoutWardrobe[3]).toEqual({
      title: 'Build my wardrobe',
      subtitle: 'Create a versatile foundation',
      workflowKind: 'wardrobe_build',
    });
    expect(withWardrobe.map(({ workflowKind }) => workflowKind)).toEqual([
      'occasion',
      'style_piece',
      'trip',
      'wardrobe_audit',
    ]);
  });
});

describe('landingDateline', () => {
  it('names the weekday, day and month without the year', () => {
    const line = landingDateline(new Date(2026, 9, 15));
    expect(line).toBe('Thursday 15 October');
  });
});
