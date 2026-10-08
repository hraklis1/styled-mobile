import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: jest.fn(), set: jest.fn(), remove: jest.fn() }),
}));
jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///var/mobile/Containers/Data/Application/NEW/Documents/' } },
}));
jest.mock('../../wardrobe/scan-review/LoadingStates', () => ({ DetectionState: 'Detection' }));
jest.mock('../../wardrobe/scan-review/ActionBar', () => ({ PrimaryButton: 'PrimaryButton', PolishRow: 'PolishRow' }));
const mockPolish = { polishAll: false, isPremium: true, balance: 10, costFor: (n: number) => n, setAll: jest.fn() };
jest.mock('../../wardrobe/scan-review/usePolishChoice', () => ({ usePolishChoice: () => mockPolish }));
jest.mock('../../../features/polish-queue/runner', () => ({ enqueuePolish: jest.fn() }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('../../wardrobe/scan-review/atoms', () => ({ TextLink: 'TextLink', TextSegment: 'TextSegment', GhostRow: 'GhostRow', OutlinePill: 'OutlinePill' }));
jest.mock('../../primitives/UndoToast', () => ({ UndoToast: 'UndoToast' }));
jest.mock('../../wardrobe/scan-review/feedback', () => ({ cropFeedback: jest.fn(), selectionFeedback: jest.fn() }));
jest.mock('../wear-review/PieceImage', () => ({ PieceImage: 'PieceImage', LocateInPhoto: 'LocateInPhoto' }));
jest.mock('../wear-review/PhotoHero', () => ({ PhotoHero: 'PhotoHero' }));
jest.mock('../wear-review/PairingRow', () => ({ PairingRow: 'PairingRow' }));
jest.mock('../wear-review/ClosetMatchSheet', () => ({ ClosetPicker: 'ClosetPicker' }));
jest.mock('../wear-review/WearResolveSheet', () => ({ WearResolveSheet: 'WearResolveSheet' }));
jest.mock('../../wardrobe/CropAdjustModal', () => ({ CropAdjustEditor: 'CropAdjustEditor' }));
jest.mock('../wear-review/WornDateSheet', () => ({ WornDateSheet: 'WornDateSheet' }));
jest.mock('../../wardrobe/scan-review/MenuRows', () => ({ ScanOptionsRows: 'ScanOptionsRows', scanOptionsRowCount: () => 2 }));
jest.mock('../../wardrobe/scan-review/WorkspaceSheet', () => ({ WorkspaceSheet: 'WorkspaceSheet' }));
jest.mock('../wear-review/NewPieceSheet', () => ({ NewPieceSheet: 'NewPieceSheet', NewPieceEditor: 'NewPieceEditor' }));
jest.mock('../../../features/wear-log/runner', () => ({ discardWearFlow: jest.fn(), retryWearScan: jest.fn() }));
jest.mock('../../../lib/paywall', () => ({ presentPaywall: jest.fn() }));
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
import type { ReviewFlow } from '../../../features/wear-log/types';
import { dispatchWear, useWearLogStore } from '../../../features/wear-log/store';

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
    const options = tree.root.find((n) => (n.type as unknown) === 'ScanOptionsRows');
    expect(options.props.discardLabel).toBe('Discard scan');
    act(() => options.props.onDiscard());
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

  it('an out-of-credits failure offers a top-up, then reads the same photo again', async () => {
    useWearLogStore.setState({
      flow: { status: 'failed', id: 'flow-1', photoUri: 'file:///p.jpg', date: '2026-09-30', message: 'credits', offline: false, needsCredits: true },
    });
    const paywall = jest.mocked(jest.requireMock('../../../lib/paywall').presentPaywall as () => Promise<boolean>);
    const retry = jest.requireMock('../../../features/wear-log/runner').retryWearScan as jest.Mock;
    retry.mockReturnValue(true);
    paywall.mockResolvedValue(false);
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <WearReviewWorkspace onClose={jest.fn()} onMinimize={jest.fn()} onLogged={jest.fn()} onPickManually={jest.fn()} />,
      );
    });
    const button = tree.root.find((n) => (n.type as unknown) === 'PrimaryButton');
    expect(button.props.label).toBe('Get credits');
    // Dismissing the paywall leaves the scan alone.
    await act(async () => { button.props.onPress(); });
    expect(retry).not.toHaveBeenCalled();
    paywall.mockResolvedValue(true);
    await act(async () => { button.props.onPress(); });
    expect(retry).toHaveBeenCalledTimes(1);
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
    act(() => named(tree, 'PrimaryButton', 'Review pieces · 2 left').props.onPress());
    expect(named(tree, 'WearResolveSheet').props.queue).toEqual(['d0', 'd1']);
    act(() => named(tree, 'WearResolveSheet').props.onClose());
    const rows = tree.root.findAll((n) => (n.type as unknown) === 'PairingRow');
    act(() => rows[1].props.onOpen());
    expect(named(tree, 'WearResolveSheet').props).toMatchObject({ queue: ['d0', 'd1'], startIndex: 1 });
    act(() => tree.unmount());
  });

  it('keeps one list in layer order and folds three or more accessories', () => {
    const acc = (id: string) => ({ ...detection(id), layer: 'accessory' as const });
    useWearLogStore.setState({ flow: reviewFixture([detection('d0'), detection('d1', 'high'), acc('d2'), acc('d3'), acc('d4')]) });
    const tree = mountReview();
    const texts = tree.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => [n.props.children].flat().join(''));
    expect(texts).not.toContain('To confirm');
    expect(texts).not.toContain('Ready');
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
    const add = named(tree, 'OutlinePill', 'Add another piece');
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
    expect(named(tree, 'PrimaryButton').props.label).toBe('Review pieces · 1 left');
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

  it('drops the lone "To confirm" header and offers one tap to accept suggested matches', () => {
    useWearLogStore.setState({ flow: reviewFixture([detection('d0'), detection('d1')]) });
    const tree = mountReview();
    const texts = tree.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => [n.props.children].flat().join(''));
    expect(texts).not.toContain('To confirm');
    expect(texts).toEqual(expect.arrayContaining(['2 to confirm']));
    act(() => named(tree, 'OutlinePill', 'Accept 2 suggested matches').props.onPress());
    const flow = useWearLogStore.getState().flow;
    expect(flow).toMatchObject({ resolutions: { d0: { source: 'user' }, d1: { source: 'user' } } });
    expect(named(tree, 'PrimaryButton').props).toMatchObject({ label: 'Log outfit', variant: 'primary' });
    act(() => tree.unmount());
  });

  it('outlines the review button while pieces are pending; only Log outfit is solid', () => {
    useWearLogStore.setState({ flow: reviewFixture() });
    const tree = mountReview();
    expect(named(tree, 'PrimaryButton').props).toMatchObject({ label: 'Review pieces · 2 left', variant: 'secondary' });
    act(() => tree.unmount());
  });

  it('keeps the log button filled and busy while saving', () => {
    const flow = reviewFixture([detection('d0', 'high')]);
    useWearLogStore.setState({ flow: { ...flow, status: 'saving' } });
    const tree = mountReview();
    expect(named(tree, 'PrimaryButton').props).toMatchObject({ busy: true, label: 'Logging' });
    act(() => tree.unmount());
  });

  it('offers to undo a skipped piece', () => {
    useWearLogStore.setState({ flow: reviewFixture([detection('d0'), detection('d1', 'high')]) });
    const tree = mountReview();
    act(() => dispatchWear({ type: 'dismiss', detectionId: 'd0' }));
    const toast = named(tree, 'UndoToast');
    expect(toast.props.message).toBe('Not logging Beige shirt');
    act(() => toast.props.onUndo());
    expect(useWearLogStore.getState().flow).toMatchObject({ resolutions: { d0: { kind: 'matched' } } });
    act(() => tree.unmount());
  });
});

