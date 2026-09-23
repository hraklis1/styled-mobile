import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { FlatList, TextInput } from 'react-native';
import type { ShoppingSnap } from '../../../types/shoppingSnap';
import type { WishlistEntry } from '../../../lib/wishlist';
import type { ShoppingBrief } from '../../../lib/shopDecisionWorkspace';

jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn(), CommonActions: { reset: jest.fn() }, useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
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
jest.mock('../../../hooks/useWishlist', () => ({ useWishlist: () => ({ data: mockEntries, refetch: mockRefetch }), useRemoveFromWishlist: () => ({ mutate: jest.fn() }) }));
jest.mock('../../../hooks/useItems', () => ({ useItems: () => ({ refetch: mockRefetch }) }));
jest.mock('../../../hooks/useCurrencyCode', () => ({ useCurrencyCode: () => 'USD' }));
jest.mock('../../../hooks/useEntitlement', () => ({ useEntitlement: () => ({ isPremium: true }) }));
const mockBrief: ShoppingBrief = {
  status: 'ready', headline: 'Three useful additions', summary: 'Based on your wardrobe', generatedAt: '2026-09-20', source: 'rules',
  priorities: [{ label: 'Leather sneakers', category: 'shoes', reason: 'wardrobe_gap', priority: 1, context: 'With your tailoring', unlocks: [], candidateKey: 'sneakers', recommendationKey: 'rec-1', impactScore: 130 }],
};
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
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetModal: 'BottomSheetModal', BottomSheetView: 'BottomSheetView', BottomSheetBackdrop: 'BottomSheetBackdrop' }));
import { ShoppingGalleryScreen } from '../ShoppingGalleryScreen';
import { SavedLooksScreen, SavedShoppingScreen } from '../ShopScreen';
import { ShopOverviewScreen } from '../ShopOverviewScreen';
import { ShoppingBriefCard } from '../../../components/shopping/ShoppingBriefCard';

const navigation = { navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), canGoBack: () => true, goBack: jest.fn() };
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
  act(() => button('Priority 1: Leather sneakers').props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('ShoppingPriorityEdit', { priority, origin: 'shopping_brief', briefGeneratedAt: mockBrief.generatedAt });
  expect(button('Read the full brief')).toBeDefined();
});

it('keeps starter suggestions behind the existing add-wardrobe action', () => {
  const onSelectPriority = jest.fn();
  act(() => { renderer = TestRenderer.create(<ShoppingBriefCard isPremium brief={{ ...mockBrief, status: 'insufficient_data' }} isLoading={false} isError={false} onOpenFullBrief={jest.fn()} onUpgrade={jest.fn()} onAddWardrobePieces={jest.fn()} onRetry={jest.fn()} onSelectPriority={onSelectPriority} />); });
  expect(button('Add wardrobe pieces')).toBeDefined();
  expect(button('Priority 1: Leather sneakers').props.onPress).toBeUndefined();
});

it('defaults to all types sorted newest first and keeps type filters working', () => {
  mockEntries = [entry('look', 'look', '2026-09-18'), entry('piece', 'piece', '2026-09-19'), entry('guide', 'list', '2026-09-20')];
  render(SavedShoppingScreen);
  expect(renderer.root.findByType(FlatList).props.data.map((item: WishlistEntry) => item.id)).toEqual(['guide', 'piece', 'look']);
  expect(nodes('SegmentedControl')[0].props.options.map((option: any) => option.label)).toEqual(['All 3', 'Looks 1', 'Pieces 1', 'Lists 1']);
  act(() => nodes('SegmentedControl')[0].props.onChange('pieces'));
  expect(renderer.root.findByType(FlatList).props.data.map((item: WishlistEntry) => item.id)).toEqual(['piece']);
});

it('preserves legacy looks and opens selected entries of another type', () => {
  mockEntries = [entry('look', 'look', '2026-09-18'), entry('guide', 'list', '2026-09-20')];
  render(SavedLooksScreen);
  expect(nodes('SegmentedControl')[0].props.value).toBe('looks');
  act(() => renderer.update(<SavedLooksScreen navigation={navigation as any} route={{ params: { selectedId: 'guide' } } as any} />));
  expect(nodes('ShopWishlistDetailSheet')[0].props.entry.id).toBe('guide');
  expect(nodes('SegmentedControl')[0].props.value).toBe('lists');
});

it('offers a working shopping Stylist action when nothing is saved', () => {
  mockEntries = [];
  render(SavedShoppingScreen);
  const action = nodes('ActionButton').find((node) => node.props.label === 'Ask your Stylist')!;
  act(() => action.props.onPress());
  expect(mockOpenStylist).toHaveBeenCalledWith(expect.objectContaining({ initialMode: 'shop_new', source: 'shop' }));
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
