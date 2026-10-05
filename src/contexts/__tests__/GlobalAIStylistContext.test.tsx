import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Modal, Platform } from 'react-native';

jest.mock('../../components/stylist/StylistChatView', () => ({ StylistChatView: 'StylistChatView' }));
jest.mock('../../hooks/useEntitlement', () => ({ useEntitlement: () => ({ isPremium: true }) }));
jest.mock('../../lib/entitlementGate', () => ({ ensureEntitled: jest.fn().mockResolvedValue(true) }));
jest.mock('../../lib/analytics', () => ({ track: jest.fn() }));
const mockOpenSaved = jest.fn();
jest.mock('../../navigation/savedRecommendations', () => ({ openSavedRecommendations: (...args: any[]) => mockOpenSaved(...args) }));
import { GlobalAIStylistProvider, useGlobalAIStylist } from '../GlobalAIStylistContext';
let open: ReturnType<typeof useGlobalAIStylist>['openStylist'];
function Launcher() { const { openStylist } = useGlobalAIStylist(); React.useEffect(() => { open = openStylist; }, [openStylist]); return null; }

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
    expect(mockOpenSaved).toHaveBeenCalledWith('saved-piece');
    act(() => renderer!.root.findByType(Modal).props.onDismiss());
    expect(mockOpenSaved).toHaveBeenCalledTimes(1);
  } finally {
    act(() => renderer!?.unmount());
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  }
});
