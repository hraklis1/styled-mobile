import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Haptics from '../../../lib/haptics';
import { confirmSheet } from '../../primitives/ConfirmSheet';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// Apple/Google network recognition is also free to us and noticeably more
// accurate than the offline models; flip this if privacy ever outweighs that.
const REQUIRES_ON_DEVICE_RECOGNITION = false;

export type DictationState = 'idle' | 'requesting' | 'listening' | 'stopping';

type Options = {
  /** Receives the full composed text (existing draft + dictated words) on every update. */
  onText: (text: string) => void;
  vocabulary?: string[];
};

function composeSegments(base: string, finalized: string, interim: string): string {
  return base + [finalized, interim].filter(Boolean).join(' ');
}

export function useDictation({ onText, vocabulary = [] }: Options) {
  const [state, setState] = useState<DictationState>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const level = useSharedValue(0);
  const [preview, setPreview] = useState({ settled: '', interim: '' });
  const [notice, setNotice] = useState('');
  const vocabularyRef = useRef(vocabulary);
  vocabularyRef.current = vocabulary;
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reset = () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    activeRef.current = false;
    setState('idle');
    setStartedAt(null);
    level.value = withTiming(0, { duration: 160 });
  };

  const requestRef = useRef(0);
  const activeRef = useRef(false);
  const baseTextRef = useRef('');
  const originalTextRef = useRef('');
  const finalizedRef = useRef('');
  const interimRef = useRef('');
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useSpeechRecognitionEvent('start', () => {
    if (!activeRef.current) return;
    setState('listening');
    setStartedAt(Date.now());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!activeRef.current) return;
    const transcript = event.results[0]?.transcript ?? '';
    if (!transcript) return;
    if (Platform.OS === 'ios') {
      // iOS transcripts are cumulative across the session.
      if (event.isFinal) {
        finalizedRef.current = transcript;
        interimRef.current = '';
      } else {
        interimRef.current = transcript;
      }
      setPreview({ settled: baseTextRef.current + (event.isFinal ? transcript : ''), interim: event.isFinal ? '' : transcript });
      onTextRef.current((baseTextRef.current + transcript).slice(0, 2000));
    } else {
      // Android emits per-segment finals when continuous.
      if (event.isFinal) {
        finalizedRef.current = [finalizedRef.current, transcript].filter(Boolean).join(' ');
        interimRef.current = '';
      } else {
        interimRef.current = transcript;
      }
      setPreview({ settled: composeSegments(baseTextRef.current, finalizedRef.current, ''), interim: interimRef.current });
      onTextRef.current(composeSegments(baseTextRef.current, finalizedRef.current, interimRef.current).slice(0, 2000));
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!activeRef.current) return;
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showPermissionAlert();
    } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
      confirmSheet({ title: 'Dictation stopped', message: 'Please try again.', confirmLabel: 'OK', cancelLabel: null, onConfirm: () => {} });
    }
    setNotice(event.error === 'no-speech' ? 'No speech heard. Tap the microphone to try again.' : 'Dictation stopped. Your draft is still here.');
    reset();
  });

  useSpeechRecognitionEvent('end', () => {
    if (!activeRef.current) return;
    setNotice('Ready to review and send.');
    reset();
  });

  useSpeechRecognitionEvent('volumechange', (event) => {
    if (!activeRef.current) return;
    const normalized = Math.min(1, Math.max(0, (event.value + 2) / 12));
    level.value = withTiming(normalized, { duration: 90 });
  });

  useEffect(() => {
    return () => {
      requestRef.current += 1;
      activeRef.current = false;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      ExpoSpeechRecognitionModule.abort();
    };
  }, []);

  const start = useCallback(async (currentText: string) => {
    if (activeRef.current) return;
    activeRef.current = true;
    const request = ++requestRef.current;
    setState('requesting');
    setNotice('');
    originalTextRef.current = currentText;
    setPreview({ settled: currentText, interim: '' });
    const trimmed = currentText.trimEnd();
    baseTextRef.current = trimmed ? `${trimmed} ` : '';
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        confirmSheet({ title: 'Dictation unavailable', message: "Speech recognition isn't available on this device.", confirmLabel: 'OK', cancelLabel: null, onConfirm: () => {} });
        activeRef.current = false;
        setState('idle');
        return;
      }

      let { granted } = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (request !== requestRef.current) return;
      if (!granted) {
        ({ granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync());
      }
      if (request !== requestRef.current) return;
      if (!granted) {
        showPermissionAlert();
        activeRef.current = false;
        setState('idle');
        return;
      }

      finalizedRef.current = '';
      interimRef.current = '';

      let lang = Intl.DateTimeFormat().resolvedOptions().locale;
      try {
        const { locales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
        const normalize = (value: string) => value.replace(/_/g, '-').toLowerCase();
        lang = locales.find(value => normalize(value) === normalize(lang))
          ?? locales.find(value => normalize(value).split('-')[0] === normalize(lang).split('-')[0])
          ?? (locales.length ? locales.find(value => normalize(value) === 'en-us') ?? locales[0] : lang);
      } catch { /* Older Android services cannot enumerate languages. */ }
      if (request !== requestRef.current) return;
      setPreview({ settled: baseTextRef.current, interim: '' });
      ExpoSpeechRecognitionModule.start({
        lang,
        contextualStrings: [...new Set(['Styled', 'cashmere', 'chambray', 'merino', 'bouclé', 'athleisure', 'wide leg', 'smart casual', ...vocabularyRef.current].map(value => value.trim()).filter(Boolean))].slice(0, 100),
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: REQUIRES_ON_DEVICE_RECOGNITION,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
        volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
      });
    } catch {
      if (request !== requestRef.current) return;
      activeRef.current = false;
      setState('idle');
      confirmSheet({ title: 'Dictation unavailable', message: 'Please try again. Your draft is still here.', confirmLabel: 'OK', cancelLabel: null, onConfirm: () => {} });
    }
  }, []);

  const done = useCallback(() => {
    if (!activeRef.current || stopTimerRef.current) return;
    setState('stopping');
    // Preserve the latest words if the native service never delivers its end event.
    stopTimerRef.current = setTimeout(() => {
      activeRef.current = false;
      ExpoSpeechRecognitionModule.abort();
      reset();
      setNotice('Ready to review and send.');
    }, 2500);
    ExpoSpeechRecognitionModule.stop();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const cancel = useCallback(() => {
    requestRef.current += 1;
    activeRef.current = false;
    reset();
    setNotice('');
    ExpoSpeechRecognitionModule.abort();
    onTextRef.current(originalTextRef.current);
    Haptics.selectionAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active' && activeRef.current) {
        requestRef.current += 1;
        reset();
        ExpoSpeechRecognitionModule.abort();
        setNotice('Dictation paused. Your draft is still here.');
      }
    });
    return () => subscription.remove();
  }, []);

  return { state, startedAt, level, preview, notice, start, done, cancel };
}

// The app's own sheet rather than the system alert, so the prompt matches
// the rest of the stylist (same sheet as "Start a new styling session?").
function showPermissionAlert() {
  confirmSheet({
    title: 'Turn on the microphone?',
    message: 'To dictate to your stylist, allow Microphone and Speech Recognition for Styled in Settings.',
    confirmLabel: 'Open Settings',
    cancelLabel: 'Not now',
    onConfirm: () => { Linking.openSettings().catch(() => {}); },
  });
}
