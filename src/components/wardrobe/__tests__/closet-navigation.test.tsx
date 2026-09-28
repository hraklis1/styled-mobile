import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { ClosetNavigation } from '../closet-navigation';

jest.mock('../../primitives/PressableScale', () => ({ PressableScale: 'PressableScale' }));
jest.mock('../../primitives/Editorial', () => ({ FilterControl: 'FilterControl' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

it.each([[402, 1, 'row'], [320, 1, 'column'], [402, 1.6, 'column']])(
  'keeps section labels and controls accessible at width %i, text scale %f', (width, fontScale, direction) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width: Number(width), height: 844, scale: 3, fontScale: Number(fontScale) });
    const onChange = jest.fn();
    const onSearch = jest.fn();
    const element = <ClosetNavigation value="pieces" onChange={onChange} searchAvailable searchOpen={false}
      query="linen" onSearch={onSearch} filterCount={0} onFilter={jest.fn()} />;
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(element); });
    const root = renderer.root;
    const navigation = root.findAll(n => n.type === ('View' as any) && StyleSheet.flatten(n.props.style)?.paddingHorizontal === 24)[0];
    expect(StyleSheet.flatten(navigation.props.style).flexDirection).toBe(direction);
    const controls = root.findAllByType('PressableScale' as any);
    expect(controls.map(n => n.props.accessibilityLabel)).toEqual(['Pieces', 'Outfits', 'Boards', 'Search pieces, search active: linen']);
    controls.forEach(control => expect(StyleSheet.flatten(control.props.contentStyle).minHeight ?? StyleSheet.flatten(control.props.contentStyle).height).toBeGreaterThanOrEqual(44));
    act(() => controls[1].props.onPress());
    expect(onChange).toHaveBeenCalledWith('outfits');
    act(() => controls[3].props.onPress());
    expect(onSearch).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  },
);
