import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { FlatList, ScrollView, StyleSheet, TextInput } from 'react-native';
import type { ShoppingSnap } from '../../../types/shoppingSnap';
import type { WishlistEntry } from '../../../lib/wishlist';
import type { ShoppingBrief } from '../../../lib/shopDecisionWorkspace';

jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => { const React = jest.requireActual('react'); return { __esModule: true, default: function MockPressable({ children, ...props }: any) { return React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children); } }; });

jest.mock('@react-navigation/native', () => ({ createNavigationContainerRef: () => ({ isReady: () => false }), useIsFocused: () => true, usePreventRemove: jest.fn(), CommonActions: { reset: jest.fn(() => ({ type: 'RESET' })), navigate: jest.fn((params) => ({ type: 'NAVIGATE', payload: params })) }, useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView' }, FadeIn: { duration: () => ({}) }, FadeOut: { duration: () => ({}) }, useReducedMotion: () => true,
  useSharedValue: () => ({ value: 1 }), useAnimatedStyle: () => ({}),
}));
jest.mock('../../../components/primitives/PressableScale', () => ({ PressableScale: 'PressableScale' }));
jest.mock('../../../components/primitives/Editorial', () => ({ ActionButton: 'ActionButton', FilterControl: 'FilterControl', IconButton: 'IconButton', SegmentedControl: 'SegmentedControl', EditorialSection: 'EditorialSection', ScreenHeader: 'ScreenHeader' }));
jest.mock('../../../components/primitives/EditorialRow', () => ({ EditorialRow: 'EditorialRow' }));
jest.mock('../../../components/shopping/ShopSubpageHeader', () => ({ ShopSubpageHeader: (props: any) => require('react').createElement('ShopSubpageHeader', props, props.actions) }));
jest.mock('../../../components/shopping/ShortlistCarousel', () => ({ ShortlistCarousel: 'ShortlistCarousel' }));
jest.mock('../../../components/outfits/SavedLookTile', () => ({ SavedLookTile: 'SavedLookTile' }));
jest.mock('../../../components/outfits/ShopWishlistSummaryCard', () => ({ ShopWishlistSummaryCard: 'ShopWishlistSummaryCard' }));
jest.mock('../../../components/outfits/ShopWishlistDetailSheet', () => ({ ShopWishlistDetailSheet: 'ShopWishlistDetailSheet' }));
jest.mock('../../../components/outfits/ShopWishlistFilterSheet', () => ({ ShopWishlistFilterSheet: 'ShopWishlistFilterSheet' }));
jest.mock('../../../components/boards/SaveToBoardSheet', () => ({ SaveToBoardSheet: 'SaveToBoardSheet' }));
jest.mock('../../../components/primitives/ActionMenuSheet', () => ({ ActionMenuSheet: 'ActionMenuSheet' }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../lib/paywall', () => ({ presentPaywall: jest.fn() }));
jest.mock('../../../lib/aiActionCoach', () => ({ hasSeenAiActionCoach: jest.fn().mockResolvedValue(true), markAiActionCoachSeen: jest.fn() }));
const mockOpenStylist = jest.fn();
jest.mock('../../../contexts/GlobalAIStylistContext', () => ({ useGlobalAIStylist: () => ({ openStylist: mockOpenStylist }) }));
const mockRefetch = jest.fn();
let mockEntries: WishlistEntry[] = [];
jest.mock('../../../hooks/useWishlist', () => ({ useWishlist: () => ({ data: mockEntries, isFetchedAfterMount: true, refetch: mockRefetch }), useRemoveFromWishlist: () => ({ mutate: jest.fn() }) }));
jest.mock('../../../hooks/useItems', () => ({ useItems: () => ({ refetch: mockRefetch }) }));
jest.mock('../../../hooks/useCurrencyCode', () => ({ useCurrencyCode: () => 'USD' }));
jest.mock('../../../hooks/useEntitlement', () => ({ useEntitlement: () => ({ isPremium: true }) }));
const mockBrief: ShoppingBrief = {
  status: 'ready', headline: 'Three useful additions', summary: 'Based on your wardrobe', generatedAt: '2026-09-20', source: 'rules',
  priorities: [{ label: 'Leather sneakers', category: 'shoes', reason: 'wardrobe_gap', priority: 1, context: 'With your tailoring', unlocks: [], candidateKey: 'sneakers', recommendationKey: 'rec-1', impactScore: 130 }],
};
jest.mock('../../../hooks/useShoppingFeedback', () => ({ useShoppingFeedback: () => ({ pending: [], error: null, dismiss: jest.fn(), undo: jest.fn() }) }));
jest.mock('../../../hooks/useShoppingPriorityEdit', () => ({ useShoppingPriorityEdit: () => ({ data: undefined, isLoading: true }) }));
jest.mock('../../../components/shopping/CuratedItemRail', () => ({ CuratedItemRail: 'CuratedItemRail' }));
jest.mock('../../../hooks/useShoppingBrief', () => ({ useShoppingBrief: () => ({ data: mockBrief, refetch: mockRefetch }) }));
const mockSnaps: ShoppingSnap[] = [];
const mockPending: never[] = [];
jest.mock('../../../hooks/useShoppingSnaps', () => ({ useShoppingSnaps: () => ({ data: mockSnaps, isRefetching: false, isLoading: false, refetch: mockRefetch }) }));
jest.mock('../../../stores/useShoppingSessionStore', () => ({ useShoppingSessionStore: (selector: any) => selector({ pendingUploads: mockPending }) }));

jest.mock('../../../components/shopping/ShoppingPieceTile', () => ({ ShoppingPieceTile: 'ShoppingPieceTile' }));
jest.mock('../../../components/shopping/WardrobeThumbnail', () => ({ WardrobeThumbnail: 'WardrobeThumbnail' }));
jest.mock('../../../components/shopping/ShoppingCompare', () => ({ ShoppingCompare: 'ShoppingCompare' }));
jest.mock('../../../components/shopping/ShoppingSyncNotice', () => ({ ShoppingSyncNotice: 'ShoppingSyncNotice' }));
jest.mock('../../../components/shopping/ShoppingSessionBundle', () => ({ ShoppingSessionBundle: 'ShoppingSessionBundle' }));
jest.mock('../../../components/shopping/ShoppingItemLightbox', () => ({ ShoppingItemLightbox: 'ShoppingItemLightbox' }));
jest.mock('../../../components/shopping/ShoppingStoreFilterSheet', () => ({ ShoppingStoreFilterSheet: 'ShoppingStoreFilterSheet' }));
jest.mock('../../../components/shopping/ShoppingStoreAssignmentSheet', () => ({ ShoppingStoreAssignmentSheet: 'ShoppingStoreAssignmentSheet' }));
jest.mock('../../../components/shopping/ShortlistFilterBar', () => ({ ShortlistFilterBar: 'ShortlistFilterBar', ShortlistToggleChip: 'ShortlistToggleChip' }));
jest.mock('../../../components/primitives/EditAtoms', () => ({ OptionChips: 'OptionChips' }));
jest.mock('../../../components/primitives/SearchField', () => ({ SearchField: 'SearchField' }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }));
jest.mock('../../../hooks/useShoppingItemActions', () => ({ useShoppingItemActions: () => ({ saveCatalog: jest.fn() }) }));
jest.mock('../../../hooks/useAssignShoppingStore', () => ({ useAssignShoppingStore: () => jest.fn() }));
jest.mock('../../../lib/deleteShoppingSnaps', () => ({ deleteShoppingSnaps: jest.fn() }));
const mockAccount = { view: 'visits', snaps: [], operations: [] };
jest.mock('../../../stores/useShoppingOfflineStore', () => ({ useShoppingOfflineStore: (selector: any) => selector({ accounts: { 'test-user': mockAccount } }), emptyShoppingAccount: mockAccount }));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: 'BottomSheetModal',
  BottomSheetView: 'BottomSheetView',
  BottomSheetBackdrop: 'BottomSheetBackdrop',
  BottomSheetScrollView: require('react-native').ScrollView,
  BottomSheetTextInput: require('react-native').TextInput,
}));
import { ShoppingGalleryScreen } from '../ShoppingGalleryScreen';
import { SavedLooksScreen, SavedShoppingScreen, WishlistScreen } from '../ShopScreen';
import { SavedRecommendationsContent } from '../../../components/stylist/SavedRecommendationsContent';
import { ShopOverviewScreen } from '../ShopOverviewScreen';
import { BriefNote, briefIssueLabel, ShoppingBriefCard } from '../../../components/shopping/ShoppingBriefCard';

