import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { ClosetScreen } from '../ClosetScreen';

const mockRecord = jest.fn();
let mockRecent: string[] = [];
let mockAccount = 'account-a';
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: mockAccount } }) }));
jest.mock('../../../hooks/useClosetSearchHistory', () => ({ useClosetSearchHistory: () => ({ recent: mockRecent, record: mockRecord, clear: jest.fn() }) }));
jest.mock('../../../lib/resolveImageUri', () => ({ resolveImageUri: (uri: string) => uri }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]), useScrollToTop: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, FadeIn: { duration: () => ({ reduceMotion: () => undefined }) }, FadeOut: { duration: () => ({ reduceMotion: () => undefined }) }, ReduceMotion: { System: 'system' }, useSharedValue: (value: number) => require('react').useRef({ value }).current, useAnimatedScrollHandler: () => jest.fn() }));
jest.mock('../../../lib/closet-preferences', () => ({ gridColumns: (mode: string) => mode === 'list' ? 1 : mode === 'grid3' ? 3 : mode === 'grid4' ? 4 : 2, pinchViewMode: (mode: string) => mode, loadPiecesViewMode: () => new Promise(() => {}), savePiecesViewMode: jest.fn() }));
jest.mock('react-native-gesture-handler', () => {
  const chain: any = new Proxy({}, { get: () => () => chain });
  return { Gesture: { Pinch: () => chain }, GestureDetector: ({ children }: any) => children };
});
jest.mock('../../../components/wardrobe/ClosetRails', () => ({ ClosetRails: () => null }));
jest.mock('../../../components/wardrobe/closet-header', () => ({ ClosetHeader: (props: any) => require('react').createElement('ClosetHeader', props, props.children, props.overflowAction) }));
jest.mock('../../../features/closet-selection/SelectionActionBar', () => ({ SelectionActionBar: 'SelectionActionBar', selectionBarClearance: () => 0 }));
jest.mock('../../../components/wardrobe/closet-navigation', () => ({ ClosetNavigation: 'ClosetNavigation' }));
jest.mock('../../../components/wardrobe/closet-view-menu', () => ({ ClosetViewMenu: 'ClosetViewMenu' }));
jest.mock('../../../components/wardrobe/animated-closet-list', () => ({ AnimatedClosetList: (props: any) => require('react').createElement('AnimatedClosetList', props, props.children, props.ListHeaderComponent, props.ListEmptyComponent) }));
jest.mock('../../../components/outfits/OutfitCollage', () => ({ OutfitCollage: 'OutfitCollage' }));
jest.mock('../../../components/outfits/OutfitBuilderSheet', () => ({ OutfitBuilderSheet: 'OutfitBuilderSheet' }));
jest.mock('../../../components/wardrobe/FilterPanel', () => ({ FilterPanel: 'FilterPanel' }));
jest.mock('../../../components/outfits/OutfitFilterPanel', () => ({ OutfitFilterPanel: 'OutfitFilterPanel' }));
const mockList = {
  getAbsoluteLastScrollOffset: jest.fn(() => 0),
  getFirstVisibleIndex: jest.fn(() => 0),
  getFirstItemOffset: jest.fn(() => 168),
  getLayout: jest.fn(() => ({ y: 0, height: 800 })),
  scrollToOffset: jest.fn(),
  scrollToIndex: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../../components/wardrobe/ClosetGrid', () => ({ ClosetGrid: (props: any) => {
  require('react').useImperativeHandle(props.ref, () => mockList);
  return require('react').createElement('ClosetGrid', { ...props, ref: undefined }, props.ListHeaderComponent, props.ListEmptyComponent);
} }));
jest.mock('../../../components/boards/BoardCard', () => ({ BoardCard: 'BoardCard' }));
jest.mock('../../../components/boards/BoardOptionsMenuSheet', () => ({ BoardOptionsMenuSheet: 'BoardOptionsMenuSheet' }));
jest.mock('../../../components/boards/BoardNameSheet', () => ({ BoardNameSheet: 'BoardNameSheet' }));
jest.mock('../../../components/boards/SaveToBoardSheet', () => ({ SaveToBoardSheet: 'SaveToBoardSheet' }));
jest.mock('../../../components/primitives/PressableScale', () => ({ PressableScale: 'PressableScale' }));
jest.mock('../../../components/primitives/Editorial', () => ({ FilterControl: 'FilterControl', SegmentedControl: 'SegmentedControl' }));
jest.mock('../../../components/primitives/SearchField', () => ({ SearchField: 'SearchField' }));
jest.mock('../../../components/primitives/GarmentCardSkeleton', () => ({ GarmentCardSkeleton: 'GarmentCardSkeleton' }));
jest.mock('../../../components/primitives/SkeletonLoader', () => ({ SkeletonBlock: 'SkeletonBlock' }));
jest.mock('../../../components/primitives/ErrorState', () => ({ ErrorState: 'ErrorState' }));
jest.mock('../../../components/wardrobe/garment-image', () => ({ GarmentImage: 'GarmentImage' }));
jest.mock('../../../components/wardrobe/PolishingBadge', () => ({ PolishingBadge: () => null }));
jest.mock('../../../components/wardrobe/item-secondary-meta', () => ({ ItemSecondaryMeta: 'ItemSecondaryMeta' }));

