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
const mockOpenWishlist = jest.fn();
jest.mock('../../../navigation/savedRecommendations', () => ({ openWishlist: (...args: any[]) => mockOpenWishlist(...args), wishlistSectionFromLegacy: (tab: string) => tab === 'looks' || tab === 'lists' ? 'lists' : 'products' }));
import { StylistScreen } from '../StylistScreen';
const navigation = { navigate: jest.fn(), setParams: jest.fn() };
let renderer: TestRenderer.ReactTestRenderer;
const nodes = (type: string) => renderer.root.findAllByType(type as any);
afterEach(() => { act(() => renderer?.unmount()); mockPremium = true; jest.clearAllMocks(); });

it('keeps the chat instance and draft alive when opening Wishlist', () => {
  act(() => { renderer = TestRenderer.create(<StylistScreen navigation={navigation as any} route={{ params: undefined } as any} />); });
  const chat = renderer.root.findByProps({ testID: 'chat' });
  act(() => renderer.root.findByType(TextInput).props.onChangeText('My unfinished question'));
  act(() => chat.props.onViewSaved('product'));
  expect(mockOpenWishlist).toHaveBeenCalledWith('product', 'products', 'Stylist');
  expect(renderer.root.findByProps({ testID: 'chat' })).toBe(chat);
  act(() => mockFinishResponse('The completed response'));
  expect(renderer.root.findByType(TextInput).props.value).toBe('My unfinished question');
  expect(JSON.stringify(renderer.toJSON())).toContain('The completed response');
  expect(nodes('SegmentedControl')).toHaveLength(0);
  expect(nodes('ScreenHeader')).toHaveLength(0);
  expect(nodes('SavedRecommendationsContent')).toHaveLength(0);
});

it('redirects incoming saved selection and consumes one-time parameters', () => {
  act(() => { renderer = TestRenderer.create(<StylistScreen navigation={navigation as any} route={{ params: { view: 'saved', tab: 'pieces', selectedId: 'piece' } } as any} />); });
  expect(mockOpenWishlist).toHaveBeenCalledWith('piece', 'products', 'Stylist');
  expect(navigation.setParams).toHaveBeenCalledWith({ view: undefined, tab: undefined, selectedId: undefined });
});

it('keeps wardrobe outfits in Closet and returns to Stylist', () => {
  act(() => { renderer = TestRenderer.create(<StylistScreen navigation={navigation as any} route={{ params: undefined } as any} />); });
  act(() => renderer.root.findByProps({ testID: 'chat' }).props.onNavigateToCloset(12));
  expect(navigation.navigate).toHaveBeenCalledWith('Closet', { screen: 'OutfitDetail', params: { outfitId: 12, returnTo: 'Stylist' } });
});

it('redirects saved content even when the chat premium entitlement expires', () => {
  mockPremium = false;
  act(() => { renderer = TestRenderer.create(<StylistScreen navigation={navigation as any} route={{ params: { view: 'saved', tab: 'lists' } } as any} />); });
  expect(mockOpenWishlist).toHaveBeenCalledWith(undefined, 'lists', 'Stylist');
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  expect(nodes('ActionButton')[0].props.label).toBe('Meet your stylist');
});
