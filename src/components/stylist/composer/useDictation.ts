import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
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
};

function composeSegments(base: string, finalized: string, interim: string): string {
  return base + [finalized, interim].filter(Boolean).join(' ');
}

export function useDictation({ onText }: Options) {
  const [state, setState] = useState<DictationState>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const level = useSharedValue(0);

  const baseTextRef = useRef('');
  const finalizedRef = useRef('');
  const interimRef = useRef('');
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useSpeechRecognitionEvent('start', () => {
    setState('listening');
    setStartedAt(Date.now());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (Platform.OS === 'ios') {
      // iOS transcripts are cumulative across the session.
      if (event.isFinal) {
        finalizedRef.current = transcript;
        interimRef.current = '';
      } else {
        interimRef.current = transcript;
      }
      onTextRef.current(baseTextRef.current + (event.isFinal ? finalizedRef.current : interimRef.current));
    } else {
      // Android emits per-segment finals when continuous.
      if (event.isFinal) {
        finalizedRef.current = [finalizedRef.current, transcript].filter(Boolean).join(' ');
        interimRef.current = '';
      } else {
        interimRef.current = transcript;
      }
      onTextRef.current(composeSegments(baseTextRef.current, finalizedRef.current, interimRef.current));
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showPermissionAlert();
    } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
      Alert.alert('Dictation stopped', 'Please try again.');
    }
    // 'end' fires after every error and handles the state reset.
  });

  useSpeechRecognitionEvent('end', () => {
    setState('idle');
    setStartedAt(null);
    level.value = withTiming(0, { duration: 160 });
  });

  useSpeechRecognitionEvent('volumechange', (event) => {
    const normalized = Math.min(1, Math.max(0, (event.value + 2) / 12));
    level.value = withTiming(normalized, { duration: 90 });
  });

  useEffect(() => {
    return () => {
      ExpoSpeechRecognitionModule.abort();
    };
  }, []);

  const start = useCallback(async (currentText: string) => {
    setState((prev) => (prev === 'idle' ? 'requesting' : prev));

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      Alert.alert('Dictation unavailable', "Speech recognition isn't available on this device.");
      setState('idle');
      return;
    }

    let { granted } = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    if (!granted) {
      ({ granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync());
    }
    if (!granted) {
      showPermissionAlert();
      setState('idle');
      return;
    }

    const trimmed = currentText.trimEnd();
    baseTextRef.current = trimmed ? `${trimmed} ` : '';
    finalizedRef.current = '';
    interimRef.current = '';

    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: REQUIRES_ON_DEVICE_RECOGNITION,
      addsPunctuation: true,
      iosTaskHint: 'dictation',
      volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
    });
  }, []);

  const done = useCallback(() => {
    setState('stopping');
    ExpoSpeechRecognitionModule.stop();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const cancel = useCallback(() => {
    setState('stopping');
    ExpoSpeechRecognitionModule.abort();
    onTextRef.current(baseTextRef.current.trimEnd());
    Haptics.selectionAsync().catch(() => {});
  }, []);

  return { state, startedAt, level, start, done, cancel };
}

function showPermissionAlert() {
  Alert.alert(
    'Microphone access needed',
    'To dictate to your stylist, enable Microphone and Speech Recognition for Styled in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => { Linking.openSettings().catch(() => {}); } },
    ],
  );
}