const mockTabNavigate = jest.fn();
const navigation = { dispatch: jest.fn(), getParent: () => ({ navigate: mockTabNavigate }), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), canGoBack: () => true, goBack: jest.fn() };
const entry = (id: string, recommendationType: 'look' | 'piece' | 'list', savedAt: string): WishlistEntry => ({
  id, recommendationType, savedAt,
  outfit: { recommendationType, intro: id, city: '', items: [], totalBudget: '', audioSummary: '' },
});
let renderer: TestRenderer.ReactTestRenderer;
function render(Component: any, params?: object) {
  act(() => { renderer = TestRenderer.create(<Component navigation={navigation} route={{ params }} />); });
  return renderer;
}
const nodes = (type: string) => renderer.root.findAllByType(type as any);
const button = (label: string) => renderer.root.findAll((node) => typeof node.type === 'string' && node.props.accessibilityLabel === label)[0];
afterEach(() => { act(() => renderer?.unmount()); jest.clearAllMocks(); });

it('opens the exact overview priority with its recommendation and brief context', () => {
  mockEntries = [];
  render(ShopOverviewScreen);
  const priority = mockBrief.priorities[0];
  act(() => button('View shopping guide: Leather sneakers').props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('ShoppingPriorityEdit', { priority, origin: 'shopping_brief', briefGeneratedAt: mockBrief.generatedAt });
  expect(nodes('Pressable').some(node => node.findAllByType(require('react-native').Text).some(child => child.props.children === 'Read your shopping brief →'))).toBe(true);
});

it('keeps starter suggestions behind the existing add-wardrobe action', () => {
  const onSelectPriority = jest.fn();
  act(() => { renderer = TestRenderer.create(<ShoppingBriefCard isPremium brief={{ ...mockBrief, status: 'insufficient_data' }} isLoading={false} isError={false} onOpenFullBrief={jest.fn()} onUpgrade={jest.fn()} onAddWardrobePieces={jest.fn()} onRetry={jest.fn()} onSelectPriority={onSelectPriority} />); });
  expect(button('Add wardrobe pieces')).toBeDefined();
  expect(button('Priority 1: Leather sneakers').props.onPress).toBeUndefined();
});

it('defaults to products and groups shopping outfits and guides together as lists', () => {
  mockEntries = [entry('look', 'look', '2026-09-18'), entry('piece', 'piece', '2026-09-19'), entry('guide', 'list', '2026-09-20')];
  act(() => { renderer = TestRenderer.create(<SavedRecommendationsContent onSelectionConsumed={jest.fn()} />); });
  expect(renderer.root.findByType(FlatList).props.data.map((item: WishlistEntry) => item.id)).toEqual(['piece']);
  expect(nodes('SegmentedControl')[0].props.options.map((option: any) => option.label)).toEqual(['Products 1', 'Lists 2']);
  act(() => nodes('SegmentedControl')[0].props.onChange('lists'));
  expect(renderer.root.findByType(FlatList).props.data.map((item: WishlistEntry) => item.id)).toEqual(['guide', 'look']);
});

it('redirects legacy saved destinations to Wishlist with section and selection intact', () => {
  render(SavedLooksScreen, { selectedId: 'guide' });
  expect(navigation.replace).toHaveBeenCalledWith('Wishlist', { section: 'lists', selectedId: 'guide' });
  act(() => renderer.unmount());
  render(SavedShoppingScreen, { tab: 'pieces', selectedId: 'piece' });
  expect(navigation.replace).toHaveBeenLastCalledWith('Wishlist', { section: 'products', selectedId: 'piece' });
});

it('opens selected recommendations of another type and consumes the selection once', () => {
  mockEntries = [entry('look', 'look', '2026-09-18'), entry('guide', 'list', '2026-09-20')];
  const consume = jest.fn();
  act(() => { renderer = TestRenderer.create(<SavedRecommendationsContent initialTab="looks" selectedId="guide" onSelectionConsumed={consume} />); });
  expect(nodes('ShopWishlistDetailSheet')[0].props.entry.id).toBe('guide');
  expect(nodes('SegmentedControl')[0].props.value).toBe('lists');
  expect(consume).toHaveBeenCalledTimes(1);
  act(() => renderer.update(<SavedRecommendationsContent onSelectionConsumed={consume} />));
  act(() => nodes('ShopWishlistDetailSheet')[0].props.onClose());
  expect(nodes('ShopWishlistDetailSheet')).toHaveLength(0);
});

it('consumes a deleted recommendation and explains why it cannot open', () => {
  mockEntries = [];
  const consume = jest.fn();
  act(() => { renderer = TestRenderer.create(<SavedRecommendationsContent selectedId="deleted" onSelectionConsumed={consume} />); });
  expect(consume).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(renderer.toJSON())).toContain('This recommendation is no longer saved.');
});

