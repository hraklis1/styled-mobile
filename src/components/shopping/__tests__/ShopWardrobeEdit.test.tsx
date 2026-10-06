jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { ShopWardrobeEdit } from '../ShopWardrobeEdit';
import type { ShoppingBrief, ShoppingBriefPriority } from '../../../lib/shopDecisionWorkspace';
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => { const React = jest.requireActual('react'); return { __esModule: true, default: function MockPressable({ children, ...props }: any) { return React.createElement('Pressable', props, children); } }; });
jest.mock('react-native/Libraries/Components/View/View', () => { const React = jest.requireActual('react'); return { __esModule: true, default: React.forwardRef(function MockView(props: any, ref: any) { return React.createElement('View', { ...props, ref }, props.children); }) }; });
jest.mock('../ShoppingOutfitPreview', () => ({ ShoppingOutfitPreview: 'ShoppingOutfitPreview' }));
jest.mock('../WardrobeThumbnail', () => ({ WardrobeThumbnail: 'WardrobeThumbnail' }));
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
test('shows every priority in rank order and defers previews until near the viewport', () => {
  let secondY = 10000;
  act(() => { renderer = TestRenderer.create(<ShopWardrobeEdit brief={{ ...brief, priorities: [second, first] }} wardrobe={wardrobe} onGuide={() => {}} onBrief={() => {}} />, { createNodeMock: (element: any) => element.props.testID ? { measureInWindow: (callback: (x: number, y: number) => void) => callback(0, element.props.testID === 'shop-addition-trousers' ? secondY : 0) } : null }); });
  act(() => renderer.root.findAll(node => typeof node.type === 'string' && node.props.testID?.startsWith('shop-addition-')).forEach(node => node.props.onLayout()));
  const calls = mockEdit.mock.calls;
  expect(calls.filter(call => call[0] === first).at(-1)[1].enabled).toBe(true);
  expect(calls.filter(call => call[0] === second).at(-1)[1].enabled).toBe(false);
  const headings = renderer.root.findAllByType(Text).filter(node => node.props.accessibilityRole === 'header');
  expect(headings.map(node => node.props.children)).toEqual(['Two additions to consider', 'Leather shoes', 'Trousers']);
  secondY = 100;
  act(() => renderer.update(<ShopWardrobeEdit brief={brief} wardrobe={wardrobe} onGuide={() => {}} onBrief={() => {}} scrollOffset={900} />));
  expect(mockEdit.mock.calls.filter(call => call[0] === second).at(-1)[1].enabled).toBe(true);
  mockEdit.mockClear();
  update({ ...brief, priorities: [first] });
  expect(mockEdit.mock.calls.every(call => call[0] === first)).toBe(true);
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
  render({ ...brief, priorities: [first] });
  expect(renderer.root.findAllByType(Text).filter(node => node.props.children === 'Pairs with your navy tailoring.')).toHaveLength(1);
  act(() => renderer.unmount());
  mockEdit.mockReturnValue({ data: { status: 'no_buy', noBuyReason: 'Already covered.', targets: [] } });
  render();
  expect(renderer.root.findAllByType('CuratedItemRail' as any)).toHaveLength(0);
  expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Already covered.')).toBe(true);
});

test('uses a target outfit before priority anchors and keeps full reasoning visible', () => {
  const target = { key: 'white', rationale: 'A long, complete explanation of why this style works.', outfitIdeas: [{ label: 'With tailoring', itemIds: [1, 2] }], offers: [], offerState: { status: 'empty' } };
  mockEdit.mockReturnValue({ data: { status: 'ready', targets: [target] } });
  act(() => { renderer = TestRenderer.create(<ShopWardrobeEdit brief={{ ...brief, priorities: [first] }} wardrobe={new Map([[1, { id: 1, name: 'Jacket' } as any]])} onGuide={() => {}} onBrief={() => {}} />); });
  expect(renderer.root.findAllByType('ShoppingOutfitPreview' as any)).toHaveLength(1);
  const reason = renderer.root.findAllByType(Text).find(node => node.props.children === target.rationale)!;
  expect(reason.props.numberOfLines).toBeUndefined();
});

test('overview is count-aware and chapter selection does not open the guide', () => {
  const onGuide = jest.fn(), onJump = jest.fn(), onBrief = jest.fn();
  act(() => { renderer = TestRenderer.create(<ShopWardrobeEdit brief={brief} wardrobe={wardrobe} onGuide={onGuide} onBrief={onBrief} onJump={onJump} />); });
  expect(JSON.stringify(renderer.toJSON())).toContain('Two additions to consider');
  expect(JSON.stringify(renderer.toJSON())).not.toContain(brief.summary);
  act(() => renderer.root.findAllByType(Pressable).find(node => node.props.accessibilityHint === 'Jumps to this chapter')!.props.onPress());
  expect(onJump).toHaveBeenCalledWith('shoes');
  expect(onGuide).not.toHaveBeenCalled();
});

test('pending dismissal removes its chapter and contents immediately; undo restores both', () => {
  render();
  mockPending = [{ id: 'hidden', localDate: brief.localDate!, label: first.label, submitting: false, recommendationKey: 'shoes' } as any];
  mockEdit.mockClear();
  update(brief);
  expect(JSON.stringify(renderer.toJSON())).toContain('One addition to consider');
  expect(renderer.root.findAllByProps({ testID: 'shop-addition-shoes' })).toHaveLength(0);
  expect(mockEdit.mock.calls.every(call => call[0] === second)).toBe(true);
  mockPending = [];
  update(brief);
  expect(JSON.stringify(renderer.toJSON())).toContain('Two additions to consider');
  expect(renderer.root.findAllByProps({ testID: 'shop-addition-shoes' }).length).toBeGreaterThan(0);
});
