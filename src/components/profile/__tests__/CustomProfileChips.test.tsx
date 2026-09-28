import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable, TextInput } from 'react-native';
import { CustomProfileChips } from '../CustomProfileChips';
import { SelectionGroup } from '../../primitives/SelectionGroup';
import { MATERIAL_OPTIONS, OCCASION_OPTIONS } from '../../../lib/profileOptions';

jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => {
  const React = jest.requireActual('react');
  return { __esModule: true, default: function TestPressable({ children, ...props }: any) {
    return React.createElement('TestPressable', props, children);
  } };
});
jest.mock('../../primitives/SelectionGroup', () => ({
  SelectionGroup: ({ trailing }: any) => trailing ?? null,
}));
let renderer: TestRenderer.ReactTestRenderer;
function render(props: Partial<React.ComponentProps<typeof CustomProfileChips>> = {}) {
  const onChange = jest.fn();
  act(() => { renderer = TestRenderer.create(<CustomProfileChips label="material"
    options={MATERIAL_OPTIONS} values={[]} onChange={onChange} {...props} />); });
  return onChange;
}
function press(label: string) {
  act(() => renderer.root.findAllByType(Pressable).find((node) => node.props.accessibilityLabel === label)!.props.onPress());
}
function type(value: string) { act(() => renderer.root.findByType(TextInput).props.onChangeText(value)); }
afterEach(() => { act(() => renderer.unmount()); });

test('adds a term, displays it after reload, and allows removal', () => {
  const onChange = render();
  press('Add your own material'); type('Merino'); press('Add material');
  expect(onChange).toHaveBeenLastCalledWith(['Merino']);
  act(() => renderer.update(<CustomProfileChips label="material" options={MATERIAL_OPTIONS}
    values={['Merino']} onChange={onChange} />));
  const group = renderer.root.findByType(SelectionGroup);
  expect(group.props.options.some((option: any) => option.label === 'Merino')).toBe(true);
  act(() => group.props.onChange([]));
  expect(onChange).toHaveBeenLastCalledWith([]);
});
test('rejects duplicate terms and disables adding at the selection cap', () => {
  const onChange = render({ values: ['Merino'] });
  press('Add your own material'); type(' merino '); press('Add material');
  expect(onChange).not.toHaveBeenCalled();
  act(() => renderer.update(<CustomProfileChips label="material" options={MATERIAL_OPTIONS}
    values={['Merino']} max={1} onChange={onChange} />));
  expect(renderer.root.findAllByType(Pressable).find((node) => node.props.accessibilityLabel === 'Add your own material')!.props.disabled).toBe(true);
});
test('requires a category before adding a custom occasion', () => {
  const onAddOccasion = jest.fn();
  render({ label: 'occasion', options: OCCASION_OPTIONS, onAddOccasion });
  press('Add your own occasion'); type('Gallery openings'); press('Add occasion');
  expect(onAddOccasion).not.toHaveBeenCalled();
  act(() => renderer.root.findAllByType(SelectionGroup).find((node) => node.props.mode === 'single')!.props.onChange('smart_casual'));
  press('Add occasion');
  expect(onAddOccasion).toHaveBeenCalledWith('Gallery openings', 'smart_casual');
});
