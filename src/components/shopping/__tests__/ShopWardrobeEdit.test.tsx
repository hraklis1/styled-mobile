import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { ShopWardrobeEdit } from '../ShopWardrobeEdit';
import type { ShoppingBrief, ShoppingBriefPriority } from '../../../lib/shopDecisionWorkspace';
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => { const React = jest.requireActual('react'); return { __esModule: true, default: function MockPressable({ children, ...props }: any) { return React.createElement('Pressable', props, children); } }; });
jest.mock('../CuratedItemRail', () => ({ CuratedItemRail: 'CuratedItemRail' }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
const mockDismiss = jest.fn();
const mockUndo = jest.fn();
let mockPending: { id: string; localDate: string; label: string; submitting: boolean }[] = [];
jest.mock('../../../hooks/useShoppingFeedback', () => ({ useShoppingFeedback: () => ({ pending: mockPending, error: null, dismiss: mockDismiss, undo: mockUndo }) }));
const mockEdit = jest.fn();
jest.mock('../../../hooks/useShoppingPriorityEdit', () => ({ useShoppingPriorityEdit: (...args: any[]) => mockEdit(...args) }));
const first: ShoppingBriefPriority = { label: 'Leather shoes', category: 'shoes', context: 'With tailoring', priority: 1, reason: 'wardrobe_gap', unlocks: [], recommendationKey: 'shoes' };
const second = { ...first, label: 'Trousers', priority: 2, recommendationKey: 'trousers' };
const brief: ShoppingBrief = { status: 'ready', headline: 'Your edit', summary: 'Nothing else to add.', source: 'rules', generatedAt: '2026-10-05T12:00:00Z', localDate: '2026-10-05', priorities: [first, second] };
const wardrobe = new Map();
let renderer: TestRenderer.ReactTestRenderer;
function render(data = brief) { act(() => { renderer = TestRenderer.create(<ShopWardrobeEdit brief={data} wardrobe={wardrobe} onGuide={() => {}} onBrief={() => {}} />); }); }
function update(data: ShoppingBrief) { act(() => renderer.update(<ShopWardrobeEdit brief={data} wardrobe={wardrobe} onGuide={() => {}} onBrief={() => {}} />)); }
beforeEach(() => { mockPending = []; mockEdit.mockReset().mockReturnValue({ data: undefined, isLoading: true }); jest.clearAllMocks(); });
afterEach(() => act(() => renderer?.unmount()));
test('switching priorities fetches only the selected preview and stale selection falls back', () => {
  render();
  expect(mockEdit).toHaveBeenLastCalledWith(first, expect.objectContaining({ purpose: 'preview', origin: 'shopping_brief' }));
  expect(mockEdit.mock.calls.every(call => call[0] === first)).toBe(true);
  const tabs = renderer.root.findAllByType(Pressable).filter(node => node.props.accessibilityRole === 'tab');
  act(() => tabs[1].props.onPress());
  expect(mockEdit).toHaveBeenLastCalledWith(second, expect.anything());
  update({ ...brief, priorities: [first] });
  expect(mockEdit).toHaveBeenLastCalledWith(first, expect.anything());
});
test('hiding the last priority keeps undo available and never fetches a removed priority', () => {
  render({ ...brief, priorities: [first] });
  act(() => renderer.root.findAllByType(Pressable).find(node => node.props.accessibilityLabel === 'Not now: Leather shoes')!.props.onPress());
  expect(mockDismiss).toHaveBeenCalledWith(expect.objectContaining({ recommendationKey: 'shoes', feedbackReason: 'not_relevant_now' }));
  mockPending = [{ id: 'hidden', localDate: brief.localDate!, label: first.label, submitting: false }];
  mockEdit.mockClear();
  update({ ...brief, priorities: [] });
  expect(mockEdit).not.toHaveBeenCalled();
  act(() => renderer.root.findAllByType(Pressable).find(node => node.props.accessibilityLabel === 'Undo hiding Leather shoes')!.props.onPress());
  expect(mockUndo).toHaveBeenCalledWith('hidden');
});
test('collection reasoning appears once, and no-buy results show guidance without products', () => {
  mockEdit.mockReturnValue({ data: { status: 'ready', commerceReference: 'ref', targets: [{ key: 'white', rationale: 'Pairs with your navy tailoring.', offers: [{ inStock: null }], offerState: { status: 'ready' } }] } });
  render();
  expect(renderer.root.findAllByType(Text).filter(node => node.props.children === 'Pairs with your navy tailoring.')).toHaveLength(1);
  act(() => renderer.unmount());
  mockEdit.mockReturnValue({ data: { status: 'no_buy', noBuyReason: 'Already covered.', targets: [] } });
  render();
  expect(renderer.root.findAllByType('CuratedItemRail' as any)).toHaveLength(0);
  expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Already covered.')).toBe(true);
});