it('keeps saved-library search and category while switching away and back', () => {
  mockEntries = [entry('look', 'look', '2026-09-18'), entry('guide', 'list', '2026-09-20')];
  const consume = jest.fn();
  act(() => { renderer = TestRenderer.create(<SavedRecommendationsContent active onSelectionConsumed={consume} />); });
  act(() => nodes('SegmentedControl')[0].props.onChange('lists'));
  act(() => renderer.root.findByType(TextInput).props.onChangeText('guide'));
  act(() => renderer.update(<SavedRecommendationsContent active={false} onSelectionConsumed={consume} />));
  act(() => renderer.update(<SavedRecommendationsContent active onSelectionConsumed={consume} />));
  expect(nodes('SegmentedControl')[0].props.value).toBe('lists');
  expect(renderer.root.findByType(TextInput).props.value).toBe('guide');
});

it('offers a working shopping Stylist action when nothing is saved', () => {
  mockEntries = [];
  act(() => { renderer = TestRenderer.create(<SavedRecommendationsContent onSelectionConsumed={jest.fn()} />); });
  const action = nodes('ActionButton').find((node) => node.props.label === 'Ask your Stylist')!;
  act(() => action.props.onPress());
  expect(mockOpenStylist).toHaveBeenCalledWith(expect.objectContaining({ initialMode: 'shop_piece', source: 'shop' }));
});


