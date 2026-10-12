import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput, Text } from 'react-native';
import { StylistComposer } from '../StylistComposer';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../DictationLevelBars', () => ({ DictationLevelBars: 'LevelBars' }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const transition = { duration: () => transition };
  return {
    __esModule: true, default: { View }, FadeIn: transition, FadeOut: transition,
    useReducedMotion: () => true,
    useSharedValue: (initial: number) => ({ get: () => initial, set: jest.fn() }),
    useAnimatedStyle: () => ({}), withTiming: (value: number) => value,
    interpolateColor: () => '#000000',
  };
});
const mockStart = jest.fn();
let mockState = 'idle';
jest.mock('../useDictation', () => ({ useDictation: () => ({ state: mockState, start: mockStart, done: jest.fn(), cancel: jest.fn(), startedAt: null, level: 0 }) }));
let renderer: TestRenderer.ReactTestRenderer;
const props = {
  value: 'Dinner on Friday', onChangeText: jest.fn(), onDictatedText: jest.fn(), onSend: jest.fn(),
  onStopGeneration: jest.fn(), isLoading: false, attachment: null, onRemoveAttachment: jest.fn(),
  onOpenAttachmentSheet: jest.fn(), onChooseCloset: jest.fn(),
};
const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0]!;
beforeEach(() => { mockState = 'idle'; jest.clearAllMocks(); });
afterEach(() => act(() => renderer?.unmount()));

it('keeps dictation and the attachment picker available with a written draft', () => {
  act(() => { renderer = TestRenderer.create(<StylistComposer {...props} />); });
  act(() => button('Dictate a message').props.onPress());
  expect(mockStart).toHaveBeenCalledWith('Dinner on Friday');
  act(() => button('Add a photo or wardrobe piece').props.onPress());
  expect(props.onOpenAttachmentSheet).toHaveBeenCalledTimes(1);
  act(() => button('Send message').props.onPress());
  expect(props.onSend).toHaveBeenCalledTimes(1);
});

it('allows drafting during a reply and routes Stop only to the active generation', () => {
  act(() => { renderer = TestRenderer.create(<StylistComposer {...props} isLoading />); });
  const input = renderer.root.findByType(TextInput);
  expect(input.props.editable).toBe(true);
  act(() => input.props.onChangeText('My next question'));
  expect(props.onChangeText).toHaveBeenCalledWith('My next question');
  expect(button('Send message')).toBeUndefined();
  act(() => button('Stop generating').props.onPress());
  expect(props.onStopGeneration).toHaveBeenCalledTimes(1);
  expect(props.onSend).not.toHaveBeenCalled();
});

it('prevents empty sends while allowing an attached piece to be submitted', () => {
  act(() => { renderer = TestRenderer.create(<StylistComposer {...props} value="   " />); });
  expect(button('Send message').props.disabled).toBe(true);
  act(() => renderer.update(<StylistComposer {...props} value="" attachment={{ type: 'item', label: 'Navy jacket', itemId: 1 }} />));
  expect(button('Send message').props.disabled).toBe(false);
});

it('explains microphone startup and keeps Stop reachable during dictation', () => {
  mockState = 'requesting';
  act(() => { renderer = TestRenderer.create(<StylistComposer {...props} isLoading />); });
  expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Starting microphone…')).toBe(true);
  expect(button('Finish dictation').props.disabled).toBe(true);
  expect(button('Stop generating')).toBeDefined();
});
