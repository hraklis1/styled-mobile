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
jest.mock('../scan-review/feedback', () => ({ selectionFeedback: jest.fn(), bulkFeedback: jest.fn(), cropFeedback: jest.fn() }));
jest.mock('../../../hooks/useReviewReducedMotion', () => ({ useReviewReducedMotion: () => true }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'GestureRoot' }));
jest.mock('react-native-keyboard-controller', () => ({ KeyboardProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

const fixture: ScanReviewPiece[] = Array.from({ length: 3 }, (_, i) => ({
  id: String(i), name: `Piece ${i}`, brand: '', included: i !== 2, extraction: 'ready',
  photo: null, cutout: null, useCutout: false, canAdjustCrop: true, cropSource: 'file:///source.jpg', cropBbox: { x: 0, y: 0, width: 1, height: 1 },
  category: null, subcategory: null, color: null, style: null, seasons: [], occasions: [],
  material: null, fit: null, sizeProfile: null, sleeveLength: null,
}));
const applyCrop = jest.fn(async () => {});
let latest: ScanReviewPiece[];
let setItems: React.Dispatch<React.SetStateAction<ScanReviewPiece[]>>;
function Harness() {
  const [pieces, setPieces] = useState(fixture);
  useLayoutEffect(() => { latest = pieces; setItems = setPieces; });
  return <ScanReviewWorkspace visible stage="review" pieces={pieces} brandSuggestions={['COS']}
    extractionProgress={{ current: 0, total: 0 }}
    onUpdate={(id, patch) => setPieces(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p))}
    onInclusionChange={changes => setPieces(ps => applyInclusionChanges(ps, changes))}
    onToggleCutout={jest.fn()} onApplyCrop={applyCrop} onKeepBasic={jest.fn()} onExtract={jest.fn()} onSave={jest.fn()} onClose={jest.fn()} />;
}
let renderer: TestRenderer.ReactTestRenderer;
const node = (name: string) => renderer.root.findByType(name as never);
function openBrands() {
  const button = renderer.root.findAll(n => n.props.onPress && n.findAll(child => child.type === Text && child.props.children === 'Brand').length > 0)[0];
  act(() => button.props.onPress());
}
beforeEach(() => { act(() => { renderer = TestRenderer.create(<Harness />); }); });
afterEach(() => act(() => renderer.unmount()));

it('opens brand search directly for included pieces without another selection step', () => {
  act(() => node('Grid').props.onFilterChange('check'));
  openBrands();
  expect(node('BrandSheet').props.targetIds).toEqual(['0', '1']);
  expect(renderer.root.findAllByType('Dock' as never)).toHaveLength(0);
  expect(node('Grid').props.selection).toBe(null);
  act(() => node('BrandSheet').props.onSelect(['0', '1'], 'COS'));
  expect(latest.map(p => p.brand)).toEqual(['COS', 'COS', '']);
  expect(latest.map(p => p.included)).toEqual([true, true, false]);
  expect(node('Grid').props.brandFeedback.revision).toBe(1);
  act(() => node('BrandSheet').props.onClose());
  expect(node('Grid').props.filter).toBe('check');
});

it('ignores removed or newly skipped targets when applying a shared brand', () => {
  openBrands();
  act(() => setItems(ps => ps.filter(p => p.id !== '1').map(p => ({ ...p, included: false }))));
  act(() => node('BrandSheet').props.onSelect(['0', '1'], 'COS'));
  expect(latest.every(p => p.brand === '')).toBe(true);
});

it('disables the Brand action when nothing is included', () => {
  act(() => setItems(ps => ps.map(p => ({ ...p, included: false }))));
  const button = renderer.root.findAll(n => n.props.onPress && n.findAll(child => child.type === Text && child.props.children === 'Brand').length > 0)[0];
  expect(button.props.disabled).toBe(true);
  expect(renderer.root.findAllByType('BrandSheet' as never)).toHaveLength(0);
});

it('still allows an individual skipped piece to be tagged from its capsule', () => {
  act(() => node('Grid').props.onBrand('2'));
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
