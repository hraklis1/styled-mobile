import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Modal, Platform } from 'react-native';

jest.mock('../../components/stylist/StylistChatView', () => ({ StylistChatView: 'StylistChatView' }));
jest.mock('../../hooks/useEntitlement', () => ({ useEntitlement: () => ({ isPremium: true }) }));
jest.mock('../../lib/entitlementGate', () => ({ ensureEntitled: jest.fn().mockResolvedValue(true) }));
jest.mock('../../lib/analytics', () => ({ track: jest.fn() }));
const mockOpenSaved = jest.fn();
const mockOpenCloset = jest.fn();
jest.mock('../../navigation/savedRecommendations', () => ({ openClosetOutfit: (...args: any[]) => mockOpenCloset(...args), openWishlist: (...args: any[]) => mockOpenSaved(...args) }));
import { GlobalAIStylistProvider, useGlobalAIStylist } from '../GlobalAIStylistContext';
let resume: ReturnType<typeof useGlobalAIStylist>['resumeStylist'];
let open: ReturnType<typeof useGlobalAIStylist>['openStylist'];
function Launcher() { const { openStylist, resumeStylist } = useGlobalAIStylist(); React.useEffect(() => { open = openStylist; resume = resumeStylist; }, [openStylist]); return null; }

it('opens a fresh closet discussion with the selected pieces pending in the composer', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  const attachment = {
    type: 'items' as const,
    label: '2 closet pieces',
    items: [{ itemId: 1, label: 'Cream sweater', uri: 'https://example.com/sweater.jpg' }, { itemId: 2, label: 'Dark trousers' }],
  };
  try {
    act(() => { renderer = TestRenderer.create(<GlobalAIStylistProvider><Launcher /></GlobalAIStylistProvider>); });
    await act(async () => { await open({ source: 'closet_selection', initialAttachment: attachment }); });
    expect(renderer.root.findByType(Modal).props.visible).toBe(true);
    const chat = renderer.root.findByType('StylistChatView' as any);
    expect(chat.props.threadMode).toBe('new');
    expect(chat.props.initialAttachment).toEqual(attachment);
    expect(chat.props.initialQuery).toBeUndefined();
    expect(chat.props.promptRequestId).toBe(0);
  } finally {
    act(() => renderer?.unmount());
  }
});

it('dismisses the native modal before navigating to the saved recommendation', async () => {
  const originalOS = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  let renderer: TestRenderer.ReactTestRenderer;
  try {
    act(() => { renderer = TestRenderer.create(<GlobalAIStylistProvider><Launcher /></GlobalAIStylistProvider>); });
    await act(async () => { await open({ source: 'home_prompt' }); });
    expect(renderer!.root.findByType(Modal).props.visible).toBe(true);
    act(() => renderer!.root.findByType('StylistChatView' as any).props.onViewSaved('saved-piece'));
    expect(renderer!.root.findByType(Modal).props.visible).toBe(false);
    expect(mockOpenSaved).not.toHaveBeenCalled();
    act(() => renderer!.root.findByType(Modal).props.onDismiss());
    expect(mockOpenSaved).toHaveBeenCalledWith('saved-piece', 'products', 'stylist-modal');
    act(() => renderer!.root.findByType(Modal).props.onDismiss());
    expect(mockOpenSaved).toHaveBeenCalledTimes(1);
  } finally {
    act(() => renderer!?.unmount());
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  }
});

it('resumes the same contextual open request and retains its session snapshot reference', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<GlobalAIStylistProvider><Launcher /></GlobalAIStylistProvider>); });
  await act(async () => { await open({ source: 'shop' }); });
  const chat = renderer.root.findByType('StylistChatView' as any);
  const request = chat.props.openRequestId;
  const session = chat.props.sessionRef;
  act(() => chat.props.onViewSaved('product'));
  act(() => resume());
  expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  expect(renderer.root.findByType('StylistChatView' as any).props.openRequestId).toBe(request);
  expect(renderer.root.findByType('StylistChatView' as any).props.sessionRef).toBe(session);
  act(() => renderer.unmount());
});

it('dismisses before opening a saved wardrobe outfit and provides a contextual return', async () => {
  const originalOS = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    act(() => { renderer = TestRenderer.create(<GlobalAIStylistProvider><Launcher /></GlobalAIStylistProvider>); });
    await act(async () => { await open({ source: 'home_prompt' }); });
    act(() => renderer.root.findByType('StylistChatView' as any).props.onNavigateToCloset(42));
    expect(mockOpenCloset).not.toHaveBeenCalled();
    act(() => renderer.root.findByType(Modal).props.onDismiss());
    expect(mockOpenCloset).toHaveBeenCalledWith(42, true);
  } finally {
    act(() => renderer?.unmount());
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  }
});