const mockItems = [
  { id: 1, name: 'Linen shirt', category: 'top', createdAt: '2026-01-01', wearCount: 0 },
  { id: 2, name: 'Black trousers', category: 'bottom', createdAt: '2026-01-02', wearCount: 2 },
];
const mockOutfits = [{ id: 7, name: 'Weekend', createdAt: '2026-01-01', tags: [], wearCount: 0 }];
const mockEmpty: never[] = [];
let mockBoards: any[] = [];
const mockMutation = { mutate: jest.fn(), mutateAsync: jest.fn() };
jest.mock('../../../hooks/useItems', () => ({ useItems: () => ({ data: mockItems }), useUpdateItem: () => mockMutation, useDeleteItem: () => mockMutation, useMarkItemWorn: () => mockMutation }));
jest.mock('../../../hooks/useOutfits', () => ({ useOutfits: () => ({ data: mockOutfits }), useMarkOutfitWorn: () => mockMutation, useDeleteOutfit: () => mockMutation, useUpdateOutfit: () => mockMutation }));
jest.mock('../../../hooks/useEvents', () => ({ useEvents: () => ({ data: mockEmpty }) }));
jest.mock('../../../hooks/useLendContacts', () => ({ useLendContacts: () => ({ data: mockEmpty }), useLoans: () => ({ data: mockEmpty }) }));
jest.mock('../../../hooks/useBoards', () => ({ useBoards: () => ({ data: mockBoards }), useCreateBoard: () => mockMutation, useDeleteBoard: () => mockMutation, useUpdateBoard: () => mockMutation }));
jest.mock('../../../hooks/useCameraLaunch', () => ({ useLibraryLaunch: () => jest.fn() }));
jest.mock('../../../contexts/GlobalScanContext', () => ({ useGlobalScan: () => ({ openScanItem: jest.fn(), openBatchScan: jest.fn() }) }));
jest.mock('../../../contexts/GlobalAddSheetContext', () => ({ useGlobalAddSheet: () => ({ openAddSheet: jest.fn() }) }));
const mockOpenStylist = jest.fn();
jest.mock('../../../contexts/GlobalAIStylistContext', () => ({ useGlobalAIStylist: () => ({ openStylist: mockOpenStylist }) }));
jest.mock('../../../contexts/FabScrollContext', () => ({ useFabScroll: () => ({ fabCollapsed: { value: 0 } }) }));

let renderer: TestRenderer.ReactTestRenderer;
const node = (type: string) => renderer.root.findByType(type as any);
const button = (label: string) => renderer.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
beforeEach(() => { mockRecent = []; mockBoards = []; jest.clearAllMocks(); mockList.getAbsoluteLastScrollOffset.mockReturnValue(0); act(() => { renderer = TestRenderer.create(<ClosetScreen navigation={{ navigate: jest.fn(), setParams: jest.fn() } as any} route={{ params: {} } as any} />); }); });
afterEach(() => { act(() => renderer.unmount()); });

