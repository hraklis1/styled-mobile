import { Paths } from 'expo-file-system';

// iOS moves the app sandbox to a new container UUID on every install and
// update, so absolute file URIs persisted before then point at a directory
// that no longer exists. Photos captured but not yet backed up would look
// missing forever. Rewrite the container prefix to the current sandbox.
const SANDBOX = /^(.*\/Application\/[^/]+)\/(Documents|Library|tmp)(\/.*)?$/;

export function currentSandboxRoot(): string | null {
  return Paths.document.uri.match(SANDBOX)?.[1] ?? null;
}

export function relocateLocalUri(uri: string, root = currentSandboxRoot()): string {
  if (!root) return uri;
  const match = uri.match(SANDBOX);
  if (!match || match[1] === root) return uri;
  return `${root}/${match[2]}${match[3] ?? ''}`;
}

// Persisted state is small and rarely rehydrated; walk it once on load.
export function relocateLocalUris<T>(value: T, root = currentSandboxRoot()): T {
  if (!root) return value;
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return relocateLocalUri(node, root);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      return Object.fromEntries(
        Object.entries(node).map(([key, child]) => [key, walk(child)]),
      );
    }
    return node;
  };
  return walk(value) as T;
}
