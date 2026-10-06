jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { ShopWardrobeEdit } from '../ShopWardrobeEdit';
import type { ShoppingBrief, ShoppingBriefPriority } from '../../../lib/shopDecisionWorkspace';
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => { const React = jest.requireActual('react'); return { __esModule: true, default: function MockPressable({ children, ...props }: any) { return React.createElement('Pressable', props, children); } }; });
jest.mock('react-native/Libraries/Components/View/View', () => { const React = jest.requireActual('react'); return { __esModule: true, default: React.forwardRef(function MockView(props: any, ref: any) { return React.createElement('View', { ...props, ref }, props.children); }) }; });
jest.mock('../WardrobeThumbnail', () => ({ WardrobeThumbnail: 'WardrobeThumbnail' }));
jest.mock('../ShoppingStyleVisual', () => ({ ShoppingStyleVisual: 'ShoppingStyleVisual' }));
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
let renderer: TestRenderer.ReactTestRenderer;
function render(data = brief, onGuide: (p: ShoppingBriefPriority) => void = () => {}) { act(() => { renderer = TestRenderer.create(<ShopWardrobeEdit brief={data} onGuide={onGuide} />); }); }
function update(data: ShoppingBrief) { act(() => renderer.update(<ShopWardrobeEdit brief={data} onGuide={() => {}} />)); }
const press = (label: string) => act(() => renderer.root.findAllByType(Pressable).find(node => node.props.accessibilityLabel === label)!.props.onPress());
beforeEach(() => { mockPending = []; mockEdit.mockReset().mockReturnValue({ data: undefined, isLoading: true }); jest.clearAllMocks(); });
afterEach(() => act(() => renderer?.unmount()));

test('leads with the brief, then the count-aware edit, and no inline chapters', () => {
  render({ ...brief, priorities: [second, first] });
  const headings = renderer.root.findAllByType(Text).filter(node => node.props.accessibilityRole === 'header');
  expect(headings.map(node => node.props.children)).toEqual(['Your shopping brief', 'Two additions to consider']);
  const json = JSON.stringify(renderer.toJSON());
  expect(json.indexOf(brief.summary)).toBeGreaterThan(-1);
  expect(json.indexOf(brief.summary)).toBeLessThan(json.indexOf('Two additions to consider'));
  expect(json).not.toContain('Shop it');
  expect(json.indexOf('Leather shoes')).toBeLessThan(json.indexOf('Trousers'));
});

test('selecting an addition opens its full guide', () => {
  const onGuide = jest.fn();
  render(brief, onGuide);
  act(() => renderer.root.findAllByType(Pressable).find(node => node.props.accessibilityHint === 'Opens the full guide')!.props.onPress());
  expect(onGuide).toHaveBeenCalledWith(first);
});

test('row thumbnails come from the preview fetch of every listed priority', () => {
  mockEdit.mockReturnValue({ data: { status: 'ready', targets: [{ key: 'white', imageUrl: 'https://x/y.jpg', offers: [] }] } });
  render();
  expect(mockEdit.mock.calls.every(call => call[1].enabled && call[1].purpose === 'preview')).toBe(true);
  expect(renderer.root.findAllByType('ShoppingStyleVisual' as any)).toHaveLength(2);
});

test('hiding a row offers undo and stops fetching it', () => {
  render();
  press('Not now: Leather shoes');
  expect(mockDismiss).toHaveBeenCalledWith(expect.objectContaining({ recommendationKey: 'shoes', feedbackReason: 'not_relevant_now' }));
  mockPending = [{ id: 'hidden', localDate: brief.localDate!, label: first.label, submitting: false, recommendationKey: 'shoes' } as any];
  mockEdit.mockClear();
  update(brief);
  expect(JSON.stringify(renderer.toJSON())).toContain('One addition to consider');
  expect(mockEdit.mock.calls.every(call => call[0] === second)).toBe(true);
  press('Undo hiding Leather shoes');
  expect(mockUndo).toHaveBeenCalledWith('hidden');
});
