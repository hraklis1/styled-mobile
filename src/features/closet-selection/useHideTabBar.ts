import { useEffect } from 'react';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { baseTabBarStyleFor } from '../../navigation/tabBarStyle';
import { setSelectionChromeActive } from './selectionChrome';

/**
 * Hands the bottom of the screen to a selection: the tab bar and the global
 * trays step aside while `hidden`, and come back on exit or unmount.
 */
export function useHideTabBar(hidden: boolean, navigation: Pick<NavigationProp<ParamListBase>, 'getParent'>) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Closet screens sit in a stack inside the tab navigator; the parent is the Closet tab.
    const tabs = navigation.getParent?.();
    const restore = baseTabBarStyleFor(insets.bottom);
    if (!hidden) return;
    tabs?.setOptions({ tabBarStyle: { ...restore, display: 'none' } });
    setSelectionChromeActive(true);
    return () => {
      tabs?.setOptions({ tabBarStyle: restore });
      setSelectionChromeActive(false);
    };
  }, [hidden, navigation, insets.bottom]);
}
