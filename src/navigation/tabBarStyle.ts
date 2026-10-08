import { StyleSheet } from 'react-native';

import { colors } from '../theme';

/** The app tab bar's style. Screens that hide the bar restore exactly this. */
export function baseTabBarStyleFor(bottomInset: number) {
  return {
    height: 60 + bottomInset,
    paddingBottom: bottomInset,
    backgroundColor: colors.background,
    borderTopColor: colors.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
  };
}
