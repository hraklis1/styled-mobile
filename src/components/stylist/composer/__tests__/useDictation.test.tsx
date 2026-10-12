import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import { useDictation } from '../useDictation';
import { PermissionStatus } from 'expo-modules-core';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

const mockEvents: Record<string, (event?: any) => void> = {};
jest.mock('expo-speech-recognition', () => ({
  useSpeechRecognitionEvent: (name: string, callback: (event: any) => void) => { mockEvents[name] = callback; },
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: jest.fn(() => true),
    getPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getSupportedLocales: jest.fn(async () => ({ locales: ['en-US', 'fr-CA'] })),
    start: jest.fn(), stop: jest.fn(), abort: jest.fn(),
  },
}));
jest.mock('../../../../lib/haptics', () => ({ impactAsync: jest.fn(async () => {}), selectionAsync: jest.fn(async () => {}), ImpactFeedbackStyle: {} }));
jest.mock('../../../primitives/ConfirmSheet', () => ({ confirmSheet: jest.fn() }));
jest.mock('react-native-reanimated', () => ({ useSharedValue: () => ({ value: 0 }), withTiming: (value: number) => value }));
let hook: ReturnType<typeof useDictation>;
let renderer: TestRenderer.ReactTestRenderer;
const onText = jest.fn();
function Harness() {
  const value = useDictation({ onText, vocabulary: ['Uniqlo', 'merino'] });
  React.useEffect(() => { hook = value; });
  return null;
}
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  act(() => { renderer = TestRenderer.create(<Harness />); });
});
afterEach(() => { act(() => renderer.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });
async function start(text = 'Dinner') { await act(async () => { await hook.start(text); }); act(() => mockEvents.start()); }

it('matches the device language and adds vocabulary without an audio upload', async () => {
  jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({ resolvedOptions: () => ({ locale: 'fr-CA' }) } as any);
  await start();
  expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'fr-CA', contextualStrings: expect.arrayContaining(['Uniqlo', 'cashmere']) }));
});
it('keeps Android final segments when interim words change', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  await start();
  act(() => mockEvents.result({ isFinal: true, results: [{ transcript: 'with a blazer' }] }));
  act(() => mockEvents.result({ isFinal: false, results: [{ transcript: 'and loafers' }] }));
  expect(onText).toHaveBeenLastCalledWith('Dinner with a blazer and loafers');
  expect(hook.preview).toEqual({ settled: 'Dinner with a blazer', interim: 'and loafers' });
});
it('restores the exact draft on cancel and ignores late results', async () => {
  await start('Dinner  ');
  act(() => hook.cancel());
  act(() => mockEvents.result({ isFinal: true, results: [{ transcript: 'late words' }] }));
  expect(onText).toHaveBeenLastCalledWith('Dinner  ');
  expect(hook.state).toBe('idle');
});
it('unlocks the draft if the recognizer never finishes stopping', async () => {
  await start();
  act(() => mockEvents.result({ isFinal: false, results: [{ transcript: 'a navy jacket' }] }));
  const draft = onText.mock.calls.at(-1)?.[0];
  act(() => hook.done());
  expect(hook.state).toBe('stopping');
  act(() => jest.advanceTimersByTime(2500));
  expect(hook.state).toBe('idle');
  expect(onText.mock.calls.at(-1)?.[0]).toBe(draft);
});
it('preserves the draft when the app leaves the foreground', async () => {
  let change: (state: AppStateStatus) => void = () => {};
  act(() => renderer.unmount());
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, listener) => { change = listener; return { remove: jest.fn() }; });
  act(() => { renderer = TestRenderer.create(<Harness />); });
  await start();
  act(() => change('background'));
  expect(hook.state).toBe('idle');
  expect(hook.notice).toContain('draft is still here');
});

it('replaces cumulative iOS text without duplicating earlier words', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await start();
  act(() => mockEvents.result({ isFinal: false, results: [{ transcript: 'navy' }] }));
  act(() => mockEvents.result({ isFinal: true, results: [{ transcript: 'navy blazer' }] }));
  expect(onText).toHaveBeenLastCalledWith('Dinner navy blazer');
  expect(hook.preview).toEqual({ settled: 'Dinner navy blazer', interim: '' });
});
it('does not start the microphone after cancelling a pending permission request', async () => {
  let resolve: (value: Awaited<ReturnType<typeof ExpoSpeechRecognitionModule.getPermissionsAsync>>) => void = () => {};
  jest.mocked(ExpoSpeechRecognitionModule.getPermissionsAsync).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  let pending: Promise<void>;
  act(() => { pending = hook.start('Original'); });
  act(() => hook.cancel());
  await act(async () => { resolve({ granted: true, status: PermissionStatus.GRANTED, expires: 'never', canAskAgain: true }); await pending; });
  expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
  expect(onText).toHaveBeenLastCalledWith('Original');
});
