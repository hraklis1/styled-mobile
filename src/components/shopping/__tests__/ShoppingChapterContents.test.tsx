import React, { useLayoutEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, Text, View } from 'react-native';
import { useShoppingChapters } from '../ShoppingChapterContents';
let mockReducedMotion = true;
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => mockReducedMotion }));
let nav: ReturnType<typeof useShoppingChapters>;
let renderer: TestRenderer.ReactTestRenderer;
function Harness({ identity = 'one' }: { identity?: string }) { const value = useShoppingChapters(identity); useLayoutEffect(() => { nav = value; }); return null; }
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); mockReducedMotion = true; jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {}); act(() => { renderer = TestRenderer.create(<Harness />); }); });
afterEach(() => { act(() => renderer.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });
function setup() {
  const scrollTo = jest.fn();
  const node = { measureLayout: jest.fn((_content, success) => success(0, 250)) };
  nav.scroll.current = { scrollTo } as any;
  nav.content.current = {} as View;
  nav.chapters.current.set('style', node as any);
  nav.headings.current.set('style', { _nativeTag: 42 } as unknown as Text);
  return { node, scrollTo };
}
test('jump measures current layout, scrolls without motion and focuses the heading', () => {
  const { node, scrollTo } = setup();
  act(() => nav.jump('style'));
  expect(scrollTo).toHaveBeenCalledWith({ y: 250, animated: false });
  act(() => jest.runOnlyPendingTimers());
  expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(42);
  node.measureLayout.mockImplementation((_content, success) => success(0, 480));
  act(() => nav.jump('style'));
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 480, animated: false });
});
test('removed chapters never scroll or receive stale focus', () => {
  const { scrollTo } = setup();
  act(() => nav.jump('style'));
  nav.chapters.current.delete('style');
  act(() => jest.runOnlyPendingTimers());
  expect(AccessibilityInfo.setAccessibilityFocus).not.toHaveBeenCalled();
  scrollTo.mockClear();
  act(() => nav.jump('style'));
  expect(scrollTo).not.toHaveBeenCalled();
});
test('normal motion animates and identity changes cancel pending focus', () => {
  mockReducedMotion = false;
  act(() => renderer.update(<Harness identity="normal" />));
  const { scrollTo } = setup();
  act(() => nav.jump('style'));
  expect(scrollTo).toHaveBeenCalledWith({ y: 250, animated: true });
  act(() => renderer.update(<Harness identity="updated" />));
  act(() => jest.runOnlyPendingTimers());
  expect(AccessibilityInfo.setAccessibilityFocus).not.toHaveBeenCalled();
});