it('resets every narrowing shortlist filter without changing the preferred view', () => {
  mockSnaps.push({ id: 'photo', captureGroupId: 'group', imageUri: 'file://test.jpg', capturedAt: '2026-09-01', captureRole: 'garment', syncStatus: 'synced', rawOcrText: '', extractedPrice: 50, currencyCode: 'CAD', category: 'top', storeName: 'COS', catalogStatus: 'considering' } as ShoppingSnap);
  render(ShoppingGalleryScreen);
  const input = (label: string) => renderer.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === label)!;
  act(() => {
    nodes('IconButton').find((node) => node.props.label === 'Search shortlist')!.props.onPress();
    nodes('ShortlistToggleChip')[0].props.onPress();
    nodes('ShoppingStoreFilterSheet')[0].props.onSelect('COS');
    input('Price filter currency').props.onChangeText('CAD');
    input('Minimum price').props.onChangeText('60');
    input('Maximum price').props.onChangeText('100');
    const chips = nodes('OptionChips');
    chips[0].props.onSelect('shoes');
    chips[1].props.onSelect('oldest');
    chips[2].props.onSelect('today');
    chips[3].props.onSelect('on-this-phone');
    chips[4].props.onMultiToggle('passed');
  });
  act(() => nodes('SearchField')[0].props.onChangeText('not-found'));
  expect(nodes('FilterControl')[0].props.count).toBeGreaterThan(0);
  act(() => renderer.update(<ShoppingGalleryScreen navigation={navigation as any} route={{ params: { catalogFilter: 'all', resetFilters: true } } as any} />));
  expect(nodes('FilterControl')[0].props.count).toBe(0);
  expect(nodes('SearchField')).toHaveLength(0);
  expect(nodes('ShortlistToggleChip')[0].props.active).toBe(false);
  expect(nodes('ShoppingStoreFilterSheet')[0].props.storeFilter).toBe('all');
  expect(input('Price filter currency').props.value).toBe('');
  expect(input('Minimum price').props.value).toBe('');
  expect(input('Maximum price').props.value).toBe('');
  expect(nodes('OptionChips').map((node) => node.props.value ?? node.props.multiValue)).toEqual(['', 'newest', 'all', 'all', []]);
  expect(nodes('SegmentedControl')[0].props.value).toBe('visits');
  expect(nodes('ShoppingSessionBundle')).toHaveLength(1);
  expect(navigation.setParams).toHaveBeenCalledWith({ focusGroupId: undefined, catalogFilter: undefined, resetFilters: undefined });
  act(() => renderer.update(<ShoppingGalleryScreen navigation={navigation as any} route={{ params: { catalogFilter: 'active' } } as any} />));
  expect(nodes('OptionChips')[4].props.multiValue).toEqual(['considering', 'wishlist']);
  mockSnaps.length = 0;
});

