/**
 * On-device text-to-speech, guarded so a build that predates this dependency
 * degrades instead of crashing.
 *
 * `expo-speech` is a native module. A TestFlight binary built before it was
 * added to package.json has no linked `ExpoSpeech` native binding — the JS
 * import itself resolves fine (the wrapper module ships in the JS bundle
 * regardless), but the first call that reaches across the bridge throws.
 * `isAvailable()` proves the bridge actually works by making a real,
 * side-effect-free call and memoizing the result, rather than trusting that
 * the import succeeding means anything.
 *
 * Callers must treat `isAvailable() === false` as "use the server fallback",
 * not as an error to surface — see StylistChatView's playTts.
 */
import * as Speech from 'expo-speech';

let _available: boolean | null = null;

export async function isAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  try {
    // Real bridge call, not just a JS-level truthiness check — this is what
    // actually throws on a binary where the native module isn't linked.
    await Speech.isSpeakingAsync();
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

export interface SpeakOptions {
  onDone?: () => void;
  onError?: () => void;
}

/**
 * Speak on-device. Callers should check `isAvailable()` first; this still
 * guards its own call so a mid-session native error (rather than an
 * unlinked-module error) degrades to `onError` instead of throwing into
 * whatever UI handler triggered it.
 */
export function speak(text: string, options: SpeakOptions = {}): void {
  try {
    Speech.speak(text, {
      onDone: options.onDone,
      onStopped: options.onDone,
      onError: options.onError,
    });
  } catch {
    options.onError?.();
  }
}

export function stop(): void {
  try {
    Speech.stop();
  } catch {
    // Nothing to clean up if the module was never really there.
  }
}
