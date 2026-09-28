import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useClosetSearchHistory } from '../useClosetSearchHistory';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined) } }));
let history: ReturnType<typeof useClosetSearchHistory>;
function Harness({ account, section = 'pieces' }: { account: string; section?: 'pieces' | 'outfits' }) {
  const result = useClosetSearchHistory(account, section);
  React.useEffect(() => { history = result; }, [result]);
  return null;
}
it('isolates accounts and sections, persists five searches, and clears history', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<Harness account="history-a" />); });
  await act(async () => { ['one', 'two', 'three', 'four', 'five', 'six', ' SIX '].forEach(q => history.record(q)); });
  expect(history.recent).toEqual(['SIX', 'five', 'four', 'three', 'two']);
  await act(async () => { renderer.update(<Harness account="history-b" />); });
  expect(history.recent).toEqual([]);
  await act(async () => { renderer.update(<Harness account="history-a" section="outfits" />); });
  expect(history.recent).toEqual([]);
  await act(async () => { renderer.update(<Harness account="history-a" />); });
  expect(history.recent[0]).toBe('SIX');
  await act(async () => history.clear());
  expect(history.recent).toEqual([]);
  act(() => renderer.unmount());
});
it('keeps session history when storage fails', async () => {
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('unavailable'));
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('unavailable'));
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<Harness account="offline" />); });
  await act(async () => history.record('Linen'));
  expect(history.recent).toEqual(['Linen']);
  act(() => renderer.unmount());
  await act(async () => { renderer = TestRenderer.create(<Harness account="offline" />); });
  expect(history.recent).toEqual(['Linen']);
  act(() => renderer.unmount());
});
it('does not overwrite new queries with a late storage read', async () => {
  let resolve!: (value: string) => void;
  jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<Harness account="race" />); });
  await act(async () => history.record('new'));
  await act(async () => resolve('["old"]'));
  expect(history.recent).toEqual(['new']);
  act(() => renderer.unmount());
});
