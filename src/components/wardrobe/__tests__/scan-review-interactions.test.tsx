import React, { useLayoutEffect, useRef, useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { FlatList, Text } from 'react-native';
import { ContactSheet } from '../scan-review/ContactSheet';
import { ActionBar } from '../scan-review/ActionBar';
import type { ScanReviewPiece } from '../scan-review/types';
import { useBatchExtractionReview } from '../../../hooks/useBatchExtractionReview';
import { applyInclusionChanges, reviewColumns } from '../../../lib/extraction-review';

jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: require('react-native').View } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));

const makePieces = (): ScanReviewPiece[] => Array.from({ length: 6 }, (_, i) => ({
  id: String(i), name: `Piece ${i}`, brand: '', included: true, extraction: 'not-started', photo: null,
  cutout: null, useCutout: false, canAdjustCrop: false, cropSource: null, cropBbox: null,
  category: null, subcategory: null, color: null, style: null, seasons: [], occasions: [],
  material: null, fit: null, sizeProfile: null, sleeveLength: null,
}));

let review!: ReturnType<typeof useBatchExtractionReview>;
let editBrand!: (id: string) => void;
const inspect = jest.fn();
const submit = jest.fn();
function Harness() {
  const [pieces, setPieces] = useState(makePieces);
  const offset = useRef(0);
  const currentReview = useBatchExtractionReview(pieces, false, changes => setPieces(current => applyInclusionChanges(current, changes)));
  useLayoutEffect(() => {
    review = currentReview;
    editBrand = id => setPieces(current => current.map(p => p.id === id ? { ...p, brand: 'COS' } : p));
  });
  return <>
    <Text>{currentReview.included.length} of {pieces.length} included</Text>
    <ContactSheet pieces={pieces} totalCount={pieces.length} stage="pre-extract" states={{}} guidance={{ lead: null, hint: '' }}
      checkCount={0} filter="all" selection={null} disabled={false} reduceMotion bottomPadding={16}
      onFilterChange={jest.fn()} onOpen={inspect} onToggleSelect={jest.fn()} scrollOffset={offset} focusId={null}
      onToggleIncluded={id => currentReview.change([id], !currentReview.snapshot().some(p => p.id === id))} />
    <ActionBar mode={{ kind: 'extract', count: currentReview.included.length, extractionCount: currentReview.included.length,
      onExtract: () => submit(currentReview.snapshot().map(p => p.id)) }} bottomInset={0} />
  </>;
}
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); act(() => { renderer = TestRenderer.create(<Harness />); }); });
afterEach(() => { act(() => renderer.unmount()); jest.useRealTimers(); });

it('keeps all six cards and updates counts while excluding four', () => {
  act(() => { review.change(['0', '1', '2', '3'], false); });
  expect(renderer.root.findByType(FlatList).props.data).toHaveLength(6);
  expect(renderer.root.findAllByType(Text).map(n => Array.isArray(n.props.children) ? n.props.children.join('') : n.props.children)).toContain('2 of 6 included');
  expect(renderer.root.findByType(ActionBar).props.mode.count).toBe(2);
  act(() => renderer.root.findByType(ActionBar).props.mode.onExtract());
  expect(submit).toHaveBeenCalledWith(['4', '5']);
});
it('uses the latest inclusion even before React renders and re-selection preserves edits', () => {
  act(() => {
    review.change(['0', '1', '2', '3'], false);
    expect(review.snapshot().map(p => p.id)).toEqual(['4', '5']);
  });
  act(() => editBrand('0'));
  act(() => review.change(['0', '1', '2', '3'], true));
  expect(review.snapshot()).toHaveLength(6);
  expect(review.snapshot()[0].brand).toBe('COS');
});
it('excluded records remain visible and zero remains recoverable', () => {
  act(() => review.change(makePieces().map(p => p.id), false));
  expect(renderer.root.findByType(FlatList).props.data).toHaveLength(6);
  expect(renderer.root.findByType(ActionBar).props.mode.count).toBe(0);
  expect(renderer.root.findAllByType(Text).map(n => n.props.children)).toContain('Choose at least 1 piece');
  act(() => review.change(['0'], true));
  expect(review.snapshot().map(p => p.id)).toEqual(['0']);
});
it('checkbox taps never inspect and image taps never change inclusion', () => {
  const list = renderer.root.findByType(FlatList);
  let card!: TestRenderer.ReactTestRenderer;
  act(() => { card = TestRenderer.create(list.props.renderItem({ item: list.props.data[0], index: 0 })); });
  const checkbox = card.root.findAll(n => n.props.accessibilityLabel === 'Keep Piece 0' && n.props.onPress)[0];
  act(() => checkbox.props.onPress());
  expect(inspect).not.toHaveBeenCalled();
  expect(review.included).toHaveLength(5);
  const image = card.root.findAll(n => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === 'Piece 0, 1 of 6' && n.props.onPress)[0];
  act(() => image.props.onPress());
  expect(inspect).toHaveBeenCalledWith('0');
  expect(review.included).toHaveLength(5);
  act(() => card.unmount());
});
it('keeps phone cards at two columns and adapts to large text', () => {
  expect(reviewColumns(402, 1)).toBe(2);
  expect(reviewColumns(402, 1.6)).toBe(1);
  expect(reviewColumns(768, 1)).toBe(3);
});
