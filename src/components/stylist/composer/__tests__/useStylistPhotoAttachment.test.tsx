import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressImageToDataUrl } from '../../../../lib/compressImage';
import { useStylistPhotoAttachment } from '../useStylistPhotoAttachment';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(), launchCameraAsync: jest.fn(), requestCameraPermissionsAsync: jest.fn() }));
jest.mock('../../../../lib/compressImage', () => ({ compressImageToDataUrl: jest.fn() }));
const library = ImagePicker.launchImageLibraryAsync as jest.Mock;
const camera = ImagePicker.launchCameraAsync as jest.Mock;
const permission = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const compress = compressImageToDataUrl as jest.Mock;
let picker: ReturnType<typeof useStylistPhotoAttachment>;
let renderer: TestRenderer.ReactTestRenderer;
const closeSheet = jest.fn(), onPhoto = jest.fn(), onChooseCloset = jest.fn();
function Harness() {
  const current = useStylistPhotoAttachment({ closeSheet, onPhoto, onChooseCloset });
  useEffect(() => { picker = current; });
  return null;
}
beforeEach(() => {
  jest.clearAllMocks();
  library.mockResolvedValue({ canceled: true });
  permission.mockResolvedValue({ granted: true });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  act(() => { renderer = TestRenderer.create(<Harness />); });
});
afterEach(() => { act(() => renderer.unmount()); jest.restoreAllMocks(); });

it('waits for native sheet dismissal before opening the photo library and ignores repeated taps', async () => {
  act(() => { picker.choosePhoto('library'); picker.choosePhoto('library'); });
  expect(closeSheet).toHaveBeenCalledTimes(1);
  expect(library).not.toHaveBeenCalled();
  expect(picker.busy).toBe(true);
  await act(async () => { await picker.afterDismiss(); await picker.afterDismiss(); });
  expect(library).toHaveBeenCalledTimes(1);
  expect(library).toHaveBeenCalledWith({ mediaTypes: ['images'], quality: 1 });
  expect(picker.busy).toBe(false);
  expect(onPhoto).not.toHaveBeenCalled();
});

it('attaches the compressed local preview after selection', async () => {
  const asset = { uri: 'file:///original.heic', width: 2000, height: 3000 };
  library.mockResolvedValue({ canceled: false, assets: [asset] });
  compress.mockResolvedValue({ uri: 'file:///preview.jpg', dataUrl: 'data:image/jpeg;base64,image' });
  act(() => picker.choosePhoto('library'));
  await act(async () => picker.afterDismiss());
  expect(compress).toHaveBeenCalledWith(asset);
  expect(onPhoto).toHaveBeenCalledWith({ uri: 'file:///preview.jpg', dataUrl: 'data:image/jpeg;base64,image' });
  expect(picker.busy).toBe(false);
});

it('releases the interaction lock after a picker failure so the user can retry', async () => {
  library.mockRejectedValueOnce(new Error('presentation failed'));
  act(() => picker.choosePhoto('library'));
  await act(async () => picker.afterDismiss());
  expect(Alert.alert).toHaveBeenCalled();
  expect(picker.busy).toBe(false);
  act(() => picker.choosePhoto('library'));
  await act(async () => picker.afterDismiss());
  expect(library).toHaveBeenCalledTimes(2);
});

it('handles denied camera access after dismissal without leaving a blocking modal', async () => {
  permission.mockResolvedValue({ granted: false });
  act(() => picker.choosePhoto('camera'));
  expect(permission).not.toHaveBeenCalled();
  await act(async () => picker.afterDismiss());
  expect(camera).not.toHaveBeenCalled();
  expect(picker.busy).toBe(false);
  expect(Alert.alert).toHaveBeenCalledWith('Camera access needed', expect.any(String));
});

it('waits for dismissal before presenting the closet picker too', async () => {
  act(() => picker.chooseCloset());
  expect(onChooseCloset).not.toHaveBeenCalled();
  await act(async () => picker.afterDismiss());
  expect(onChooseCloset).toHaveBeenCalledTimes(1);
});

it('does not launch a queued picker after the chat unmounts', async () => {
  act(() => picker.choosePhoto('library'));
  act(() => renderer.unmount());
  await act(async () => picker.afterDismiss());
  expect(library).not.toHaveBeenCalled();
});
