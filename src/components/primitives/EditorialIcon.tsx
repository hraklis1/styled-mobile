import Svg, { Path } from 'react-native-svg';
import { colors, stroke } from '../../theme';

const paths = {
  stylist: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z M8 10h8 M8 14h5',
  closet: 'M3 8h4l2-3h6l2 3h4v12H3Z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  wear: 'M4 5h16v16H4Z M4 9h16 M8 3v4 M16 3v4 M8 15l3 3 5-6',
  shop: 'M6 3h12v19l-6-4-6 4Z',
  Home: 'M3 10l9-7 9 7 M5 9v12h5v-7h4v7h5V9',
  Closet: 'M3 5h18v15H3Z M3 14h5l2 3h4l2-3h5 M7 9h10',
  Stylist: 'M5 4h14a2 2 0 0 1 2 2v12H9l-6 4V6a2 2 0 0 1 2-2Z M8 10h8 M8 14h5',
  Shop: 'M4 8h16l1 13H3Z M8 8V6a4 4 0 0 1 8 0v2',
  Calendar: 'M4 5h16v16H4Z M4 9h16 M8 3v4 M16 3v4',
};

/** One optical size and stroke for Home actions and persistent navigation. */
export function EditorialIcon({ name, size = 22, color = colors.foreground }: {
  name: keyof typeof paths; size?: number; color?: string;
}) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    <Path d={paths[name]} fill="none" stroke={color} strokeWidth={stroke.icon} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}