it('dates the edit from its own data and rolls the daily label over', () => {
  const data = { ...mockBrief, localDate: '2026-10-05' };
  expect(briefIssueLabel(data, new Date('2026-10-05T13:00:00'))).toBe('Today’s edit');
  expect(briefIssueLabel(data, new Date('2026-10-06T00:01:00'))).not.toBe('Today’s edit');
  expect(briefIssueLabel()).toBe('Daily edit');
});

it('full brief notes expose the complete stylist explanation without disclosure', () => {
  const text = Array.from({ length: 12 }, () => 'This addition works with your wardrobe for the week ahead.').join(' ');
  act(() => { renderer = TestRenderer.create(<BriefNote text={text} full />); });
  expect(renderer.root.findAllByType(require('react-native').Text).some(node => node.props.children === text)).toBe(true);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Read the full note');
});

it('gives shortlist its own Shop view with one masthead and preserves filters', () => {
  mockSnaps.push({ id: 'photo', captureGroupId: 'group', imageUri: 'file://test.jpg', capturedAt: '2026-09-01', captureRole: 'garment', syncStatus: 'synced', rawOcrText: '', extractedPrice: 50, currencyCode: 'CAD', category: 'top', storeName: 'COS', catalogStatus: 'considering' } as ShoppingSnap);
  render(ShopOverviewScreen);
  expect(nodes('SegmentedControl')[0].props.value).toBe('for-you');
  expect(nodes('EditorialSection').some(node => node.props.title === 'Saved recommendations')).toBe(false);
  act(() => nodes('SegmentedControl')[0].props.onChange('shortlist'));
  expect(nodes('ShopSubpageHeader')).toHaveLength(0);
  expect(nodes('ScreenHeader')).toHaveLength(1);
  act(() => nodes('ShortlistToggleChip')[0].props.onPress());
  act(() => nodes('SegmentedControl')[0].props.onChange('for-you'));
  act(() => nodes('SegmentedControl')[0].props.onChange('shortlist'));
  expect(nodes('ShortlistToggleChip')[0].props.active).toBe(true);
  act(() => renderer.update(<ShopOverviewScreen navigation={navigation as any} route={{ params: { view: 'shortlist', resetFilters: true, catalogFilter: 'active' } } as any} />));
  expect(nodes('ShortlistToggleChip')[0].props.active).toBe(false);
  expect(nodes('OptionChips')[4].props.multiValue).toEqual(['considering', 'wishlist']);
  mockSnaps.length = 0;
});

