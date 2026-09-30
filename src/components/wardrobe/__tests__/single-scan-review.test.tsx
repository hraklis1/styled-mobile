import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScanItemSheet } from '../ScanItemSheet';
import { scanItemDirect, useScanVisionPose, createItemsBatch } from '../../../hooks/useItems';
import { useLibraryLaunch } from '../../../hooks/useCameraLaunch';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../scan-review-workspace', () => ({ ScanReviewWorkspace: 'ReviewWorkspace' }));
jest.mock('@gorhom/bottom-sheet', () => ({ BottomSheetModal: 'BottomSheetModal', BottomSheetScrollView: 'BottomSheetScrollView', BottomSheetBackdrop: 'Backdrop' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }));
jest.mock('../../../hooks/useCameraLaunch', () => ({ useCameraLaunch: jest.fn(() => jest.fn()), useLibraryLaunch: jest.fn() }));
jest.mock('../../../hooks/useItems', () => ({ useScanVisionPose: jest.fn(), scanItemDirect: jest.fn(), createItemsBatch: jest.fn(), applySavedItems: jest.fn(), useBrandSuggestions: () => [] }));
jest.mock('../../../lib/api', () => ({ apiErrorMessage: (_error: unknown, fallback: string) => fallback }));
jest.mock('../../../lib/cropImage', () => ({ cropImage: jest.fn(async () => 'data:image/jpeg;base64,crop') }));
jest.mock('../../../lib/cutout', () => ({ tryRequestCutout: jest.fn(async () => null) }));
jest.mock('../../../lib/uploadImage', () => ({ isDataUri: () => false, uploadDataUrlsToR2: jest.fn(async () => []) }));
jest.mock('../../../lib/photoLocation', () => ({ capturePhotoLocation: jest.fn(async () => null) }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn(async () => ({ base64: 'test' })), SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-scan' }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' }, NotificationFeedbackType: { Success: 'success' } }));

const extract = jest.mocked(scanItemDirect);
const library = jest.fn(async () => ({ uri: 'file:///test.jpg', dataUrl: 'data:image/jpeg;base64,test', width: 100, height: 100 }));
const detect = jest.fn(async () => ({ items: Array.from({ length: 6 }, (_, i) => ({ name: `Piece ${i}`, category: 'top', bbox_pct: { x: 0, y: 0, width: 20, height: 20 } })) }));
let renderer: TestRenderer.ReactTestRenderer;
const workspace = () => renderer.root.findByType('ReviewWorkspace' as never).props;
async function settle() { for (let i = 0; i < 40; i++) await Promise.resolve(); }
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  jest.mocked(useLibraryLaunch).mockReturnValue(library as never);
  jest.mocked(useScanVisionPose).mockReturnValue({ mutateAsync: detect, reset: jest.fn() } as never);
  extract.mockResolvedValue({ name: 'Extracted name', brand: 'Model brand', category: 'top', color: 'Black' } as never);
});
afterEach(() => { if (renderer) act(() => renderer.unmount()); });
async function mount() {
  await act(async () => { renderer = TestRenderer.create(<ScanItemSheet visible autoLaunch="library" onClose={jest.fn()} />); await settle(); });
}

it('makes no speculative requests; extracts only the two kept IDs and retains all six cards', async () => {
  await mount();
  expect(workspace().stage).toBe('pre-extract');
  expect(workspace().pieces).toHaveLength(6);
  expect(extract).not.toHaveBeenCalled();
  const pieces = workspace().pieces;
  act(() => workspace().onInclusionChange(pieces.slice(0, 4).map((p: { id: string }) => ({ id: p.id, included: false }))));
  act(() => workspace().onUpdate(pieces[4].id, { name: 'Corrected shirt', brand: 'COS' }));
  await act(async () => {
    workspace().onExtract(pieces.slice(4).map((p: { id: string }) => p.id), 'extract_now', 0, 1);
    workspace().onExtract(pieces.slice(4).map((p: { id: string }) => p.id), 'extract_now', 0, 1);
    await settle();
  });
  expect(extract).toHaveBeenCalledTimes(2);
  expect(workspace().pieces).toHaveLength(6);
  expect(workspace().pieces.filter((p: { included: boolean }) => p.included)).toHaveLength(2);
  expect(workspace().pieces[4]).toMatchObject({ id: pieces[4].id, name: 'Corrected shirt', brand: 'COS', extraction: 'ready' });
  expect(workspace().pieces[0]).toMatchObject({ id: pieces[0].id, included: false, extraction: 'not-started' });
});

it('retains failures for explicit retry or basic details, then saves only approved IDs', async () => {
  extract.mockRejectedValue(new Error('offline'));
  await mount();
  const id = workspace().pieces[0].id;
  await act(async () => { workspace().onExtract([id], 'extract_now', 0, 0); await settle(); });
  expect(workspace().pieces[0].extraction).toBe('failed');
  act(() => workspace().onKeepBasic([id]));
  expect(workspace().pieces[0].extraction).toBe('ready');
  jest.mocked(createItemsBatch).mockResolvedValue({ items: [{ clientImportId: id, category: 'top' }], rejected: [] } as never);
  await act(async () => { workspace().onSave([id]); await settle(); });
  expect(createItemsBatch).toHaveBeenCalledTimes(1);
  expect(jest.mocked(createItemsBatch).mock.calls[0][0].map(p => p.clientImportId)).toEqual([id]);
});

it('waits for the draft decision and restores exclusion without starting the photo picker', async () => {
  await mount();
  const id = workspace().pieces[0].id;
  await act(async () => { workspace().onInclusionChange([{ id, included: false }]); await settle(); });
  const draft = await AsyncStorage.getItem('scan_review_draft');
  expect(JSON.parse(draft!).pending[0].included).toBe(false);
  act(() => renderer.unmount());
  library.mockClear();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await mount();
  expect(library).not.toHaveBeenCalled();
  const resume = alert.mock.calls.find(([title]) => title === 'Resume previous scan?')![2]!.find(b => b.text === 'Resume')!;
  await act(async () => { resume.onPress!(); await settle(); });
  expect(workspace().pieces[0]).toMatchObject({ id, included: false });
  expect(extract).not.toHaveBeenCalled();
  expect(library).not.toHaveBeenCalled();
  alert.mockRestore();
});
