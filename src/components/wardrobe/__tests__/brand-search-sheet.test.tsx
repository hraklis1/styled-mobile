import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Keyboard } from 'react-native';
import { BrandSearchSheet } from '../scan-review/BrandSearchSheet';
import { WorkspaceSheet } from '../scan-review/WorkspaceSheet';
import { BrandPicker } from '../scan-review/pickers';
import { selectionFeedback, bulkFeedback } from '../scan-review/feedback';

jest.mock('@expo/ui', () => ({ Host: 'Host', RNHostView: 'RNHostView' }));
jest.mock('../scan-review/NativeReviewSheet', () => ({ NativeReviewSheet: 'NativeReviewSheet' }));
jest.mock('../scan-review/pickers', () => ({ BrandPicker: 'BrandPicker' }));
jest.mock('../scan-review/feedback', () => ({ selectionFeedback: jest.fn(), bulkFeedback: jest.fn() }));

it('applies a brand once to its targets and closes only after native dismissal', () => {
  const select = jest.fn();
  const close = jest.fn();
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  let renderer!: TestRenderer.ReactTestRenderer;
  const render = (dismissed: boolean) => <BrandSearchSheet targetIds={['a', 'b']} current="" suggestions={['COS']} scanBrands={[]} dismissed={dismissed} reduceMotion onSelect={select} onClose={close} />;
  act(() => { renderer = TestRenderer.create(render(false)); });
  expect(renderer.root.findByType(WorkspaceSheet).props.detent).toBe('large');
  act(() => {
    renderer.root.findByType(BrandPicker).props.onSelect('COS');
    renderer.root.findByType(BrandPicker).props.onSelect('Other');
  });
  expect(select).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledWith(['a', 'b'], 'COS');
  expect(bulkFeedback).toHaveBeenCalledTimes(1);
  expect(selectionFeedback).not.toHaveBeenCalled();
  act(() => renderer.update(render(true)));
  const native = renderer.root.findByType('NativeReviewSheet' as never);
  expect(native.props.isPresented).toBe(false);
  expect(dismiss).toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  act(() => native.props.onDismiss());
  expect(close).toHaveBeenCalledTimes(1);
  act(() => renderer.unmount());
  dismiss.mockRestore();
});

it('dismissal without choosing leaves metadata unchanged', () => {
  const select = jest.fn();
  const close = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<BrandSearchSheet targetIds={['a']} current="COS" suggestions={[]} scanBrands={[]} dismissed={false} reduceMotion onSelect={select} onClose={close} />); });
  act(() => renderer.root.findByType('NativeReviewSheet' as never).props.onDismiss());
  expect(close).toHaveBeenCalledTimes(1);
  expect(select).not.toHaveBeenCalled();
  act(() => renderer.unmount());
});