it('compacts the Shop header with hysteresis while keeping tabs visible and pane offsets intact', () => {
  render(ShopOverviewScreen);
  const event = (y: number) => ({ nativeEvent: { contentOffset: { y }, contentSize: { height: 2000 }, layoutMeasurement: { height: 600 } } });
  const menu = () => renderer.root.findAllByType(ScrollView).find(node => node.props.horizontal)!;
  const content = () => renderer.root.findAllByType(ScrollView).find(node => !node.props.horizontal)!;
  const visible = () => expect(StyleSheet.flatten(menu().props.style).display).not.toBe('none');
  act(() => content().props.onScroll(event(81)));
  expect(nodes('ScreenHeader')).toHaveLength(0);
  visible();
  act(() => content().props.onScroll(event(60)));
  expect(nodes('ScreenHeader')).toHaveLength(0);
  act(() => content().props.onScroll(event(39)));
  expect(nodes('ScreenHeader')).toHaveLength(1);
  act(() => content().props.onScroll(event(120)));
  act(() => nodes('SegmentedControl')[0].props.onChange('shortlist'));
  expect(nodes('ScreenHeader')).toHaveLength(1);
  const list = () => renderer.root.findAllByType(FlatList)[0];
  act(() => list().props.onScroll(event(100)));
  expect(nodes('ScreenHeader')).toHaveLength(0);
  visible();
  act(() => nodes('SegmentedControl')[0].props.onChange('for-you'));
  expect(nodes('ScreenHeader')).toHaveLength(0);
  expect(nodes('SegmentedControl')[0].props.value).toBe('for-you');
});

it('maps legacy Shop sections and honors a return destination', () => {
  render(ShopOverviewScreen, { section: 'shortlist', returnTo: 'Home', catalogFilter: 'active' });
  expect(navigation.replace).toHaveBeenCalledWith('ShoppingGallery', expect.objectContaining({ returnTo: 'Home', catalogFilter: 'active' }));
  act(() => renderer.update(<ShopOverviewScreen navigation={navigation as any} route={{ params: { section: 'saved-looks', selectedId: 'old' } } as any} />));
  expect(navigation.navigate).toHaveBeenCalledWith('Wishlist', { section: 'lists', selectedId: 'old' });
});

it('returns standalone Shortlist to the Home tab that opened it', () => {
  jest.useFakeTimers();
  try {
    render(ShoppingGalleryScreen, { returnTo: 'Home', catalogFilter: 'active' });
    act(() => nodes('ShopSubpageHeader')[0].props.onBack());
    expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'NAVIGATE', payload: { name: 'Home' } });
    act(() => jest.advanceTimersByTime(100));
    expect(require('@react-navigation/native').CommonActions.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'ShopMain' }] });
  } finally { jest.useRealTimers(); }
});

it('exposes Wishlist as a labelled Shop header action', () => {
  render(ShopOverviewScreen);
  act(() => nodes('ScreenHeader')[0].props.primaryAction.onPress());
  expect(nodes('ScreenHeader')[0].props.primaryAction.label).toBe('Wishlist');
  expect(navigation.navigate).toHaveBeenCalledWith('Wishlist');
  expect(nodes('ScreenHeader')[0].props.secondaryActions[0].label).toBe('Save a find');
});

it('renders Wishlist with products by default and a working back action', () => {
  mockEntries = [entry('piece', 'piece', '2026-09-19'), entry('look', 'look', '2026-09-18')];
  const nav = { ...navigation, addListener: jest.fn(() => jest.fn()), canGoBack: () => true, goBack: jest.fn() };
  act(() => { renderer = TestRenderer.create(<WishlistScreen navigation={nav as any} route={{ params: undefined } as any} />); });
  expect(nodes('ScreenHeader')[0].props.title).toBe('Wishlist');
  expect(nodes('SegmentedControl')[0].props.value).toBe('products');
  act(() => nodes('ScreenHeader')[0].props.primaryAction.onPress());
  expect(nav.goBack).toHaveBeenCalledTimes(1);
});

it('opens the selected shopping outfit in Lists and consumes both route parameters', () => {
  mockEntries = [entry('look', 'look', '2026-09-18')];
  const nav = { ...navigation, addListener: jest.fn(() => jest.fn()) };
  act(() => { renderer = TestRenderer.create(<WishlistScreen navigation={nav as any} route={{ params: { section: 'products', selectedId: 'look' } } as any} />); });
  expect(nodes('SegmentedControl')[0].props.value).toBe('lists');
  expect(nodes('ShopWishlistDetailSheet')[0].props.entry.id).toBe('look');
  expect(nav.setParams).toHaveBeenCalledWith({ section: undefined });
  expect(nav.setParams).toHaveBeenCalledWith({ selectedId: undefined });
});
