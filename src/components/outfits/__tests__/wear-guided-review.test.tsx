import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn(), remove: jest.fn() }) }));
jest.mock('expo-file-system', () => ({ Paths: { document: { uri: 'file:///documents/' } } }));
jest.mock('../../wardrobe/scan-review/WorkspaceSheet', () => ({
  WorkspaceSheet: (props: { children?: React.ReactNode; headerAction?: React.ReactNode; footer?: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('WorkspaceSheet', props, props.headerAction, props.children, props.footer);
  },
}));
jest.mock('../../wardrobe/scan-review/PrimaryButton', () => ({ PrimaryButton: 'PrimaryButton' }));
jest.mock('../../wardrobe/scan-review/atoms', () => ({ TextLink: 'TextLink' }));
jest.mock('../../wardrobe/scan-review/feedback', () => ({ selectionFeedback: jest.fn() }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, FadeIn: { duration: () => ({}) } }));
jest.mock('../wear-review/PieceImage', () => ({ PieceImage: 'PieceImage', LocateInPhoto: 'LocateInPhoto' }));
jest.mock('../wear-review/PhotoHero', () => ({ PhotoHero: 'PhotoHero' }));
jest.mock('../wear-review/ClosetMatchSheet', () => ({ ClosetPicker: 'ClosetPicker' }));
jest.mock('../wear-review/NewPieceSheet', () => ({ NewPieceEditor: 'NewPieceEditor' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

import { WearResolveSheet } from '../wear-review/WearResolveSheet';
import { dispatchWear, useWearLogStore } from '../../../features/wear-log/store';
import { closetItems, detection, reviewFixture } from '../../../features/wear-log/__fixtures__/review';

function node(tree: TestRenderer.ReactTestRenderer, type: string, label?: string) {
  return tree.root.find((n) => (n.type as unknown) === type && (!label || n.props.label === label));
}
function tap(tree: TestRenderer.ReactTestRenderer, label: string) {
  act(() => tree.root.find((n) => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').props.onPress());
}
function closeSheet(tree: TestRenderer.ReactTestRenderer) {
  act(() => node(tree, 'WorkspaceSheet').props.onClose());
}
function has(tree: TestRenderer.ReactTestRenderer, type: string) {
  return tree.root.findAll((n) => (n.type as unknown) === type).length > 0;
}
function press(tree: TestRenderer.ReactTestRenderer, type: string, label: string) {
  act(() => node(tree, type, label).props.onPress());
}
const mounted: TestRenderer.ReactTestRenderer[] = [];
afterEach(() => { act(() => { for (const tree of mounted.splice(0)) tree.unmount(); }); });

function mount(queue: string[], initialPhoto = false, reviewIds: string[] = queue) {
  function Harness() {
    const flow = useWearLogStore((s) => s.flow);
    return flow.status === 'reviewing' ? <WearResolveSheet queue={queue} reviewIds={reviewIds} initialPhoto={initialPhoto} flow={flow} items={closetItems} reduceMotion onClose={jest.fn()} /> : null;
  }
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<Harness />); });
  mounted.push(tree);
  return tree;
}
function resolutions() {
  const flow = useWearLogStore.getState().flow;
  if (flow.status !== 'reviewing') throw new Error('Expected review');
  return flow.resolutions;
}

describe('guided piece review', () => {
  beforeEach(() => useWearLogStore.setState({ flow: reviewFixture() }));

  it('keeps a candidate pending until confirmed, then advances the snapshot queue', () => {
    const tree = mount(['d0', 'd1']);
    const candidate = tree.root.find((n) => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === 'Cotton shirt, COS');
    act(() => candidate.props.onPress());
    expect(resolutions().d0).toMatchObject({ itemId: 1, source: 'suggested' });
    press(tree, 'PrimaryButton', 'Confirm & next');
    expect(resolutions().d0).toEqual({ kind: 'matched', itemId: 2, source: 'user' });
    // Nothing chosen yet: the anchored confirm is there but disabled.
    expect(node(tree, 'PrimaryButton', 'Add to outfit').props.disabled).toBe(true);
    press(tree, 'TextLink', 'Skip');
    expect(resolutions().d1.kind).toBe('dismissed');
    expect(node(tree, 'WorkspaceSheet').props.dismissed).toBe(true);
    act(() => tree.unmount());
  });

  it('closing partway through preserves decisions and discards an unconfirmed pick', () => {
    const tree = mount(['d0', 'd1']);
    press(tree, 'PrimaryButton', 'Confirm & next');
    const candidate = tree.root.find((n) => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === 'Cotton shirt, COS');
    act(() => candidate.props.onPress());
    closeSheet(tree);
    expect(resolutions().d0).toMatchObject({ source: 'user' });
    expect(resolutions().d1.kind).toBe('unresolved');
    act(() => tree.unmount());
    const reopened = mount(['d1']);
    expect(node(reopened, 'PrimaryButton').props.disabled).toBe(true);
    act(() => reopened.unmount());
  });

  it('closet browsing commits immediately without losing the rest of the queue', () => {
    const tree = mount(['d0', 'd1']);
    tap(tree, 'Browse closet');
    act(() => node(tree, 'ClosetPicker').props.onPick(3));
    expect(resolutions().d0).toMatchObject({ itemId: 3, source: 'user' });
    expect(node(tree, 'WorkspaceSheet').props.subtitle.props.children).toEqual(['Piece ', 2, ' of ', 2]);
    expect(node(tree, 'PrimaryButton').props.disabled).toBe(true);
    expect(node(tree, 'WorkspaceSheet').props.dismissed).toBe(false);
    act(() => tree.unmount());
  });

  it('keeps a tentative pick when returning from browsing, without committing it', () => {
    const tree = mount(['d0']);
    const candidate = tree.root.find((n) => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === 'Cotton shirt, COS');
    act(() => candidate.props.onPress());
    tap(tree, 'Browse closet');
    press(tree, 'TextLink', 'Back to comparison');
    expect(resolutions().d0).toMatchObject({ itemId: 1, source: 'suggested' });
    press(tree, 'PrimaryButton', 'Add to outfit');
    expect(resolutions().d0).toMatchObject({ itemId: 2, source: 'user' });
    act(() => tree.unmount());
  });

  it('browsing back and closing leave the suggestion unchanged', () => {
    const tree = mount(['d0']);
    tap(tree, 'Browse closet');
    press(tree, 'TextLink', 'Back to comparison');
    closeSheet(tree);
    expect(resolutions().d0).toMatchObject({ itemId: 1, source: 'suggested' });
    act(() => tree.unmount());
  });

  it('edits new pieces in the same sheet and Done advances', () => {
    const tree = mount(['d0', 'd1']);
    tap(tree, 'Add as a new piece');
    act(() => node(tree, 'NewPieceEditor').props.onChange({ brand: 'Arket', name: 'Summer shirt' }));
    expect(resolutions().d0).toMatchObject({ kind: 'new', draft: { brand: 'Arket', name: 'Summer shirt' } });
    expect(node(tree, 'WorkspaceSheet').props.headerAction.props.label).toBeUndefined();
    press(tree, 'PrimaryButton', 'Confirm & next');
    expect(node(tree, 'WorkspaceSheet').props.title).toBe('Match your pieces');
    expect(has(tree, 'NewPieceEditor')).toBe(false);
    expect(resolutions().d0).toMatchObject({ draft: { brand: 'Arket' } });
    act(() => tree.unmount());
  });

  it('individual correction finishes without stepping through unrelated pieces', () => {
    useWearLogStore.setState({ flow: reviewFixture([detection('d0', 'high'), detection('d1')]) });
    const tree = mount(['d0'], false, []);
    expect(node(tree, 'WorkspaceSheet').props.title).toBe('Edit piece');
    press(tree, 'PrimaryButton', 'Save');
    expect(node(tree, 'WorkspaceSheet').props.dismissed).toBe(true);
    expect(resolutions().d1).toMatchObject({ source: 'suggested' });
    act(() => dispatchWear({ type: 'dismiss', detectionId: 'd0' }));
    act(() => dispatchWear({ type: 'restore', detectionId: 'd0' }));
    expect(resolutions().d0).toMatchObject({ source: 'user' });
    act(() => tree.unmount());
  });

  it('photo boxes open a focused correction within the same presentation', () => {
    const tree = mount([], true, ['d0', 'd1']);
    act(() => node(tree, 'PhotoHero').props.onOpen('d1'));
    expect(node(tree, 'WorkspaceSheet').props.title).toBe('Match your pieces');
    expect(node(tree, 'WorkspaceSheet').props.subtitle.props.children).toEqual(['Piece ', 2, ' of ', 2]);
    act(() => tree.unmount());
  });

  it('review mode has no header Done and offers new as a tile', () => {
    const tree = mount(['d0']);
    expect(node(tree, 'WorkspaceSheet').props.headerAction.props.label).toBeUndefined();
    tap(tree, 'Add as a new piece');
    expect(resolutions().d0.kind).toBe('new');
    act(() => tree.unmount());
  });

  it('empty candidates and missing cutouts still permit browsing, new, or skip', () => {
    const d = { ...detection('d0', 'low', null), candidates: [] };
    useWearLogStore.setState({ flow: reviewFixture([d]) });
    const tree = mount(['d0']);
    expect(node(tree, 'PrimaryButton').props.disabled).toBe(true);
    expect(node(tree, 'PieceImage').props.cutoutUrl).toBeNull();
    // No candidates: full-width options instead of a lone half-width tile.
    tree.root.find((n) => n.props.accessibilityLabel === 'Find it in my closet' && typeof n.props.onPress === 'function');
    tree.root.find((n) => n.props.accessibilityLabel === 'Add as a new piece' && typeof n.props.onPress === 'function');
    press(tree, 'TextLink', 'Skip');
    expect(resolutions().d0.kind).toBe('dismissed');
    act(() => tree.unmount());
  });

  it('Back to matches undoes a new piece', () => {
    const tree = mount(['d0']);
    tap(tree, 'Add as a new piece');
    expect(resolutions().d0.kind).toBe('new');
    tap(tree, 'Back to matches. Undo new piece');
    expect(resolutions().d0.kind).not.toBe('new');
    expect(has(tree, 'NewPieceEditor')).toBe(false);
    act(() => tree.unmount());
  });
});
