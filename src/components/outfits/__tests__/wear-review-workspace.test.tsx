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
jest.mock('../wear-review/PhotoHero', () => ({ PhotoHero: 'PhotoHero' }));
jest.mock('../wear-review/PairingRow', () => ({ PairingRow: 'PairingRow' }));
jest.mock('../wear-review/ClosetMatchSheet', () => ({ ClosetMatchSheet: 'ClosetMatchSheet' }));
jest.mock('../wear-review/NewPieceSheet', () => ({ NewPieceSheet: 'NewPieceSheet' }));
jest.mock('../../../features/wear-log/runner', () => ({ discardWearFlow: jest.fn(), retryWearScan: jest.fn() }));
jest.mock('../../../features/wear-log/api', () => ({ saveWearLog: jest.fn() }));
jest.mock('../../../hooks/useReviewReducedMotion', () => ({ useReviewReducedMotion: () => true }));
jest.mock('../../../hooks/useItems', () => ({ useItems: () => ({ data: [] }), applySavedItems: jest.fn() }));
jest.mock('../../../hooks/useOutfitLogs', () => ({ OUTFIT_LOGS_QUERY_KEY: ['outfit-logs'] }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'GestureRoot' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

import { WearReviewWorkspace } from '../wear-review/WearReviewWorkspace';
import { useWearLogStore } from '../../../features/wear-log/store';

function linkLabels(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAll((n) => (n.type as unknown) === 'TextLink').map((n) => n.props.label as string);
}

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
