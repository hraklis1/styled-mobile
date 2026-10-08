import React, { useLayoutEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ScanReviewWorkspace } from '../scan-review-workspace';
import { applyInclusionChanges } from '../../../lib/extraction-review';
import type { ScanReviewPiece } from '../scan-review/types';

jest.mock('../scan-review/PreExtractGrid', () => ({ PreExtractGrid: 'Grid', PieceLine: 'PieceLine' }));
jest.mock('../scan-review/ItemInspectionModal', () => ({ ItemInspectionModal: 'Inspection' }));
jest.mock('../scan-review/PhotoReview', () => ({ PhotoReview: 'PhotoReview' }));
jest.mock('../scan-review/PieceEditorSheet', () => ({ PieceEditorSheet: 'Editor' }));
jest.mock('../scan-review/PieceDetailSheet', () => ({ PieceDetailSheet: 'PieceDetail' }));
jest.mock('../scan-review/atoms', () => ({ ChipRow: 'Chips', TextLink: 'TextLink' }));
jest.mock('../scan-review/BrandSearchSheet', () => ({ BrandSearchSheet: 'BrandSheet' }));
jest.mock('../scan-review/ActionBar', () => ({ ActionBar: 'Actions' }));
jest.mock('../scan-review/usePolishChoice', () => ({ usePolishChoice: () => ({ isPremium: true, polishAll: false, isPolished: () => false, setAll: jest.fn(), setPiece: jest.fn(), costPerPiece: 4, costFor: (n: number) => n * 4, balance: 20 }) }));
jest.mock('../scan-review/WorkspaceSheet', () => ({ WorkspaceSheet: 'Sheet' }));
jest.mock('../scan-review/LoadingStates', () => ({ DetectionState: 'Detection', ExtractionState: 'Extraction' }));
jest.mock('../scan-review/overlays', () => ({ ConfirmationPanel: 'Confirmation' }));
jest.mock('../scan-review/pickers', () => ({ CategoryPicker: 'Category', MaterialPicker: 'Material', SeasonPicker: 'Season', SheetButton: 'SheetButton' }));
jest.mock('../CropAdjustModal', () => ({ CropAdjustEditor: 'Crop' }));
jest.mock('../../primitives/UndoToast', () => ({ UndoToast: 'Toast' }));
jest.mock('../scan-review/feedback', () => ({ selectionFeedback: jest.fn(), bulkFeedback: jest.fn(), cropFeedback: jest.fn() }));
jest.mock('../../../hooks/useReviewReducedMotion', () => ({ useReviewReducedMotion: () => true }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'GestureRoot' }));
jest.mock('react-native-keyboard-controller', () => ({ KeyboardProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const anim = { duration: () => anim };
  return { __esModule: true, default: { View }, FadeInDown: anim, FadeOut: anim };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

// Separate photos by default (a batch: the contact sheet); one photo for the photo-led review.
let onePhoto = false;
const fixture = (): ScanReviewPiece[] => Array.from({ length: 3 }, (_, i) => ({
  id: String(i), name: `Piece ${i}`, brand: '', included: i !== 2, extraction: 'ready',
  photo: null, cutout: null, useCutout: false, canAdjustCrop: true, cropSource: onePhoto ? 'file:///source.jpg' : `file:///source${i}.jpg`, cropBbox: { x: 0, y: 0, width: 1, height: 1 },
  category: null, subcategory: null, color: null, style: null, seasons: [], occasions: [],
  material: null, fit: null, sizeProfile: null, sleeveLength: null,
}));
const applyCrop = jest.fn(async () => {});
let stage: 'review' | 'pre-extract' = 'review';
let addPiece: jest.Mock | undefined;
let latest: ScanReviewPiece[];
let setItems: React.Dispatch<React.SetStateAction<ScanReviewPiece[]>>;
function Harness() {
  const [pieces, setPieces] = useState(() => fixture().map(p => stage === 'pre-extract' ? { ...p, extraction: 'not-started' as const } : p));
  useLayoutEffect(() => { latest = pieces; setItems = setPieces; });
  return <ScanReviewWorkspace visible stage={stage} pieces={pieces} brandSuggestions={['COS']}
    extractionProgress={{ current: 0, total: 0 }}
    onUpdate={(id, patch) => setPieces(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p))}
    onInclusionChange={changes => setPieces(ps => applyInclusionChanges(ps, changes))}
    onToggleCutout={jest.fn()} onApplyCrop={applyCrop} onKeepBasic={jest.fn()} onExtract={jest.fn()} onSave={jest.fn()} onClose={jest.fn()} onAddPiece={addPiece} />;
}
let renderer: TestRenderer.ReactTestRenderer;
const node = (name: string) => renderer.root.findByType(name as never);
const menuRow = (label: string) => renderer.root.findAll(n => n.props.onPress && n.findAll(child => child.type === Text && child.props.children === label).length > 0)[0];
const toast = () => renderer.root.findAll(n => typeof n.props.message === 'string' && n.props.onUndo)[0];
const header = () => renderer.root.findAll(n => 'onIncludeAll' in n.props)[0];
beforeEach(() => { act(() => { renderer = TestRenderer.create(<Harness />); }); });
afterEach(() => { act(() => renderer.unmount()); stage = 'review'; onePhoto = false; });

it('never shows a piece removed before extraction once review begins', () => {
  act(() => setItems(ps => ps.map(p => p.id === '2' ? { ...p, extraction: 'not-started' } : p)));
  expect(node('Grid').props.pieces.map((p: ScanReviewPiece) => p.id)).toEqual(['0', '1']);
  act(() => node('Grid').props.onToggleIncluded('0'));
  act(() => node('Grid').props.onToggleIncluded('1'));
  expect(header().props.onIncludeAll).toBeDefined();
  act(() => header().props.onIncludeAll());
  expect(latest.map(p => p.included)).toEqual([true, true, false]);
});

describe('before extraction', () => {
  const review = () => node('PhotoReview');
  /** The sheet mocks never animate out; closing one is the parent's onClose. */
  const finishClosing = (name: string) => act(() => node(name).props.onClose());
  beforeEach(() => {
    act(() => renderer.unmount());
    stage = 'pre-extract';
    onePhoto = true;
    addPiece = undefined;
    act(() => { renderer = TestRenderer.create(<Harness />); });
  });

  it('keeps an unticked piece in view, dimmed, so it can be ticked back', () => {
    expect(review().props.pieces.map((p: ScanReviewPiece) => p.id)).toEqual(['0', '1', '2']);
    act(() => review().props.onToggleIncluded('0'));
    expect(review().props.pieces.map((p: ScanReviewPiece) => p.id)).toEqual(['0', '1', '2']);
    expect(latest[0].included).toBe(false);
    act(() => review().props.onToggleIncluded('0'));
    expect(latest[0].included).toBe(true);
  });

  it('changes only inclusion from the checkbox, and only the active piece from a marker', () => {
    act(() => review().props.onToggleIncluded('1'));
    expect(renderer.root.findAllByType('Editor' as never)).toHaveLength(0);
    act(() => review().props.onActivate('2'));
    expect(review().props.activeId).toBe('2');
    act(() => review().props.onClearActive());
    expect(review().props.activeId).toBeNull();
    expect(latest.map(p => p.included)).toEqual([true, false, false]);
    expect(renderer.root.findAllByType('Editor' as never)).toHaveLength(0);
  });

  it('opens the editor from a row, and a brand set there returns to the editor and sticks', () => {
    act(() => review().props.onOpen('1'));
    expect(node('Editor').props.piece.id).toBe('1');
    expect(review().props.activeId).toBe('1');
    act(() => node('Editor').props.onBrand());
    finishClosing('Editor');
    act(() => node('BrandSheet').props.onSelect(['1'], 'COS'));
    finishClosing('BrandSheet');
    expect(node('Editor').props.piece).toMatchObject({ id: '1', brand: 'COS' });
    expect(latest[1].brand).toBe('COS');
  });

  it('changes the type from the editor with a category-only picker', () => {
    act(() => review().props.onOpen('0'));
    act(() => node('Editor').props.onType());
    finishClosing('Editor');
    act(() => node('Chips').props.onToggle('shoes'));
    expect(latest[0].category).toBe('shoes');
    finishClosing('Sheet');
    expect(node('Editor').props.piece.id).toBe('0');
  });

  it('goes from the editor to the crop and back, after saving and after cancelling', async () => {
    act(() => review().props.onOpen('1'));
    act(() => node('Editor').props.onCrop());
    finishClosing('Editor');
    expect(node('Crop').props).toMatchObject({ sourceImage: 'file:///source.jpg', applyLabel: 'Save crop' });
    await act(async () => { await node('Crop').props.onApply({ x: 1, y: 2, width: 30, height: 40 }); });
    expect(applyCrop).toHaveBeenCalledWith('1', { x: 1, y: 2, width: 30, height: 40 });
    expect(node('Editor').props.piece.id).toBe('1');
    act(() => node('Editor').props.onCrop());
    finishClosing('Editor');
    act(() => node('Crop').props.onCancel());
    expect(node('Editor').props.piece.id).toBe('1');
  });

  it('adds a brand from the chip under a name, straight from the list', () => {
    act(() => review().props.onBrand('1'));
    expect(node('BrandSheet').props.targetIds).toEqual(['1']);
    expect(renderer.root.findAllByType('Editor' as never)).toHaveLength(0);
    act(() => node('BrandSheet').props.onSelect(['1'], 'COS'));
    act(() => node('BrandSheet').props.onClose());
    expect(latest[1].brand).toBe('COS');
    expect(renderer.root.findAllByType('Editor' as never)).toHaveLength(0);
    expect(toast().props.message).toBe('Add COS to 1 more piece?');
  });

  it('flags a box that repeats an earlier one of the same type', () => {
    act(() => setItems(ps => ps.map(p => ({ ...p, category: 'top', cropBbox: { x: 10, y: 10, width: 40, height: 40 } }))));
    expect(review().props.pieces.map((p: ScanReviewPiece) => p.overlap?.of ?? null)).toEqual([null, '0', '0']);
    // Strong repeats wait in the collapsed duplicates group.
    expect([...review().props.duplicateIds]).toEqual(['1', '2']);
  });

  it('adds a missing piece: draw it, pick a type, then edit it', async () => {
    act(() => renderer.unmount());
    addPiece = jest.fn(async () => '0');
    act(() => { renderer = TestRenderer.create(<Harness />); });
    act(() => review().props.onAddPiece());
    expect(node('Crop').props.title).toBe('Add a piece');
    act(() => node('Crop').props.onApply({ x: 5, y: 5, width: 20, height: 20 }));
    act(() => node('Chips').props.onToggle('shoes'));
    await act(async () => { node('Sheet').props.onClose(); });
    expect(addPiece).toHaveBeenCalledWith({ x: 5, y: 5, width: 20, height: 20 }, 'shoes');
    expect(node('Editor').props.piece.id).toBe('0');
  });
});

it('brands one piece from its pill, then offers the brand to the other unbranded included pieces', () => {
  act(() => node('Grid').props.onBrand('0'));
  expect(node('BrandSheet').props.targetIds).toEqual(['0']);
  act(() => node('BrandSheet').props.onSelect(['0'], 'COS'));
  act(() => node('BrandSheet').props.onClose());
  expect(toast().props.message).toBe('Add COS to 1 more piece?');
  act(() => toast().props.onUndo());
  expect(latest.map(p => p.brand)).toEqual(['COS', 'COS', '']);
  expect(node('Grid').props.brandFeedback.revision).toBe(2);
});

it('skips pieces excluded after the offer appeared', () => {
  act(() => node('Grid').props.onBrand('0'));
  act(() => node('BrandSheet').props.onSelect(['0'], 'COS'));
  act(() => node('BrandSheet').props.onClose());
  act(() => node('Grid').props.onToggleIncluded('1'));
  act(() => toast().props.onUndo());
  expect(latest.map(p => p.brand)).toEqual(['COS', '', '']);
});

it('has no Edit menu and no footer season link', () => {
  expect(node('Actions').props.mode.onBatch).toBeUndefined();
  expect(node('Actions').props.mode.onSeason).toBeUndefined();
});

it('still allows an individual skipped piece to be tagged from the loupe', () => {
  act(() => node('Grid').props.onOpen('2'));
  act(() => node('Inspection').props.onOpenSheet('brand', '2'));
  expect(node('BrandSheet').props.targetIds).toEqual(['2']);
  act(() => node('BrandSheet').props.onSelect(['2'], 'COS'));
  expect(latest[2]).toMatchObject({ included: false, brand: 'COS' });
});

it('returns to the same inspected piece after crop apply and cancel', async () => {
  act(() => node('Grid').props.onOpen('1'));
  act(() => node('Inspection').props.onCrop('1'));
  expect(node('Crop').props.sourceImage).toBe('file:///source1.jpg');
  await act(async () => { await node('Crop').props.onApply(fixture()[1].cropBbox); });
  expect(applyCrop).toHaveBeenCalledWith('1', fixture()[1].cropBbox);
  expect(node('Inspection').props.activeId).toBe('1');
  act(() => node('Inspection').props.onCrop('1'));
  act(() => node('Crop').props.onCancel());
  expect(node('Inspection').props.activeId).toBe('1');
});

it('keeps crop failure recoverable without changing inclusion or metadata', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  applyCrop.mockRejectedValueOnce(new Error('crop failed'));
  act(() => node('Grid').props.onOpen('0'));
  act(() => node('Inspection').props.onCrop('0'));
  await act(async () => { await node('Crop').props.onApply(fixture()[0].cropBbox); });
  expect(node('Crop').props.itemName).toBe('Piece 0');
  expect(latest).toEqual(fixture());
  expect(alert).toHaveBeenCalled();
  act(() => node('Crop').props.onCancel());
  expect(node('Inspection').props.activeId).toBe('0');
  alert.mockRestore();
});

describe('after extraction, from one photo', () => {
  const review = () => node('PhotoReview');
  beforeEach(() => {
    act(() => renderer.unmount());
    onePhoto = true;
    act(() => { renderer = TestRenderer.create(<Harness />); });
  });

  it('keeps the photo review, numbered as before, with the stylist summary', () => {
    expect(node('Actions').props).toBeDefined();
    expect(renderer.root.findAll(n => n.props.heading === 'Your pieces are ready')).not.toHaveLength(0);
    expect(review().props.blurb).toBe('I read the details on 2 pieces. 2 are worth a quick look.');
    expect([...review().props.numbers.entries()]).toEqual([['0', 1], ['1', 2], ['2', 3]]);
  });

  it('opens the detail sheet, and Done retires the piece\'s "worth a look" note', () => {
    expect(review().props.noteFor(latest[0])).toBe('Worth a look');
    act(() => review().props.onOpen('0'));
    expect(node('PieceDetail' as never).props.piece.id).toBe('0');
    act(() => node('PieceDetail').props.onDone());
    act(() => node('PieceDetail').props.onClose());
    expect(review().props.noteFor(latest[0])).toBeNull();
  });

  it('returns to the detail sheet from its material picker', () => {
    act(() => review().props.onOpen('1'));
    act(() => node('PieceDetail').props.onOpenSheet('material'));
    act(() => node('PieceDetail').props.onClose());
    expect(node('Sheet').props.title).toBe('Material');
    act(() => node('Sheet').props.onClose());
    expect(node('PieceDetail').props.piece.id).toBe('1');
  });
});
