import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DictationLevelBars } from './DictationLevelBars';
import { useDictation } from './useDictation';
import { colors, radii, shadows, spacing, typography } from '../../../theme';
import type { StylistComposerAttachment } from '../../../features/stylist/types';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  /** Programmatic text updates from dictation — must bypass @-mention parsing. */
  onDictatedText: (text: string) => void;
  onSend: () => void;
  onStopGeneration: () => void;
  isLoading: boolean;
  attachment: StylistComposerAttachment | null;
  onRemoveAttachment: () => void;
  onOpenAttachmentSheet: () => void;
};

type RightSlotMode = 'stop' | 'done' | 'send' | 'mic';

const slotEnter = ZoomIn.springify().damping(16).stiffness(220);
const slotExit = ZoomOut.duration(110);

const MIN_INPUT_HEIGHT = 44;
const MAX_INPUT_HEIGHT = 120;

function DictationTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, '0');
  return <Text style={styles.dictationTimer}>{`${minutes}:${seconds}`}</Text>;
}

export function StylistComposer({
  value,
  onChangeText,
  onDictatedText,
  onSend,
  onStopGeneration,
  isLoading,
  attachment,
  onRemoveAttachment,
  onOpenAttachmentSheet,
}: Props) {
  const dictation = useDictation({ onText: onDictatedText });
  const isDictating = dictation.state !== 'idle';
  const isListening = dictation.state === 'listening';

  const focusProgress = useSharedValue(0);
  const listeningProgress = useSharedValue(0);

  useEffect(() => {
    listeningProgress.value = withTiming(isListening ? 1 : 0, { duration: 200 });
  }, [isListening, listeningProgress]);

  // A send can start mid-dictation (e.g. a suggestion chip); finish gracefully.
  const finishDictation = dictation.done;
  useEffect(() => {
    if (isLoading && isListening) finishDictation();
  }, [isLoading, isListening, finishDictation]);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.max(focusProgress.value, listeningProgress.value);
    return {
      borderColor: interpolateColor(progress, [0, 1], [colors.hairline, `${colors.primary}59`]),
      ...(Platform.OS === 'ios'
        ? {
            shadowOpacity: interpolate(progress, [0, 1], [0.05, 0.07]),
            shadowRadius: interpolate(progress, [0, 1], [2, 6]),
          }
        : {}),
    };
  });

  const rightSlotMode: RightSlotMode = isLoading
    ? 'stop'
    : isDictating
      ? 'done'
      : value.trim() || attachment
        ? 'send'
        : 'mic';

  return (
    <View style={styles.inputBar}>
      <Animated.View style={[styles.composer, cardAnimatedStyle]}>
        {attachment ? (
          <Animated.View
            style={styles.attachmentRow}
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
          >
            {attachment.uri ? (
              <View style={styles.attachmentThumbWrap}>
                <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.attachmentBadge}
                  onPress={onRemoveAttachment}
                  hitSlop={8}
                  accessibilityLabel="Remove attachment"
                >
                  <Ionicons name="close" size={12} color={colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.attachmentPill}>
                <Ionicons
                  name={attachment.type === 'photo' ? 'image-outline' : 'shirt-outline'}
                  size={15}
                  color={colors.primary}
                />
                <Text style={styles.attachmentPillLabel} numberOfLines={1}>{attachment.label}</Text>
                <TouchableOpacity onPress={onRemoveAttachment} hitSlop={8} accessibilityLabel="Remove attachment">
                  <Ionicons name="close" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        ) : null}

        <View style={styles.composerRow}>
          <View style={styles.leftSlot}>
            {isDictating ? (
              <Animated.View key="cancel" entering={FadeIn.duration(140)} exiting={FadeOut.duration(110)}>
                <Pressable style={styles.iconBtn} onPress={dictation.cancel} accessibilityLabel="Cancel dictation">
                  <Ionicons name="close" size={22} color={colors.mutedForeground} />
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View key="attach" entering={FadeIn.duration(140)} exiting={FadeOut.duration(110)}>
                <Pressable
                  style={styles.iconBtn}
                  onPress={onOpenAttachmentSheet}
                  disabled={isLoading}
                  accessibilityLabel="Add photo or wardrobe piece"
                >
                  <Ionicons name="add" size={24} color={colors.inkSubtle} />
                </Pressable>
              </Animated.View>
            )}
          </View>

          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => { focusProgress.value = withTiming(1, { duration: 150 }); }}
            onBlur={() => { focusProgress.value = withTiming(0, { duration: 150 }); }}
            placeholder="Ask about an outfit or tag @a piece"
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            maxLength={2000}
            returnKeyType="default"
            editable={!isLoading && !isDictating}
          />

          <View style={styles.rightSlot}>
            {rightSlotMode === 'stop' ? (
              <Animated.View key="stop" entering={slotEnter} exiting={slotExit}>
                <TouchableOpacity style={styles.stopBtn} onPress={onStopGeneration} accessibilityLabel="Stop generating">
                  <Ionicons name="stop" size={14} color={colors.primaryForeground} />
                </TouchableOpacity>
              </Animated.View>
            ) : rightSlotMode === 'done' ? (
              <Animated.View key="done" entering={slotEnter} exiting={slotExit}>
                <TouchableOpacity style={styles.sendBtn} onPress={dictation.done} accessibilityLabel="Finish dictation">
                  <Ionicons name="checkmark" size={20} color={colors.white} />
                </TouchableOpacity>
              </Animated.View>
            ) : rightSlotMode === 'send' ? (
              <Animated.View key="send" entering={slotEnter} exiting={slotExit}>
                <TouchableOpacity style={styles.sendBtn} onPress={onSend} accessibilityLabel="Send message">
                  <Ionicons name="arrow-up" size={19} color={colors.white} />
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <Animated.View key="mic" entering={slotEnter} exiting={slotExit}>
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => { void dictation.start(value); }}
                  accessibilityLabel="Dictate a message"
                >
                  <Ionicons name="mic-outline" size={22} color={colors.inkSubtle} />
                </Pressable>
              </Animated.View>
            )}
          </View>
        </View>

        {isListening ? (
          <Animated.View
            style={styles.dictationStatusRow}
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
          >
            <View style={styles.dictationDot} />
            {dictation.startedAt != null ? <DictationTimer startedAt={dictation.startedAt} /> : null}
            <View style={styles.dictationBars}>
              <DictationLevelBars level={dictation.level} />
            </View>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  composer: {
    minHeight: 50,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 4,
    ...shadows.xs,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  attachmentRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  attachmentThumbWrap: {
    width: 56,
    height: 56,
  },
  attachmentThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSelected,
  },
  attachmentBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
  },
  attachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    maxWidth: '80%',
  },
  attachmentPillLabel: {
    flexShrink: 1,
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  leftSlot: {
    width: 44,
    height: 44,
  },
  rightSlot: {
    width: 44,
    height: 44,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: MIN_INPUT_HEIGHT,
    maxHeight: MAX_INPUT_HEIGHT,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.foreground,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dictationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingBottom: spacing.sm,
    paddingTop: 2,
  },
  dictationDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.error,
  },
  dictationTimer: {
    fontSize: typography.text.caption.fontSize,
    color: colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  dictationBars: {
    flex: 1,
    alignItems: 'flex-end',
  },
});
