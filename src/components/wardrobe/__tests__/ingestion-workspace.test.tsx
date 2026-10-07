import React, { useLayoutEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ScanReviewWorkspace } from '../scan-review-workspace';
import { applyInclusionChanges } from '../../../lib/extraction-review';
import type { ScanReviewPiece } from '../scan-review/types';

jest.mock('../scan-review/PreExtractGrid', () => ({ PreExtractGrid: 'Grid', PieceLine: 'PieceLine' }));
jest.mock('../scan-review/ItemInspectionModal', () => ({ ItemInspectionModal: 'Inspection' }));
jest.mock('../scan-review/BatchActionBar', () => ({ BatchActionBar: 'Dock' }));
jest.mock('../scan-review/BrandSearchSheet', () => ({ BrandSearchSheet: 'BrandSheet' }));
jest.mock('../scan-review/ActionBar', () => ({ ActionBar: 'Actions' }));
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

const fixture: ScanReviewPiece[] = Array.from({ length: 3 }, (_, i) => ({
  id: String(i), name: `Piece ${i}`, brand: '', included: i !== 2, extraction: 'ready',
  photo: null, cutout: null, useCutout: false, canAdjustCrop: true, cropSource: 'file:///source.jpg', cropBbox: { x: 0, y: 0, width: 1, height: 1 },
  category: null, subcategory: null, color: null, style: null, seasons: [], occasions: [],
  material: null, fit: null, sizeProfile: null, sleeveLength: null,
}));
const applyCrop = jest.fn(async () => {});
let stage: 'review' | 'pre-extract' = 'review';
let latest: ScanReviewPiece[];
let setItems: React.Dispatch<React.SetStateAction<ScanReviewPiece[]>>;
function Harness() {
  const [pieces, setPieces] = useState(fixture);
  useLayoutEffect(() => { latest = pieces; setItems = setPieces; });
  return <ScanReviewWorkspace visible stage={stage} pieces={pieces} brandSuggestions={['COS']}
    extractionProgress={{ current: 0, total: 0 }}
    onUpdate={(id, patch) => setPieces(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p))}
    onInclusionChange={changes => setPieces(ps => applyInclusionChanges(ps, changes))}
    onToggleCutout={jest.fn()} onApplyCrop={applyCrop} onKeepBasic={jest.fn()} onExtract={jest.fn()} onSave={jest.fn()} onClose={jest.fn()} />;
}
let renderer: TestRenderer.ReactTestRenderer;
const node = (name: string) => renderer.root.findByType(name as never);
const menuRow = (label: string) => renderer.root.findAll(n => n.props.onPress && n.findAll(child => child.type === Text && child.props.children === label).length > 0)[0];
const toast = () => renderer.root.findAll(n => typeof n.props.message === 'string' && n.props.onUndo)[0];
const header = () => renderer.root.findAll(n => 'onIncludeAll' in n.props)[0];
beforeEach(() => { act(() => { renderer = TestRenderer.create(<Harness />); }); });
afterEach(() => { act(() => renderer.unmount()); stage = 'review'; });

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
  beforeEach(() => {
    act(() => renderer.unmount());
    stage = 'pre-extract';
    act(() => { renderer = TestRenderer.create(<Harness />); });
  });

  it('keeps the loupe on an unticked piece instead of jumping away', () => {
    act(() => node('Grid').props.onOpen('0'));
    act(() => node('Inspection').props.onToggleIncluded('0'));
    expect(node('Inspection').props.activeId).toBe('0');
    expect(latest[0].included).toBe(false);
  });

  it('keeps an unticked piece in view, dimmed, so it can be ticked back', () => {
    expect(node('Grid').props.pieces.map((p: ScanReviewPiece) => p.id)).toEqual(['0', '1', '2']);
    act(() => node('Grid').props.onToggleIncluded('0'));
    expect(node('Grid').props.pieces.map((p: ScanReviewPiece) => p.id)).toEqual(['0', '1', '2']);
    expect(latest[0].included).toBe(false);
    act(() => node('Grid').props.onToggleIncluded('0'));
    expect(latest[0].included).toBe(true);
  });

  it('opens the brand sheet for one piece from its loupe', () => {
    act(() => node('Grid').props.onOpen('1'));
    act(() => node('Inspection').props.onOpenSheet('brand', '1'));
    act(() => node('BrandSheet').props.onSelect(['1'], 'COS'));
    expect(latest[1].brand).toBe('COS');
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

it('has no Edit menu; season for all lives under the button and needs an included piece', () => {
  expect(node('Actions').props.mode.onBatch).toBeUndefined();
  expect(node('Actions').props.mode.onSeason).toBeDefined();
  act(() => setItems(ps => ps.map(p => ({ ...p, included: false }))));
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
  expect(node('Crop').props.sourceImage).toBe('file:///source.jpg');
  await act(async () => { await node('Crop').props.onApply(fixture[1].cropBbox); });
  expect(applyCrop).toHaveBeenCalledWith('1', fixture[1].cropBbox);
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
  await act(async () => { await node('Crop').props.onApply(fixture[0].cropBbox); });
  expect(node('Crop').props.itemName).toBe('Piece 0');
  expect(latest).toEqual(fixture);
  expect(alert).toHaveBeenCalled();
  act(() => node('Crop').props.onCancel());
  expect(node('Inspection').props.activeId).toBe('0');
  alert.mockRestore();
});