describe('polish for new pieces', () => {
  const created = [{ id: 41, clientImportId: 'wear-flow-test-d0' }];
  const newPieceFlow = () => {
    useWearLogStore.setState({ flow: reviewFixture([detection('d0', 'low', null)]) });
    act(() => dispatchWear({ type: 'markNew', detectionId: 'd0' }));
    jest.mocked(saveWearLog).mockResolvedValue({ logId: 9, itemIds: [41], createdItems: created, alreadyLoggedItemIds: [] } as never);
  };
  const enqueue = () => jest.requireMock('../../../features/polish-queue/runner').enqueuePolish as jest.Mock;
  afterEach(() => { mockPolish.polishAll = false; enqueue().mockClear(); });

  it('offers polish only when the log creates pieces, and queues it after the log lands', async () => {
    newPieceFlow();
    mockPolish.polishAll = true;
    const tree = mountReview();
    const row = named(tree, 'PolishRow');
    expect(row.props.state).toMatchObject({ count: 1, total: 1, cost: 1, locked: false });
    await act(async () => { named(tree, 'PrimaryButton').props.onPress(); });
    expect(enqueue()).toHaveBeenCalledWith('user-1', created);
    act(() => { tree.unmount(); });
  });

  it('logs without polishing when the switch is off', async () => {
    newPieceFlow();
    const tree = mountReview();
    expect(named(tree, 'PolishRow').props.state.count).toBe(0);
    await act(async () => { named(tree, 'PrimaryButton').props.onPress(); });
    expect(saveWearLog).toHaveBeenCalled();
    expect(enqueue()).not.toHaveBeenCalled();
    act(() => { tree.unmount(); });
  });

  it('shows no polish row when every piece is already in the closet', () => {
    useWearLogStore.setState({ flow: reviewFixture([detection('d0', 'high')]) });
    const tree = mountReview();
    expect(tree.root.findAll((n) => (n.type as unknown) === 'PolishRow')).toHaveLength(0);
    act(() => { tree.unmount(); });
  });
});

describe('cropping a new piece', () => {
  it('leaves the sheet for the crop editor, saves the box, and returns to the same piece', () => {
    useWearLogStore.setState({ flow: reviewFixture([detection('d0', 'low', null), detection('d1', 'low', null)]) });
    act(() => dispatchWear({ type: 'markNew', detectionId: 'd1' }));
    const tree = mountReview();
    act(() => named(tree, 'PrimaryButton').props.onPress());
    act(() => named(tree, 'WearResolveSheet').props.onClose({ detectionId: 'd1', queue: ['d0', 'd1'], index: 1 }));
    expect(tree.root.findAll((n) => (n.type as unknown) === 'WearResolveSheet')).toHaveLength(0);
    const editor = named(tree, 'CropAdjustEditor');
    expect(editor.props.sourceImage).toBe('file:///outfit.jpg');
    act(() => editor.props.onApply({ x: 5, y: 5, width: 50, height: 60 }));
    const flow = useWearLogStore.getState().flow as ReviewFlow;
    expect(flow.resolutions.d1).toMatchObject({ kind: 'new', draft: { cropBbox: { x: 5, y: 5, width: 50, height: 60 } } });
    expect(named(tree, 'WearResolveSheet').props).toMatchObject({ queue: ['d0', 'd1'], startIndex: 1 });
    act(() => { tree.unmount(); });
  });
});