it('enters selection from the menu with zero selected items and stays there after clearing', () => {
  act(() => node('ClosetViewMenu').props.onSelect());
  expect(node('ClosetGrid').props.selectionMode).toBe(true);
  expect(node('ClosetGrid').props.selectedIds.size).toBe(0);
  act(() => node('ClosetGrid').props.onToggleSelect(1));
  act(() => node('ClosetGrid').props.onToggleSelect(1));
  expect(node('ClosetGrid').props.selectionMode).toBe(true);
  expect(node('ClosetGrid').props.selectedIds.size).toBe(0);
  expect(node('ClosetHeader').props.selection).toMatchObject({ count: 0, noun: 'piece', isAllSelected: false });
  act(() => node('ClosetHeader').props.selection.onToggleAll());
  expect(node('ClosetGrid').props.selectedIds.size).toBe(node('ClosetGrid').props.items.length);
  expect(node('ClosetHeader').props.selection.isAllSelected).toBe(true);
  expect(node('SelectionActionBar').props.count).toBe(node('ClosetGrid').props.items.length);
  act(() => node('ClosetHeader').props.selection.onCancel());
  expect(node('ClosetGrid').props.selectionMode).toBe(false);
});
it('preserves separate searches and category filters while switching sections', () => {
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('SearchField').props.onChangeText('shirt'));
  act(() => button('Tops').props.onPress());
  act(() => node('ClosetViewMenu').props.onSelect());
  act(() => node('ClosetNavigation').props.onChange('outfits'));
  expect(renderer.root.findAllByType('SearchField' as any)).toHaveLength(0);
  act(() => node('ClosetNavigation').props.onSearch());
  expect(node('SearchField').props.value).toBe('');
  act(() => node('SearchField').props.onChangeText('Weekend'));
  act(() => node('ClosetNavigation').props.onChange('boards'));
  act(() => node('ClosetNavigation').props.onChange('pieces'));
  expect(node('SearchField').props.value).toBe('shirt');
  expect(button('Tops').props.accessibilityState.checked).toBe(true);
  expect(node('ClosetGrid').props.items.map((item: { id: number }) => item.id)).toEqual([1]);
  expect(node('ClosetGrid').props.selectionMode).toBe(false);
  act(() => node('ClosetNavigation').props.onChange('outfits'));
  expect(node('SearchField').props.value).toBe('Weekend');
});
it('disables menu selection for empty results', () => {
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('SearchField').props.onChangeText('missing'));
  expect(node('ClosetViewMenu').props.selectionDisabled).toBe(true);
  expect(renderer.root.findAll(n => n.children?.includes('No matching pieces'))).toHaveLength(1);
  expect(renderer.root.findAll(n => n.children?.includes('Try removing a search term'))).toHaveLength(1);
});

it('clears a no-result search and restores the full collection', () => {
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('SearchField').props.onChangeText('missing'));
  act(() => button('Clear search').props.onPress());
  expect(node('ClosetNavigation').props.query).toBe('');
  expect(node('ClosetGrid').props.items).toHaveLength(2);
  expect(button('Clear search')).toBeUndefined();
});

