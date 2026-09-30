import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn(), remove: jest.fn() }),
}));
jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///var/mobile/Containers/Data/Application/NEW/Documents/' } },
}));
jest.mock('../../wardrobe/scan-review/LoadingStates', () => ({ DetectionState: 'Detection' }));
jest.mock('../../wardrobe/scan-review/ActionBar', () => ({ PrimaryButton: 'PrimaryButton' }));
jest.mock('../../wardrobe/scan-review/atoms', () => ({ TextLink: 'TextLink', TextSegment: 'TextSegment' }));
jest.mock('../../wardrobe/scan-review/feedback', () => ({ cropFeedback: jest.fn() }));
jest.mock('../wear-review/PieceImage', () => ({ PieceImage: 'PieceImage' }));
jest.mock('../wear-review/PhotoHero', () => ({ PhotoHero: 'PhotoHero' }));
jest.mock('../wear-review/PairingRow', () => ({ PairingRow: 'PairingRow' }));
jest.mock('../wear-review/ClosetMatchSheet', () => ({ ClosetPicker: 'ClosetPicker' }));
jest.mock('../wear-review/WearResolveSheet', () => ({ WearResolveSheet: 'WearResolveSheet' }));
jest.mock('../wear-review/WornDateSheet', () => ({ WornDateSheet: 'WornDateSheet' }));
jest.mock('../../wardrobe/scan-review/MenuRows', () => ({ MenuRow: 'MenuRow', ArmedDiscardRow: 'ArmedDiscardRow' }));
jest.mock('../../wardrobe/scan-review/WorkspaceSheet', () => ({ WorkspaceSheet: 'WorkspaceSheet' }));
jest.mock('../wear-review/NewPieceSheet', () => ({ NewPieceSheet: 'NewPieceSheet', NewPieceEditor: 'NewPieceEditor' }));
jest.mock('../../../features/wear-log/runner', () => ({ discardWearFlow: jest.fn(), retryWearScan: jest.fn() }));
jest.mock('../../../features/wear-log/api', () => ({ saveWearLog: jest.fn() }));
jest.mock('../../../hooks/useReviewReducedMotion', () => ({ useReviewReducedMotion: () => true }));
jest.mock('../../../hooks/useItems', () => ({ useItems: jest.fn(), applySavedItems: jest.fn() }));
jest.mock('../../../hooks/useOutfitLogs', () => ({ OUTFIT_LOGS_QUERY_KEY: ['outfit-logs'] }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'GestureRoot' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

import { WearReviewWorkspace } from '../wear-review/WearReviewWorkspace';
import { useItems } from '../../../hooks/useItems';
import { saveWearLog } from '../../../features/wear-log/api';
import { closetItems, detection, reviewFixture } from '../../../features/wear-log/__fixtures__/review';
import { reviewQueue } from '../../../features/wear-log/reducer';
import { useWearLogStore } from '../../../features/wear-log/store';

function linkLabels(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAll((n) => (n.type as unknown) === 'TextLink').map((n) => n.props.label as string);
}

beforeEach(() => { jest.mocked(useItems).mockReturnValue({ data: closetItems, isSuccess: true, refetch: jest.fn() } as unknown as ReturnType<typeof useItems>); });

describe('WearReviewWorkspace while processing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useWearLogStore.setState({
      flow: { status: 'processing', id: 'flow-1', photoUri: 'file:///p.jpg', date: '2026-09-30', startedAt: 0 },
      workspaceOpen: false,
    });
  });
  afterEach(() => jest.useRealTimers());

  it('offers to keep going in the background once the scan is slow', () => {
    const onMinimize = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <WearReviewWorkspace onClose={jest.fn()} onMinimize={onMinimize} onLogged={jest.fn()} onPickManually={jest.fn()} />,
      );
    });
    expect(useWearLogStore.getState().workspaceOpen).toBe(true);
    expect(linkLabels(tree)).toEqual(['Pick the pieces yourself']);

    act(() => { jest.advanceTimersByTime(8_000); });
    const keep = tree.root.find((n) => (n.type as unknown) === 'TextLink' && n.props.label === 'Keep going in the background');
    act(() => { keep.props.onPress(); });
    expect(onMinimize).toHaveBeenCalled();

    act(() => { tree.unmount(); });
    expect(useWearLogStore.getState().workspaceOpen).toBe(false);
  });

  it('the options menu discards mid-scan only after the armed second tap', () => {
    const onClose = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<WearReviewWorkspace onClose={onClose} onMinimize={jest.fn()} onLogged={jest.fn()} onPickManually={jest.fn()} />);
    });
    act(() => tree.root.find((n) => n.props.accessibilityLabel === 'More options' && typeof n.props.onPress === 'function').props.onPress());
    const discard = tree.root.find((n) => (n.type as unknown) === 'ArmedDiscardRow');
    expect(discard.props.label).toBe('Discard scan');
    act(() => discard.props.onConfirm());
    expect(jest.requireMock('../../../features/wear-log/runner').discardWearFlow).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    act(() => { tree.unmount(); });
  });

  it('an offline failure offers to keep the photo for later', () => {
    useWearLogStore.setState({
      flow: { status: 'failed', id: 'flow-1', photoUri: 'file:///p.jpg', date: '2026-09-30', message: 'offline', offline: true },
    });
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <WearReviewWorkspace onClose={jest.fn()} onMinimize={jest.fn()} onLogged={jest.fn()} onPickManually={jest.fn()} />,
      );
    });
    const buttons = tree.root.findAll((n) => (n.type as unknown) === 'PrimaryButton').map((n) => n.props.label);
    expect(buttons).toEqual(['Keep it for later']);
    act(() => { tree.unmount(); });
  });
});


