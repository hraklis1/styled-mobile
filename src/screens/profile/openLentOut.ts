import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/**
 * Lent Out lives in the Closet tab; Profile is a modal over Home. Close the
 * modal, then open Lent Out with the closet underneath it so Back lands in
 * the closet.
 */
export function openLentOut(navigation: NavigationProp<ParamListBase>) {
  const home = navigation.getParent();
  const tabs = home?.getParent();
  home?.goBack();
  tabs?.navigate('Closet', { screen: 'LentOut', initial: false });
}