it('commits search as a pill on Done and closes an empty search', () => {
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('SearchField').props.onChangeText('shirt'));
  act(() => button('Done searching').props.onPress());
  expect(node('ClosetNavigation').props.query).toBe('shirt');
  expect(mockRecord).toHaveBeenCalledWith('shirt');
  expect(node('ClosetGrid').props.items).toHaveLength(1);
  expect(renderer.root.findAllByType('SearchField' as any)).toHaveLength(0);
  expect(button('Remove search filter Shirt')).toBeDefined();
});
it('adds multiple AND search pills with Enter and lets each one be removed', () => {
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('SearchField').props.onChangeText('black'));
  act(() => node('SearchField').props.onSubmitEditing());
  expect(node('SearchField').props.value).toBe('');
  expect(node('ClosetNavigation').props.query).toBe('black');
  act(() => node('SearchField').props.onChangeText('trousers'));
  act(() => node('SearchField').props.onSubmitEditing());
  expect(node('ClosetNavigation').props.query).toBe('black trousers');
  expect(node('ClosetGrid').props.items.map((item: any) => item.id)).toEqual([2]);
  act(() => button('Remove search filter Black').props.onPress());
  expect(node('ClosetNavigation').props.query).toBe('trousers');
  expect(node('ClosetGrid').props.items.map((item: any) => item.id)).toEqual([2]);
});
it('preserves search pills independently across sections', () => {
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('SearchField').props.onChangeText('shirt'));
  act(() => button('Done searching').props.onPress());
  act(() => node('ClosetNavigation').props.onChange('outfits'));
  expect(node('ClosetNavigation').props.query).toBe('');
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('SearchField').props.onChangeText('Weekend'));
  act(() => button('Done searching').props.onPress());
  expect(node('ClosetNavigation').props.query).toBe('Weekend');
  act(() => node('ClosetNavigation').props.onChange('pieces'));
  expect(node('ClosetNavigation').props.query).toBe('shirt');
  expect(button('Remove search filter Shirt')).toBeDefined();
  act(() => node('ClosetNavigation').props.onChange('outfits'));
  expect(node('ClosetNavigation').props.query).toBe('Weekend');
});
it('deduplicates equivalent filters and clears only the draft from the input control', () => {
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('SearchField').props.onChangeText('LINEN'));
  act(() => node('SearchField').props.onSubmitEditing());
  act(() => node('SearchField').props.onChangeText('  LíNEN!!!  '));
  act(() => node('SearchField').props.onSubmitEditing());
  expect(renderer.root.findAll(n => n.props.accessibilityLabel === 'Remove search filter Linen')).toHaveLength(1);
  expect(renderer.root.findAll(n => n.children?.includes('Linen'))).toHaveLength(1);
  expect(node('ClosetNavigation').props.query).toBe('LINEN');
  act(() => node('SearchField').props.onChangeText('shirt'));
  act(() => node('SearchField').props.onChangeText(''));
  expect(node('SearchField').props.value).toBe('');
  expect(node('ClosetNavigation').props.query).toBe('LINEN');
});
it('removes categories without clearing the query', () => {
  act(() => button('Tops').props.onPress());
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('SearchField').props.onChangeText('trousers'));
  act(() => button('Search all categories').props.onPress());
  expect(node('SearchField').props.value).toBe('trousers');
  expect(node('ClosetGrid').props.items.map((i: any) => i.id)).toEqual([2]);
});
it('clears query and field visibility when the account changes', () => {
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('SearchField').props.onChangeText('shirt'));
  act(() => button('Done searching').props.onPress());
  mockAccount = 'account-b';
  act(() => renderer.update(<ClosetScreen navigation={{ navigate: jest.fn(), setParams: jest.fn() } as any} route={{ params: {} } as any} />));
  expect(node('ClosetNavigation').props.query).toBe('');
  expect(button('Remove search filter Shirt')).toBeUndefined();
  expect(renderer.root.findAllByType('SearchField' as any)).toHaveLength(0);
  mockAccount = 'account-a';
});
it('keeps category feedback in quick chips and offers clear without duplicate tokens', () => {
  const labelStyle = () => StyleSheet.flatten(button('Tops').findByType('Text' as any).props.style);
  const initialWeight = labelStyle().fontWeight;
  const initialScrollRows = renderer.root.findAll(n => n.type === ('ScrollView' as any)).length;
  act(() => button('Tops').props.onPress());
  expect(button('Tops').props.accessibilityState.checked).toBe(true);
  expect(button('Tops').findAllByType('Ionicons' as any)).toHaveLength(0);
  expect(labelStyle().fontWeight).toBe(initialWeight);
  expect(renderer.root.findAll(n => n.type === ('ScrollView' as any))).toHaveLength(initialScrollRows);
  expect(button('Remove Category: Tops filter')).toBeUndefined();
  expect(node('ClosetHeader').props.summary).toBe('1 of 2 pieces');
  act(() => button('Clear filters').props.onPress());
  expect(node('ClosetGrid').props.items).toHaveLength(2);
});

it('restores the scrolled garment after search changes the measured header', async () => {
  const frames: FrameRequestCallback[] = [];
  const frameSpy = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  try {
    act(() => node('ClosetHeader').props.onMeasure(112, 20));
    await act(async () => { frames.splice(0).forEach(callback => callback(0)); });
    mockList.getAbsoluteLastScrollOffset.mockReturnValue(300);
    mockList.scrollToIndex.mockClear();
    mockList.scrollToOffset.mockClear();
    act(() => node('ClosetNavigation').props.onSearch());
    expect(mockList.scrollToOffset).not.toHaveBeenCalled();
    act(() => node('ClosetHeader').props.onMeasure(168, 20));
    await act(async () => { frames.splice(0).forEach(callback => callback(0)); });
    // First garment was cropped 224pt under a 92pt pinned header. Opening
    // search adds 56pt to the pinned header while retaining that crop.
    expect(mockList.scrollToIndex).toHaveBeenLastCalledWith({ index: 0, viewOffset: 76, animated: false });
    expect(mockList.scrollToOffset).not.toHaveBeenCalled();
    act(() => node('SearchField').props.onChangeText('shirt'));
    expect(mockList.scrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });
  } finally { frameSpy.mockRestore(); }
});

