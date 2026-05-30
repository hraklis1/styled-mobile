import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { File } from 'expo-file-system';
import { colors, radii } from '../../theme';

type Props = {
  onAudioReady: (base64: string) => void;
  disabled?: boolean;
};

export function VoiceInputButton({ onAudioReady, disabled }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const animLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  async function handlePressIn() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
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

    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) return;

    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      if (uri) {
        const base64 = await new File(uri).base64();
        onAudioReady(base64);
      }
    } catch {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
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
