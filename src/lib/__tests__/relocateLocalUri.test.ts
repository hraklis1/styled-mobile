jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///var/mobile/Containers/Data/Application/NEW-UUID/Documents/' } },
}));
import { relocateLocalUri, relocateLocalUris } from '../relocateLocalUri';

const stale = 'file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/shopping-snaps/a.jpg';
const fresh = 'file:///var/mobile/Containers/Data/Application/NEW-UUID/Documents/shopping-snaps/a.jpg';

it('rewrites a stale sandbox container to the current one', () => {
  expect(relocateLocalUri(stale)).toBe(fresh);
  expect(
    relocateLocalUri('file:///var/mobile/Containers/Data/Application/OLD-UUID/Library/Caches/shopping-previews/u/a.jpg'),
  ).toBe('file:///var/mobile/Containers/Data/Application/NEW-UUID/Library/Caches/shopping-previews/u/a.jpg');
});

it('leaves current, remote, and non-sandbox paths alone', () => {
  expect(relocateLocalUri(fresh)).toBe(fresh);
  expect(relocateLocalUri('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  expect(relocateLocalUri('file:///data/user/0/com.app/files/a.jpg')).toBe('file:///data/user/0/com.app/files/a.jpg');
});

it('walks persisted state without touching other values', () => {
  const state = { pendingUploads: [{ id: 'a', localFileUri: stale, previewUri: null, timestamp: 5 }], nested: { list: [stale] } };
  expect(relocateLocalUris(state)).toEqual({
    pendingUploads: [{ id: 'a', localFileUri: fresh, previewUri: null, timestamp: 5 }],
    nested: { list: [fresh] },
  });
});
