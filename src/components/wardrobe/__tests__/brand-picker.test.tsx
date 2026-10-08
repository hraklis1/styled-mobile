import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BrandPicker } from '../scan-review/pickers';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../primitives/SearchField', () => ({ SearchField: 'SearchField' }));

const texts = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root.findAllByType(Text).map(node => [node.props.children].flat().join(''));

const renderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  // Unmount the real list so its deferred cell updates cannot outlive the test.
  act(() => {
    renderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

function render(props: Partial<React.ComponentProps<typeof BrandPicker>> = {}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <BrandPicker current="" suggestions={['Levi’s', 'COS', 'Nike']} scanBrands={[]} closetBrands={['Levi’s']} onSelect={jest.fn()} {...props} />,
    );
  });
  renderers.push(renderer);
  // The search bar renders its field after the first layout.
  act(() => { renderer.root.findAll(node => typeof node.props.onLayout === 'function')[0]?.props.onLayout(); });
  return renderer;
}

it('labels the closet brands apart from "Popular brands", and never calls the generic list "Suggested"', () => {
  const renderer = render();
  const shown = texts(renderer);
  expect(shown).toContain('From your closet');
  expect(shown).toContain('Popular brands');
  expect(shown).not.toContain('Suggested');
  expect(shown.indexOf('From your closet')).toBeLessThan(shown.indexOf('Levi’s'));
  expect(shown.indexOf('Popular brands')).toBeLessThan(shown.indexOf('COS'));
  expect(renderer.root.findByType('SearchField' as never).props.placeholder).toBe('Search or enter a brand');
});

it('offers an unknown brand as a clear save action, without an empty "Matching" label', () => {
  const select = jest.fn();
  const renderer = render({ onSelect: select });
  act(() => renderer.root.findByType('SearchField' as never).props.onChangeText('Aimé Leon Dore'));
  const shown = texts(renderer);
  expect(shown).toContain('Add “Aimé Leon Dore”');
  expect(shown).toContain('Save as a new brand');
  expect(shown).not.toContain('Matching');
  act(() => renderer.root.find(node => node.props.accessibilityLabel === 'Save Aimé Leon Dore as the brand').props.onPress());
  expect(select).toHaveBeenCalledWith('Aimé Leon Dore');
});
