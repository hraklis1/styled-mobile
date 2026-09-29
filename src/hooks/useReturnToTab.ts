import { useCallback, useEffect, useState } from 'react';
import { CommonActions, StackActions, usePreventRemove, type NavigationProp, type ParamListBase } from '@react-navigation/native';

/**
 * For a Shop stack screen opened from another tab (Home, Closet): backing or
 * swiping out should land on that tab, not on the Shop tab the screen happens
 * to live in. Returns the handler for the screen's own back button.
 *
 * Reached from another tab, the screen is the only route on the Shop stack,
 * so popping it would leave that tab with nothing to render. ShopMain is put
 * in its place after focus has been handed back.
 */
export function useReturnToTab(
  navigation: NavigationProp<ParamListBase>,
  returnTo: string | undefined,
) {
  const [returningToTab, setReturningToTab] = useState(false);

  usePreventRemove(returnTo != null && !returningToTab, () => {
    setReturningToTab(true);
  });

  useEffect(() => {
    if (!returningToTab || !returnTo) return;

    // Switch tabs first to return focus to the source tab immediately.
    navigation.dispatch(CommonActions.navigate({ name: returnTo }));

    // Reset the stack of the Shop tab to ShopMain silently in the background
    // after the tab switch has initiated, avoiding animation transition races.
    const timeout = setTimeout(() => {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'ShopMain' }],
        })
      );
    }, 100);
    return () => clearTimeout(timeout);
  }, [navigation, returningToTab, returnTo]);

  return useCallback(() => {
    if (returnTo) {
      setReturningToTab(true);
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.dispatch(StackActions.replace('ShopMain'));
  }, [navigation, returnTo]);
}
