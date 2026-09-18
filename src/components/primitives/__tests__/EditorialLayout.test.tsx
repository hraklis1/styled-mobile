import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { ScreenHeader } from '../Editorial';
import { SearchField } from '../SearchField';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
}));
jest.mock('../PressableScale', () => ({ PressableScale: 'PressableScale' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const dimensions = jest.mocked(useWindowDimensions);
function setScreen(width: number, fontScale: number) {
  dimensions.mockReturnValue({ width, height: 844, scale: 3, fontScale });
}

describe('Editorial responsive controls', () => {
  it.each([[320, 1], [375, 1.6], [402, 2]])(
    'reflows the masthead and keeps its action at width %i and text scale %f',
    (width, fontScale) => {
      setScreen(width, fontScale);
      const onPress = jest.fn();
      const header = ScreenHeader({
        title: 'A long wardrobe title',
        titleVariant: 'display',
        primaryAction: { label: 'Create outfit', icon: 'add', onPress },
      });
      expect(StyleSheet.flatten(header.props.style).flexDirection).toBe('column');
      expect(StyleSheet.flatten(header.props.style).paddingTop).toBeGreaterThan(47);
      const actions = header.props.children[1];
      const action = actions.props.children[1];
      action.props.onPress();
      expect(onPress).toHaveBeenCalledTimes(1);
    },
  );

  it('retains the horizontal masthead at a normal phone size', () => {
    setScreen(402, 1);
    const header = ScreenHeader({ title: 'Closet' });
    expect(StyleSheet.flatten(header.props.style).flexDirection).toBe('row');
  });

  it('allows the search input to grow for large text without losing its value or callback', () => {
    setScreen(375, 2);
    const onChangeText = jest.fn();
    const field = SearchField({ value: 'linen', onChangeText });
    const input = React.Children.toArray(field.props.children)[1] as React.ReactElement<any>;
    expect(StyleSheet.flatten(input.props.style).height).toBeGreaterThan(44);
    expect(input.props.value).toBe('linen');
    input.props.onChangeText('wool');
    expect(onChangeText).toHaveBeenCalledWith('wool');
  });
});
