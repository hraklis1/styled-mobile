import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { radii, stroke, typography } from '../../theme';

export type TabIconName = 'Home' | 'Closet' | 'Stylist' | 'Shop' | 'Calendar';

/** Drawn on a 24-unit grid at 1.25 units, ≈1.1pt on screen at 22pt. */
const STROKE_WIDTH = 1.25;

type Props = {
  name: TabIconName;
  color: string;
  focused: boolean;
  size?: number;
};

/**
 * Fine-line tab icons. Ionicons' outline set is drawn at ~1.4pt, heavier than
 * the page's hairline rules; these match the 1pt stroke used across the rest
 * of the chrome. Active state is ink plus a short hairline over the icon,
 * never a filled glyph.
 */
export function TabIcon({ name, color, focused, size = 22 }: Props) {
  return (
    <View style={styles.root}>
      <View style={[styles.indicator, focused ? { backgroundColor: color } : null]} />
      {name === 'Stylist' ? (
        <StylistMark color={color} size={size} />
      ) : (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          {GLYPHS[name](color)}
        </Svg>
      )}
    </View>
  );
}

const line = (color: string) => ({
  stroke: color,
  strokeWidth: STROKE_WIDTH,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

const GLYPHS: Record<Exclude<TabIconName, 'Stylist'>, (color: string) => React.ReactNode> = {
  Home: (color) => (
    <>
      <Path d="M4 10.5 12 4l8 6.5" {...line(color)} />
      <Path d="M6 9v10.5h12V9" {...line(color)} />
      <Path d="M10 19.5v-5h4v5" {...line(color)} />
    </>
  ),
  // A hanger: the closet's own object rather than a filing tray.
  Closet: (color) => (
    <>
      <Path d="M12 8.5V7.6c0-.6.3-1 .8-1.3a1.8 1.8 0 1 0-2.6-1.6" {...line(color)} />
      <Path d="M12 8.5 3.6 15.2c-.7.6-.3 1.8.6 1.8h15.6c.9 0 1.3-1.2.6-1.8L12 8.5Z" {...line(color)} />
    </>
  ),
  Shop: (color) => (
    <>
      <Path d="M5.5 8h13l-1 12h-11l-1-12Z" {...line(color)} />
      <Path d="M9 10V7a3 3 0 0 1 6 0v3" {...line(color)} />
    </>
  ),
  Calendar: (color) => (
    <>
      <Rect x={4} y={5.5} width={16} height={14.5} rx={1.5} {...line(color)} />
      <Path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" {...line(color)} />
    </>
  ),
};

/**
 * The stylist's monogram: a serif "S" in a fine ring.
 */
function StylistMark({ color, size }: { color: string; size: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" style={StyleSheet.absoluteFill}>
        <Circle cx={12} cy={12} r={9.5} {...line(color)} />
      </Svg>
      <Text style={[styles.monogram, { color }]} maxFontSizeMultiplier={1}>S</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  // Out of flow, so the icon keeps the tab bar's own vertical rhythm.
  indicator: {
    position: 'absolute',
    top: -7,
    width: 18,
    height: stroke.fine,
    borderRadius: radii.full,
    backgroundColor: 'transparent',
  },
  monogram: {
    fontFamily: typography.family.editorialMedium,
    fontSize: 13,
    lineHeight: 15,
  },
});
