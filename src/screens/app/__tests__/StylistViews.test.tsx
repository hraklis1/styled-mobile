import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../../components/primitives/Editorial', () => ({ ScreenHeader: 'ScreenHeader', SegmentedControl: 'SegmentedControl', ActionButton: 'ActionButton' }));
jest.mock('../../../components/primitives/AppText', () => ({ AppText: 'AppText' }));
jest.mock('../../../lib/paywall', () => ({ presentPaywall: jest.fn() }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
let mockPremium = true;
jest.mock('../../../hooks/useEntitlement', () => ({ useEntitlement: () => ({ isPremium: mockPremium }) }));
jest.mock('../../../components/stylist/SavedRecommendationsContent', () => ({ SavedRecommendationsContent: 'SavedRecommendationsContent' }));
let mockFinishResponse: (response: string) => void;
jest.mock('../../../components/stylist/StylistChatView', () => ({
  StylistChatView: function Chat(props: any) {
    const React = require('react');
    const { TextInput, Text, View } = require('react-native');
    const [draft, setDraft] = React.useState('');
    const [response, setResponse] = React.useState('Responding…');
    React.useEffect(() => { mockFinishResponse = setResponse; }, []);
    return <View testID="chat" {...props}><TextInput value={draft} onChangeText={setDraft} /><Text>{response}</Text></View>;
  },
}));
import { StylistScreen } from '../StylistScreen';
const navigation = { navigate: jest.fn(), setParams: jest.fn() };
let renderer: TestRenderer.ReactTestRenderer;
const nodes = (type: string) => renderer.root.findAllByType(type as any);
afterEach(() => { act(() => renderer?.unmount()); mockPremium = true; jest.clearAllMocks(); });

it('keeps the chat instance, draft, and arriving response alive while Saved is visible', () => {
  act(() => { renderer = TestRenderer.create(<StylistScreen navigation={navigation as any} route={{ params: undefined } as any} />); });
  const chat = renderer.root.findByProps({ testID: 'chat' });
  act(() => renderer.root.findByType(TextInput).props.onChangeText('My unfinished question'));
  act(() => nodes('SegmentedControl')[0].props.onChange('saved'));
  expect(renderer.root.findByProps({ testID: 'chat' })).toBe(chat);
  expect(nodes('SavedRecommendationsContent')[0].props.active).toBe(true);
  act(() => mockFinishResponse('The completed response'));
  act(() => nodes('SegmentedControl')[0].props.onChange('chat'));
  expect(renderer.root.findByType(TextInput).props.value).toBe('My unfinished question');
  expect(JSON.stringify(renderer.toJSON())).toContain('The completed response');
  expect(nodes('SavedRecommendationsContent')[0].props.active).toBe(false);
});

it('opens incoming saved category and selection and consumes one-time parameters', () => {
  act(() => { renderer = TestRenderer.create(<StylistScreen navigation={navigation as any} route={{ params: { view: 'saved', tab: 'pieces', selectedId: 'piece' } } as any} />); });
  expect(nodes('SegmentedControl')[0].props.value).toBe('saved');
  expect(nodes('SavedRecommendationsContent')[0].props).toEqual(expect.objectContaining({ initialTab: 'pieces', selectedId: 'piece' }));
  expect(navigation.setParams).toHaveBeenCalledWith({ view: undefined });
  act(() => nodes('SavedRecommendationsContent')[0].props.onSelectionConsumed());
  act(() => nodes('SavedRecommendationsContent')[0].props.onTabConsumed());
  expect(navigation.setParams).toHaveBeenCalledWith({ selectedId: undefined });
  expect(navigation.setParams).toHaveBeenCalledWith({ tab: undefined });
});

it('keeps Saved accessible when premium expires, while Chat remains gated', () => {
  mockPremium = false;
  act(() => { renderer = TestRenderer.create(<StylistScreen navigation={navigation as any} route={{ params: undefined } as any} />); });
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  expect(nodes('ActionButton')[0].props.label).toBe('Meet your stylist');
  act(() => nodes('SegmentedControl')[0].props.onChange('saved'));
  expect(nodes('SavedRecommendationsContent')[0].props.active).toBe(true);
});
