import React, { useLayoutEffect, useRef, useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { FlatList, Text } from 'react-native';
import { PreExtractGrid as ContactSheet } from '../scan-review/PreExtractGrid';
import { ActionBar } from '../scan-review/ActionBar';
import type { ScanReviewPiece } from '../scan-review/types';
import { useBatchExtractionReview } from '../../../hooks/useBatchExtractionReview';
import { applyInclusionChanges, reviewColumns } from '../../../lib/extraction-review';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => '1'), setItem: jest.fn(async () => {}) }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: jest.requireActual('react-native').View, Text: jest.requireActual('react-native').Text }, FadeIn: { duration: () => undefined }, FadeOut: { duration: () => undefined }, LinearTransition: { duration: () => undefined }, useSharedValue: (value: unknown) => ({ value }), useAnimatedStyle: (fn: () => unknown) => fn(), withSequence: (...values: unknown[]) => values[values.length - 1], withTiming: (value: unknown) => value }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));

const makePieces = (): ScanReviewPiece[] => Array.from({ length: 6 }, (_, i) => ({
  id: String(i), name: `Piece ${i}`, brand: '', included: true, extraction: 'not-started', photo: null,
  canAdjustCrop: false, cropSource: null, cropBbox: null,
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
  expect(renderer.root.findAllByType(Text).map(n => n.props.children)).toContain('Select at least one piece');
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

it('shows a set brand as a quiet overline with no per-card brand controls', () => {
  act(() => editBrand('0'));
  const list = renderer.root.findByType(FlatList);
  let card!: TestRenderer.ReactTestRenderer;
  act(() => { card = TestRenderer.create(list.props.renderItem({ item: list.props.data[0], index: 0 })); });
  expect(card.root.findAllByType(Text).some(n => n.props.children === 'COS')).toBe(true);
  expect(card.root.findAll(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Brand for'))).toHaveLength(0);
  act(() => card.unmount());
});

it('bulk editing hides skipped pieces and selects only included pieces', () => {
  const toggle = jest.fn();
  const props = renderer.root.findByType(ContactSheet).props as React.ComponentProps<typeof ContactSheet>;
  const pieces = makePieces().map(p => ({ ...p, included: p.id === '0', brand: 'COS' }));
  let grid!: TestRenderer.ReactTestRenderer;
  let card!: TestRenderer.ReactTestRenderer;
  act(() => { grid = TestRenderer.create(<ContactSheet {...props} pieces={pieces} selection={new Set(['0'])} onToggleSelect={toggle} />); });
  const list = grid.root.findByType(FlatList);
  expect(list.props.data.map((p: ScanReviewPiece) => p.id)).toEqual(['0']);
  act(() => { card = TestRenderer.create(list.props.renderItem({ item: pieces[0], index: 0 })); });
  const edit = card.root.findAll(n => n.props.accessibilityLabel === 'Edit Piece 0' && n.props.onPress && n.props.accessibilityState)[0];
  expect(edit.props.accessibilityState.checked).toBe(true);
  act(() => edit.props.onPress());
  expect(toggle).toHaveBeenCalledWith('0');
  expect(pieces[0]).toMatchObject({ included: true, brand: 'COS' });
  expect(inspect).not.toHaveBeenCalled();
  act(() => { card.unmount(); grid.unmount(); });
});

it.each([0, 1, 35])('keeps %i pieces in stable order, including exclusions', count => {
  const props = renderer.root.findByType(ContactSheet).props as React.ComponentProps<typeof ContactSheet>;
  const pieces = Array.from({ length: count }, (_, i) => ({ ...makePieces()[0], id: String(i), included: i % 2 === 0 }));
  let grid!: TestRenderer.ReactTestRenderer;
  act(() => { grid = TestRenderer.create(<ContactSheet {...props} pieces={pieces} totalCount={count} />); });
  const list = grid.root.findByType(FlatList);
  expect(list.props.data.map((p: ScanReviewPiece) => p.id)).toEqual(pieces.map(p => p.id));
  if (count) expect(list.props.keyExtractor(pieces[count - 1])).toBe(String(count - 1));
  act(() => grid.unmount());
});

describe('pre-extract curation card', () => {
  const { GridCard } = jest.requireActual('../scan-review/GridCard') as typeof import('../scan-review/GridCard');
  const renderCard = (overrides: Partial<React.ComponentProps<typeof GridCard>> = {}, piece: Partial<ScanReviewPiece> = {}) => {
    const props = {
      piece: { ...makePieces()[0], photo: 'file://crop.jpg', ...piece }, index: 0, count: 6, stage: 'pre-extract' as const, state: null, width: 160,
      selected: false, selecting: false, disabled: false, reduceMotion: true, restoreFocus: false,
      onPress: jest.fn(), onToggle: jest.fn(), onCrop: jest.fn(), onBrand: jest.fn(), ...overrides,
    };
    let card!: TestRenderer.ReactTestRenderer;
    act(() => { card = TestRenderer.create(<GridCard {...props} />); });
    return { card, props };
  };
  const plate = (card: TestRenderer.ReactTestRenderer) => card.root.findAll(n => n.props.accessibilityLabel === 'Piece 0, 1 of 6' && n.props.onPress)[0];

  it('opens the crop from the photo, the loupe from the caption, and skips on long press', () => {
    const { card, props } = renderCard();
    act(() => plate(card).props.onPress());
    expect(props.onCrop).toHaveBeenCalledTimes(1);
    expect(props.onPress).not.toHaveBeenCalled();
    act(() => plate(card).props.onLongPress());
    expect(props.onToggle).toHaveBeenCalledTimes(1);
    const caption = card.root.findAll(n => n.props.accessible === false && n.props.onPress)[0];
    act(() => caption.props.onPress());
    expect(props.onPress).toHaveBeenCalledTimes(1);
    act(() => card.unmount());
  });

  it('offers "+ Brand" when empty and the brand itself once set', () => {
    const empty = renderCard();
    const add = empty.card.root.findAll(n => n.props.accessibilityLabel === 'Add brand to Piece 0' && n.props.onPress)[0];
    act(() => add.props.onPress());
    expect(empty.props.onBrand).toHaveBeenCalledTimes(1);
    act(() => empty.card.unmount());
    const set = renderCard({}, { brand: 'COS' });
    expect(set.card.root.findAll(n => n.props.accessibilityLabel === 'Brand COS, change' && n.props.onPress)).toHaveLength(1);
    act(() => set.card.unmount());
  });

  it('keeps the old tap-to-inspect card when no crop handler is given', () => {
    const { card, props } = renderCard({ onCrop: undefined, onBrand: undefined });
    act(() => plate(card).props.onPress());
    expect(props.onPress).toHaveBeenCalledTimes(1);
    act(() => card.unmount());
  });
});

it('extract bar carries no Edit button before extraction', () => {
  expect(renderer.root.findAll(n => n.props.accessibilityLabel === 'Edit pieces' || n.props.children === 'Edit')).toHaveLength(0);
});
