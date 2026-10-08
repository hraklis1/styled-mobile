import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable, StyleSheet } from 'react-native';
import { CuratedItemCard } from '../CuratedItemCard';
import type { ProductOffer } from '../../../types/commerce';
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../../../lib/haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' } }));
jest.mock('react-native-screens', () => ({ FullWindowOverlay: 'FullWindowOverlay' }));
jest.mock('../../primitives/UndoToast', () => ({ UndoToast: 'UndoToast' }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => { const React = jest.requireActual('react'); return { __esModule: true, default: function MockPressable({ children, ...props }: any) { return React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children); } }; });
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path' }));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
const offer = { id: 'one', provider: 'serper', brand: 'MUJI', title: 'MUJI Waterproof hooded jacket', merchant: 'muji.ca', formattedPrice: '', imageUrl: 'https://example.com/jacket.jpg', imagePolicy: 'hotlink', url: 'https://muji.ca/jacket', inStock: null } as ProductOffer;
let renderer: TestRenderer.ReactTestRenderer;
afterEach(() => act(() => renderer?.unmount()));
test('bookmark is independent of retailer action and retains the full original title', () => {
  const onOpen = jest.fn(), onSave = jest.fn();
  act(() => { renderer = TestRenderer.create(<CuratedItemCard offer={offer} onOpen={onOpen} onSave={onSave} />); });
  const buttons = renderer.root.findAllByType(Pressable);
  const save = buttons.find(button => button.props.accessibilityLabel?.startsWith('Add to wishlist: '))!;
  let ancestor = save.parent;
  while (ancestor) { expect(ancestor.type).not.toBe(Pressable); ancestor = ancestor.parent; }
  expect(StyleSheet.flatten(save.props.style({ pressed: false }))).toMatchObject({ width: 44, height: 44 });
  act(() => save.props.onPress());
  expect(onSave).toHaveBeenCalledTimes(1); expect(onOpen).not.toHaveBeenCalled();
  const link = buttons.find(button => button.props.accessibilityLabel?.includes('View product'))!;
  expect(link.props.accessibilityLabel).toContain(offer.title);
  expect(link.props.accessibilityLabel).toContain('see price');
  act(() => link.props.onPress()); expect(onOpen).toHaveBeenCalledTimes(1);
});
test('failed image falls back, a new image resets, and reduced motion disables transitions', () => {
  act(() => { renderer = TestRenderer.create(<CuratedItemCard offer={offer} onOpen={() => {}} />); });
  const image = renderer.root.findByType('Image' as any);
  expect(image.props).toMatchObject({ contentFit: 'contain', transition: 0, cachePolicy: 'memory' });
  act(() => image.props.onError());
  expect(renderer.root.findAllByType('Image' as any)).toHaveLength(0);
  expect(renderer.root.findAllByType('Svg' as any)).toHaveLength(1);
  act(() => renderer.update(<CuratedItemCard offer={{ ...offer, imageUrl: 'https://example.com/new.jpg', imagePolicy: 'licensed' }} onOpen={() => {}} />));
  expect(renderer.root.findByType('Image' as any).props.cachePolicy).toBe('memory-disk');
});

test('saved bookmark remains enabled with an unsave label', () => {
  act(() => { renderer = TestRenderer.create(<CuratedItemCard offer={offer} saved onOpen={() => {}} onSave={() => {}} />); });
  const button = renderer.root.findAllByType(Pressable).find(node => node.props.accessibilityLabel?.startsWith('Remove from wishlist: '))!;
  expect(button.props.disabled).toBe(false);
  expect(button.props.accessibilityLabel).toBe(`Remove from wishlist: ${offer.title}`);
  expect(button.props.accessibilityState.selected).toBe(true);
});

test('whole-product images sit inset on the plate; hero cards fill from the top', () => {
  act(() => { renderer = TestRenderer.create(<CuratedItemCard editorial offer={offer} onOpen={() => {}} />); });
  const image = renderer.root.findByType('Image' as any);
  expect(image.props).toMatchObject({ contentFit: 'contain', cachePolicy: 'memory' });
  expect(StyleSheet.flatten(image.parent!.props.style)).toMatchObject({ padding: '6%' });
  act(() => renderer.update(<CuratedItemCard editorial fit="cover" offer={offer} onOpen={() => {}} />));
  const cover = renderer.root.findByType('Image' as any);
  expect(cover.props).toMatchObject({ contentFit: 'cover', contentPosition: 'top' });
  expect(StyleSheet.flatten(cover.parent!.props.style)).not.toHaveProperty('padding');
});

test('card copy is brand, a de-duplicated title, then price with merchant and budget fit', () => {
  const hm = { ...offer, brand: null, title: 'H&M Black Slim-Fit Tailored Twill Pants', merchant: 'H&M', price: 84.99, currency: 'CAD', formattedPrice: 'CA$84.99' } as ProductOffer;
  act(() => { renderer = TestRenderer.create(<CuratedItemCard offer={hm} budget="$80–180 CAD" onOpen={() => {}} />); });
  const texts = renderer.root.findAllByType('Text' as any).map(node => [node.props.children].flat().filter(child => typeof child === 'string').join(''));
  expect(texts).toContain('H&M');
  expect(texts).toContain('Black Slim-Fit Tailored Twill Pants');
  expect(texts).toContain(' · In budget');
  expect(texts.some(text => text.includes('View product'))).toBe(false);
});

test('long-press hides where hiding is allowed', () => {
  const onHide = jest.fn();
  act(() => { renderer = TestRenderer.create(<CuratedItemCard offer={offer} onOpen={() => {}} onHide={onHide} />); });
  const open = renderer.root.findAllByType(Pressable).find(button => button.props.accessibilityLabel?.includes('View product'))!;
  act(() => open.props.onLongPress());
  expect(onHide).toHaveBeenCalledTimes(1);
});

test('"Not for me" is its own 44pt control and only appears when hiding is allowed', () => {
  const onOpen = jest.fn(), onHide = jest.fn();
  act(() => { renderer = TestRenderer.create(<CuratedItemCard offer={offer} onOpen={onOpen} />); });
  expect(renderer.root.findAllByType(Pressable).some(button => button.props.accessibilityLabel?.startsWith('Not for me'))).toBe(false);
  act(() => renderer.update(<CuratedItemCard offer={offer} onOpen={onOpen} onHide={onHide} />));
  const hide = renderer.root.findAllByType(Pressable).find(button => button.props.accessibilityLabel === `Not for me: hide ${offer.title}`)!;
  expect(StyleSheet.flatten(hide.props.style({ pressed: false }))).toMatchObject({ width: 44, height: 44 });
  act(() => hide.props.onPress());
  expect(onHide).toHaveBeenCalledTimes(1); expect(onOpen).not.toHaveBeenCalled();
});
