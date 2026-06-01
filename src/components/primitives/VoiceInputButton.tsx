import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { colors, radii } from '../../theme';

type Props = {
  onAudioReady: (base64: string) => void;
  disabled?: boolean;
};

export function VoiceInputButton({ onAudioReady, disabled }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const animLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  async function handlePressIn() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);

      animLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      animLoopRef.current.start();
    } catch {
      // mic unavailable or denied
    }
  }

  async function handlePressOut() {
    animLoopRef.current?.stop();
    pulseAnim.setValue(1);
    setIsRecording(false);

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (uri) {
        const base64 = await new File(uri).base64();
        onAudioReady(base64);
      }
    } catch {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  }

  return (
    <Pressable
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={disabled ? undefined : handlePressOut}
      disabled={disabled}
      style={[styles.btn, isRecording && styles.btnActive]}
      accessibilityLabel={isRecording ? 'Release to send voice message' : 'Hold to record voice message'}
      accessibilityRole="button"
    >
      <Animated.View style={{ opacity: isRecording ? pulseAnim : 1 }}>
        <Ionicons
          name={isRecording ? 'mic' : 'mic-outline'}
          size={22}
          color={isRecording ? colors.error : colors.mutedForeground}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: `${colors.error}20`,
  },
});
