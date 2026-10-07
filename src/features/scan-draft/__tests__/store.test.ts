import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { SCAN_DRAFT_KEY, SCAN_DRAFT_MAX_AGE_MS, readScanDraft, useScanDraftStore } from '../store';

const draft = (savedAt?: number) => JSON.stringify({ version: 2, savedAt, image: 'img', ready: [{ tempId: 'a' }], pending: [{ tempId: 'a' }, { tempId: 'b' }] });

beforeEach(() => AsyncStorage.clear());

it('returns a fresh draft and summarises its distinct pieces', async () => {
  await AsyncStorage.setItem(SCAN_DRAFT_KEY, draft(Date.now()));
  await useScanDraftStore.getState().refresh();
  expect(useScanDraftStore.getState().summary).toEqual({ count: 2, image: 'img' });
});

it('drops a draft older than the age limit', async () => {
  const now = Date.now();
  await AsyncStorage.setItem(SCAN_DRAFT_KEY, draft(now - SCAN_DRAFT_MAX_AGE_MS - 1));
  expect(await readScanDraft(now)).toBeNull();
  expect(await AsyncStorage.getItem(SCAN_DRAFT_KEY)).toBeNull();
});

it('keeps a legacy draft without savedAt, drops garbage', async () => {
  await AsyncStorage.setItem(SCAN_DRAFT_KEY, draft());
  expect(await readScanDraft()).not.toBeNull();
  await AsyncStorage.setItem(SCAN_DRAFT_KEY, '{nope');
  expect(await readScanDraft()).toBeNull();
});
