import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { ClosetScreen } from '../ClosetScreen';

jest.mock('../../../lib/resolveImageUri', () => ({ resolveImageUri: (uri: string) => uri }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-native-reanimated', () => ({ useSharedValue: (value: number) => require('react').useRef({ value }).current, useAnimatedScrollHandler: () => jest.fn() }));
jest.mock('../../../lib/closet-preferences', () => ({ loadPiecesViewMode: () => new Promise(() => {}), savePiecesViewMode: jest.fn() }));
jest.mock('../../../components/wardrobe/closet-header', () => ({ ClosetHeader: (props: any) => require('react').createElement('ClosetHeader', props, props.children, props.overflowAction) }));
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
jest.mock('../../../components/wardrobe/item-secondary-meta', () => ({ ItemSecondaryMeta: 'ItemSecondaryMeta' }));

const mockItems = [
  { id: 1, name: 'Linen shirt', category: 'top', createdAt: '2026-01-01', wearCount: 0 },
  { id: 2, name: 'Black trousers', category: 'bottom', createdAt: '2026-01-02', wearCount: 2 },
];
const mockOutfits = [{ id: 7, name: 'Weekend', createdAt: '2026-01-01', tags: [], wearCount: 0 }];
const mockEmpty: never[] = [];
const mockMutation = { mutate: jest.fn(), mutateAsync: jest.fn() };
jest.mock('../../../hooks/useItems', () => ({ useItems: () => ({ data: mockItems }), useUpdateItem: () => mockMutation, useDeleteItem: () => mockMutation, useMarkItemWorn: () => mockMutation }));
jest.mock('../../../hooks/useOutfits', () => ({ useOutfits: () => ({ data: mockOutfits }), useMarkOutfitWorn: () => mockMutation, useDeleteOutfit: () => mockMutation, useUpdateOutfit: () => mockMutation }));
jest.mock('../../../hooks/useEvents', () => ({ useEvents: () => ({ data: mockEmpty }) }));
jest.mock('../../../hooks/useBoards', () => ({ useBoards: () => ({ data: mockEmpty }), useCreateBoard: () => mockMutation, useDeleteBoard: () => mockMutation, useUpdateBoard: () => mockMutation }));
jest.mock('../../../hooks/useCameraLaunch', () => ({ useLibraryLaunch: () => jest.fn() }));
jest.mock('../../../contexts/GlobalScanContext', () => ({ useGlobalScan: () => ({ openScanItem: jest.fn(), openBatchScan: jest.fn() }) }));
jest.mock('../../../contexts/GlobalAddSheetContext', () => ({ useGlobalAddSheet: () => ({ openAddSheet: jest.fn() }) }));
jest.mock('../../../contexts/GlobalAIStylistContext', () => ({ useGlobalAIStylist: () => ({ openStylist: jest.fn() }) }));
jest.mock('../../../contexts/FabScrollContext', () => ({ useFabScroll: () => ({ fabCollapsed: { value: 0 } }) }));

let renderer: TestRenderer.ReactTestRenderer;
const node = (type: string) => renderer.root.findByType(type as any);
const button = (label: string) => renderer.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
beforeEach(() => { jest.clearAllMocks(); mockList.getAbsoluteLastScrollOffset.mockReturnValue(0); act(() => { renderer = TestRenderer.create(<ClosetScreen navigation={{ navigate: jest.fn(), setParams: jest.fn() } as any} route={{ params: {} } as any} />); }); });
afterEach(() => { act(() => renderer.unmount()); });

it('enters selection from the menu with zero selected items and stays there after clearing', () => {
  act(() => node('ClosetViewMenu').props.onSelect());
  expect(node('ClosetGrid').props.selectionMode).toBe(true);
  expect(node('ClosetGrid').props.selectedIds.size).toBe(0);
  act(() => node('ClosetGrid').props.onToggleSelect(1));
  act(() => node('ClosetGrid').props.onToggleSelect(1));
  expect(node('ClosetGrid').props.selectionMode).toBe(true);
  expect(node('ClosetGrid').props.selectedIds.size).toBe(0);
  act(() => button('Cancel selection').props.onPress());
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
});

it('hides search without clearing it and preserves visibility per section', () => {
  expect(renderer.root.findAllByType('SearchField' as any)).toHaveLength(0);
  act(() => node('ClosetNavigation').props.onSearch());
  expect(node('SearchField').props.autoFocus).toBe(true);
  act(() => node('SearchField').props.onChangeText('shirt'));
  act(() => button('Close search').props.onPress());
  expect(renderer.root.findAllByType('SearchField' as any)).toHaveLength(0);
  expect(node('ClosetNavigation').props.query).toBe('shirt');
  expect(node('ClosetGrid').props.items).toHaveLength(1);
  act(() => node('ClosetNavigation').props.onChange('outfits'));
  act(() => node('ClosetNavigation').props.onSearch());
  act(() => node('ClosetNavigation').props.onChange('pieces'));
  expect(node('ClosetNavigation').props.searchOpen).toBe(false);
  act(() => node('ClosetNavigation').props.onSearch());
  expect(node('SearchField').props.value).toBe('shirt');
  act(() => node('SearchField').props.onChangeText(''));
  expect(node('ClosetNavigation').props.searchOpen).toBe(true);
  expect(node('ClosetGrid').props.items).toHaveLength(2);
  act(() => node('ClosetNavigation').props.onChange('outfits'));
  expect(node('ClosetNavigation').props.searchOpen).toBe(true);
  expect(node('SearchField').props.autoFocus).toBe(false);
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
