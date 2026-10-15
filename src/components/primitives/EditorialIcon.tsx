import Svg, { Path } from 'react-native-svg';
import { colors, stroke } from '../../theme';

const paths = {
  sun: 'M12 3V1 M12 23v-2 M3 12H1 M23 12h-2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  stylist: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z M8 10h8 M8 14h5',
  closet: 'M3 8h4l2-3h6l2 3h4v12H3Z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  wear: 'M4 5h16v16H4Z M4 9h16 M8 3v4 M16 3v4 M8 15l3 3 5-6',
  shop: 'M6 3h12v19l-6-4-6 4Z',
  Home: 'M3 10l9-7 9 7 M5 9v12h5v-7h4v7h5V9',
  Closet: 'M3 5h18v15H3Z M3 14h5l2 3h4l2-3h5 M7 9h10',
  Stylist: 'M5 4h14a2 2 0 0 1 2 2v12H9l-6 4V6a2 2 0 0 1 2-2Z M8 10h8 M8 14h5',
  Shop: 'M4 8h16l1 13H3Z M8 8V6a4 4 0 0 1 8 0v2',
  Calendar: 'M4 5h16v16H4Z M4 9h16 M8 3v4 M16 3v4',
  history: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.5V12l3 2',
  compose: 'M12 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7 M17.5 3.5l3 3L12 15H9v-3Z',
  image: 'M4 5h16v14H4Z M4 16l5-5 4 4 2-2 5 5 M16 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z M5.5 11a6.5 6.5 0 0 0 13 0 M12 17.5V21',
};

/** One optical size and stroke for Home actions and persistent navigation. */
export function EditorialIcon({ name, size = 22, color = colors.foreground, strokeWidth = stroke.icon }: {
  name: keyof typeof paths; size?: number; color?: string; strokeWidth?: number;
}) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    <Path d={paths[name]} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}