function mountReview() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<WearReviewWorkspace onClose={jest.fn()} onMinimize={jest.fn()} onLogged={jest.fn()} onPickManually={jest.fn()} />); });
  return tree;
}
function named(tree: TestRenderer.ReactTestRenderer, type: string, label?: string) {
  return tree.root.find((n) => (n.type as unknown) === type && (!label || n.props.label === label));
}

describe('compact outfit overview', () => {
  it('shows resolved rows without comparisons and logs immediately', async () => {
    useWearLogStore.setState({ flow: reviewFixture([detection('d0', 'high')]) });
    jest.mocked(saveWearLog).mockResolvedValue({ logId: 8, itemIds: [1], createdItems: [], alreadyLoggedItemIds: [] });
    const tree = mountReview();
    expect(named(tree, 'PrimaryButton').props.label).toBe('Log outfit');
    expect(named(tree, 'PrimaryButton').props.disabled).toBe(false);
    expect(tree.root.findAll((n) => (n.type as unknown) === 'WearResolveSheet')).toHaveLength(0);
    await act(async () => { named(tree, 'PrimaryButton').props.onPress(); });
    expect(saveWearLog).toHaveBeenCalled();
    expect(useWearLogStore.getState().flow.status).toBe('logged');
    act(() => tree.unmount());
  });

  it('builds a guided queue from uncertain pieces and opens a row at its place in the queue', () => {
    useWearLogStore.setState({ flow: reviewFixture() });
    const tree = mountReview();
    act(() => named(tree, 'PrimaryButton', 'Review 2 pieces').props.onPress());
    expect(named(tree, 'WearResolveSheet').props.queue).toEqual(['d0', 'd1']);
    act(() => named(tree, 'WearResolveSheet').props.onClose());
    const rows = tree.root.findAll((n) => (n.type as unknown) === 'PairingRow');
    act(() => rows[1].props.onOpen());
    expect(named(tree, 'WearResolveSheet').props).toMatchObject({ queue: ['d0', 'd1'], startIndex: 1 });
    act(() => tree.unmount());
  });

  it('groups rows by what still needs confirming and folds three or more accessories', () => {
    const acc = (id: string) => ({ ...detection(id), layer: 'accessory' as const });
    useWearLogStore.setState({ flow: reviewFixture([detection('d0'), detection('d1', 'high'), acc('d2'), acc('d3'), acc('d4')]) });
    const tree = mountReview();
    const texts = tree.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => [n.props.children].flat().join(''));
    expect(texts).toEqual(expect.arrayContaining(['To confirm', 'Ready']));
    const rows = () => tree.root.findAll((n) => (n.type as unknown) === 'PairingRow').map((n) => n.props.detection.id);
    expect(rows()).toEqual(['d0', 'd1']);
    const fold = tree.root.find((n) => n.props.accessibilityState?.expanded === false && typeof n.props.onPress === 'function');
    act(() => fold.props.onPress());
    expect(rows()).toEqual(['d0', 'd1', 'd2', 'd3', 'd4']);
    act(() => tree.unmount());
  });

  it('allows adding missing closet pieces when nothing was detected', () => {
    useWearLogStore.setState({ flow: reviewFixture([]) });
    const tree = mountReview();
    expect(named(tree, 'PrimaryButton').props.disabled).toBe(true);
    const add = named(tree, 'TextLink', '+ Add missing piece');
    act(() => add.props.onPress());
    act(() => named(tree, 'ClosetPicker').props.onPick(3));
    expect(named(tree, 'PrimaryButton').props.disabled).toBe(false);
    expect(useWearLogStore.getState().flow).toMatchObject({ additionalItemIds: [3] });
    act(() => named(tree, 'WorkspaceSheet').props.onClose());
    act(() => named(tree, 'TextLink', 'Remove').props.onPress());
    expect(named(tree, 'PrimaryButton').props.disabled).toBe(true);
    act(() => tree.unmount());
  });

  it('requires correction of deleted scan items and removal of deleted additions', () => {
    const flow = { ...reviewFixture([detection('d0', 'high', 99)]), additionalItemIds: [98] };
    expect(reviewQueue(flow, new Set([1, 2, 3]))).toEqual(['d0']);
    useWearLogStore.setState({ flow });
    const tree = mountReview();
    expect(named(tree, 'PrimaryButton').props.label).toBe('Review 1 piece');
    act(() => named(tree, 'TextLink', 'Remove').props.onPress());
    expect(useWearLogStore.getState().flow).toMatchObject({ additionalItemIds: [] });
    act(() => tree.unmount());
    useWearLogStore.setState({ flow: { ...reviewFixture([detection('d0', 'high')]), additionalItemIds: [98] } });
    const missing = mountReview();
    expect(named(missing, 'PrimaryButton').props.disabled).toBe(true);
    act(() => missing.unmount());
  });

  it('does not treat a loading wardrobe as deleted, and prevents saving until loaded', () => {
    jest.mocked(useItems).mockReturnValue({ data: [], isSuccess: false, refetch: jest.fn() } as unknown as ReturnType<typeof useItems>);
    useWearLogStore.setState({ flow: reviewFixture([detection('d0', 'high')]) });
    const tree = mountReview();
    expect(named(tree, 'PrimaryButton').props.label).toBe('Log outfit');
    expect(named(tree, 'PrimaryButton').props.disabled).toBe(true);
    expect(named(tree, 'PairingRow').props.wardrobeReady).toBe(false);
    act(() => tree.unmount());
  });
});
