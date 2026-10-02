import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';

/**
 * A faint garment outline standing in for a piece the closet doesn't have
 * yet. Drawn on a 48×48 grid with one stroke weight so every category reads
 * as the same family.
 */
const PATHS: Record<string, string> = {
  // Belted trench: collar notch, long body, belt line.
  outerwear: 'M18 6 L24 12 L30 6 L38 10 L42 28 L37 29 L36 18 L35 44 L13 44 L12 18 L11 29 L6 28 L10 10 Z M24 12 L24 44 M13 27 L35 27',
  // Crew knit: ribbed hem and cuffs.
  top: 'M18 7 Q24 11 30 7 L40 12 L43 26 L37 27 L36 20 L36 42 L12 42 L12 20 L11 27 L5 26 L8 12 Z M12 39 L36 39',
  bottom: 'M14 6 L34 6 L36 43 L27 43 L24 16 L21 43 L12 43 Z M14 10 L34 10',
  shoes: 'M5 32 L5 24 Q12 24 18 20 L22 18 Q27 25 36 27 Q43 28 43 33 L43 36 L5 36 Z M5 32 L43 32',
  bag: 'M9 18 L39 18 L41 42 L7 42 Z M17 18 Q17 8 24 8 Q31 8 31 18',
  full_body: 'M19 5 L24 9 L29 5 L32 8 L30 18 L38 43 L10 43 L18 18 L16 8 Z M18 18 L30 18',
  accessory: 'M24 8 A16 16 0 1 0 24.01 8 Z M24 15 A9 9 0 1 0 24.01 15 Z',
};

function pathFor(category: string): string {
  const key = category.toLowerCase();
  if (key === 'dress') return PATHS.full_body;
  if (key === 'accessories' || key === 'valuables') return PATHS.accessory;
  return PATHS[key] ?? PATHS.top;
}

export function CategorySilhouette({ category, size = 56, color = colors.accentInk }: {
  category: string; size?: number; color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessible={false}>
      <Path d={pathFor(category)} fill={color} fillOpacity={0.08} stroke={color} strokeOpacity={0.55}
        strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