it('retains board search when the collection drops below the entry threshold', () => {
  mockBoards = Array.from({ length: 6 }, (_, i) => ({ id: i, name: `Board ${i}` }));
  act(() => node('ClosetNavigation').props.onChange('boards'));
  expect(node('ClosetNavigation').props.searchAvailable).toBe(true);
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('SearchField').props.onChangeText('Board'));
  mockBoards = [mockBoards[0]];
  act(() => node('SearchField').props.onSubmitEditing());
  expect(node('SearchField').props.value).toBe('');
  expect(node('ClosetNavigation').props.query).toBe('Board');
  expect(node('ClosetNavigation').props.searchAvailable).toBe(true);
});
it('resets results to the top when typing also changes the header height', async () => {
  const frames: FrameRequestCallback[] = [];
  const spy = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  try {
    act(() => node('ClosetNavigation').props.onSearch());
    mockList.getAbsoluteLastScrollOffset.mockReturnValue(300);
    act(() => node('SearchField').props.onChangeText('shirt'));
    act(() => node('ClosetHeader').props.onMeasure(168, 20));
    await act(async () => { frames.splice(0).forEach(callback => callback(0)); });
    await act(async () => { frames.splice(0).forEach(callback => callback(0)); });
    expect(mockList.scrollToOffset).toHaveBeenLastCalledWith({ offset: 0, animated: false });
  } finally { spy.mockRestore(); }
});
it('keeps browsing controls visible when opening search with saved history', () => {
  mockRecent = ['linen'];
  expect(node('ClosetGrid').props.ListHeaderComponent).not.toBeNull();
  act(() => node('ClosetNavigation').props.onSearch());
  expect(node('SearchField').props.placeholder).toBe('Search your pieces');
  expect(node('ClosetGrid').props.ListHeaderComponent).not.toBeNull();
  expect(button('Search linen')).toBeUndefined();
  act(() => node('SearchField').props.onChangeText('linen'));
  expect(node('ClosetGrid').props.ListHeaderComponent).not.toBeNull();
});


it('switches pieces between two- and three-column grids and remembers the choice', () => {
  const { savePiecesViewMode } = require('../../../lib/closet-preferences');
  expect(node('ClosetGrid').props.numColumns).toBe(2);
  act(() => node('ClosetViewMenu').props.onChange('grid3'));
  expect(node('ClosetGrid').props.numColumns).toBe(3);
  expect(savePiecesViewMode).toHaveBeenCalledWith('grid3');
  act(() => node('ClosetViewMenu').props.onChange('grid'));
  expect(node('ClosetGrid').props.numColumns).toBe(2);
});

it('offers three columns for outfits without changing the pieces layout', () => {
  act(() => node('ClosetNavigation').props.onChange('outfits'));
  act(() => node('ClosetViewMenu').props.onChange('grid3'));
  expect(node('AnimatedClosetList').props.numColumns).toBe(3);
  act(() => node('ClosetNavigation').props.onChange('pieces'));
  expect(node('ClosetGrid').props.numColumns).toBe(2);
});

it('opens the stylist with all selected pieces attached and waits for a question', () => {
  act(() => node('ClosetViewMenu').props.onSelect());
  act(() => node('ClosetGrid').props.onToggleSelect(1));
  act(() => node('ClosetGrid').props.onToggleSelect(2));
  act(() => node('SelectionActionBar').props.actions.find((action: any) => action.label === 'Stylist').onPress());
  expect(mockOpenStylist).toHaveBeenCalledWith(expect.objectContaining({
    source: 'closet_selection',
    initialAttachment: expect.objectContaining({ type: 'items', items: expect.arrayContaining([
      expect.objectContaining({ itemId: 1 }), expect.objectContaining({ itemId: 2 }),
    ]) }),
  }));
  expect(mockOpenStylist.mock.calls[0][0].initialQuery).toBeUndefined();
});
