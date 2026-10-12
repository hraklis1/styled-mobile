import { useEffect, useRef, useState, type RefObject } from 'react';
import { useWindowDimensions, ActivityIndicator, Image, ScrollView, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';
import { DictationLevelBars } from './DictationLevelBars';
import { useDictation } from './useDictation';
import { imageColors, colors, radii, spacing, typography } from '../../../theme';
import type { StylistComposerAttachment } from '../../../features/stylist/types';

type Props = {
  value: string;
  vocabulary?: string[];
  onStartDictation?: () => void;
  onChangeText: (text: string) => void;
  /** Programmatic text updates from dictation — must bypass @-mention parsing. */
  onDictatedText: (text: string) => void;
  onSend: () => void;
  onStopGeneration: () => void;
  isLoading: boolean;
  attachment: StylistComposerAttachment | null;
  onRemoveAttachment: () => void;
  onRemovePhoto?: (uri: string) => void;
  onRemoveItem?: (itemId: number) => void;
  onOpenAttachmentSheet: () => void;
  placeholder?: string;
  inputRef?: RefObject<TextInput | null>;
};

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
  vocabulary,
  onStartDictation,
  onChangeText,
  onDictatedText,
  onSend,
  onStopGeneration,
  isLoading,
  attachment,
  onRemoveAttachment,
  onRemoveItem, onRemovePhoto,
  onOpenAttachmentSheet,
  placeholder = 'What are you dressing for?',
  inputRef,
}: Props) {
  const dictation = useDictation({ onText: onDictatedText, vocabulary });
  const transcriptRef = useRef<ScrollView>(null);
  const isDictating = dictation.state !== 'idle';
  const isListening = dictation.state === 'listening';

  const { fontScale } = useWindowDimensions();
  const [contentHeight, setContentHeight] = useState(MIN_INPUT_HEIGHT);
  const reducedMotion = useReducedMotion();
  const focusProgress = useSharedValue(0);
  const listeningProgress = useSharedValue(0);

  useEffect(() => {
    listeningProgress.set(withTiming(isListening ? 1 : 0, { duration: reducedMotion ? 0 : 160 }));
  }, [isListening, listeningProgress, reducedMotion]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(Math.max(focusProgress.get(), listeningProgress.get()), [0, 1], [colors.hairline, colors.controlOutline]),
  }));
  const canSend = !!(value.trim() || attachment) && !isLoading && !isDictating;
  const pressStyle = ({ pressed }: { pressed: boolean }) => [styles.iconBtn, pressed && styles.pressed];

  return (
    <View style={styles.inputBar}>
      <Animated.View style={[styles.composer, cardAnimatedStyle]}>
        {attachment?.type === 'items' ? (
          <View style={{ padding: spacing.sm, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
              <Text style={styles.attachmentPillLabel}>{(attachment.items?.length ?? 0) + (attachment.photos?.length ?? 0)} attached</Text>
              <TouchableOpacity onPress={onRemoveAttachment} style={{ marginLeft: 'auto', padding: spacing.xs }} accessibilityRole="button" accessibilityLabel="Remove all selected pieces">
                <Ionicons name="close" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.xs }}>
              {attachment.photos?.map(photo => (
                <View key={photo.uri} style={styles.attachmentThumbWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.attachmentThumb} resizeMode="cover" />
                  <TouchableOpacity onPress={() => onRemovePhoto?.(photo.uri)} style={styles.attachmentBadge} hitSlop={12} accessibilityRole="button" accessibilityLabel="Remove photo">
                    <Ionicons name="close" size={12} color={colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
              {attachment.items?.map((item) => (
                <View key={item.itemId} style={{ width: 56, gap: spacing.xs }}>
                  <View style={{ width: 48, height: 48, borderRadius: radii.lg, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' }}>
                    {item.uri ? <Image source={{ uri: item.uri }} style={{ width: 48, height: 48, borderRadius: radii.lg }} resizeMode="contain" /> : <Ionicons name="shirt-outline" size={24} color={colors.mutedForeground} />}
                    <TouchableOpacity onPress={() => onRemoveItem?.(item.itemId)} style={styles.attachmentBadge} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${item.label}`}>
                      <Ionicons name="close" size={12} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                  <Text style={{ ...typography.text.caption, color: colors.mutedForeground }} numberOfLines={1}>{item.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : attachment ? (
          <Animated.View
            style={styles.attachmentRow}
            entering={reducedMotion ? undefined : FadeIn.duration(160)}
            exiting={reducedMotion ? undefined : FadeOut.duration(120)}
          >
            {attachment.uri ? (
              <View style={styles.attachmentThumbWrap}>
                <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.attachmentBadge}
                  onPress={onRemoveAttachment}
                  hitSlop={12}
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

        {isDictating ? (
          <ScrollView style={{ maxHeight: MAX_INPUT_HEIGHT * fontScale }} ref={transcriptRef} onContentSizeChange={() => transcriptRef.current?.scrollToEnd({ animated: false })}>
            <Text style={styles.textInput} accessibilityLabel="Live dictation">
              {dictation.preview?.settled}
              <Text style={{ color: colors.mutedForeground }}>{dictation.preview?.settled && dictation.preview?.interim ? ' ' : ''}{dictation.preview?.interim}</Text>
              {!value.trim() ? <Text style={{ color: colors.mutedForeground }}>Tell me what you’re dressing for…</Text> : null}
            </Text>
          </ScrollView>
        ) : null}
        <TextInput
          ref={inputRef}
          style={[styles.textInput, isDictating && { display: 'none' }, { height: Math.min(Math.max(MIN_INPUT_HEIGHT, contentHeight), MAX_INPUT_HEIGHT * fontScale), maxHeight: MAX_INPUT_HEIGHT * fontScale }]}
          onContentSizeChange={(event) => setContentHeight(Math.ceil(event.nativeEvent.contentSize.height))}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => { focusProgress.set(withTiming(1, { duration: reducedMotion ? 0 : 160 })); }}
          onBlur={() => { focusProgress.set(withTiming(0, { duration: reducedMotion ? 0 : 160 })); }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Message your stylist"
          multiline
          textAlignVertical="top"
          maxLength={2000}
          returnKeyType="default"
          editable={!isDictating}
        />
        <View style={styles.composerRow}>
          <Pressable style={pressStyle} onPress={onOpenAttachmentSheet} accessibilityRole="button" accessibilityLabel="Add a photo or wardrobe piece">
            <Ionicons name="add" size={22} color={colors.inkSubtle} />
          </Pressable>
          <View style={{ flex: 1 }} />
          {isDictating ? (
            <>
              {isLoading ? <Pressable style={pressStyle} onPress={onStopGeneration} accessibilityRole="button" accessibilityLabel="Stop generating"><Ionicons name="stop" size={16} color={colors.primary} /></Pressable> : null}
              <Pressable style={pressStyle} onPress={dictation.cancel} accessibilityRole="button" accessibilityLabel="Cancel dictation">
                <Ionicons name="close" size={21} color={colors.inkSubtle} />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.sendBtn, pressed && styles.pressed]} onPress={dictation.done} disabled={!isListening} accessibilityRole="button" accessibilityLabel="Finish dictation" accessibilityState={{ disabled: !isListening }}>
                {isListening ? <Ionicons name="checkmark" size={20} color={colors.white} /> : <ActivityIndicator color={colors.white} />}
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={pressStyle} onPress={() => { onStartDictation?.(); void dictation.start(value); }} accessibilityRole="button" accessibilityLabel="Dictate a message">
                <Ionicons name="mic-outline" size={21} color={colors.inkSubtle} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.sendBtn, !canSend && !isLoading && styles.disabled, pressed && styles.pressed]}
                onPress={isLoading ? onStopGeneration : onSend}
                disabled={!isLoading && !canSend}
                accessibilityRole="button"
                accessibilityLabel={isLoading ? 'Stop generating' : 'Send message'}
                accessibilityState={{ disabled: !isLoading && !canSend }}
              >
                <Ionicons name={isLoading ? 'stop' : 'arrow-up'} size={isLoading ? 15 : 20} color={colors.white} />
              </Pressable>
            </>
          )}
        </View>
        {isDictating && !isListening && (dictation.state === 'requesting' || dictation.state === 'stopping') ? (
          <Text style={styles.statusText} accessibilityLiveRegion="polite">
            {dictation.state === 'requesting' ? 'Starting microphone…' : 'Finishing dictation…'}
          </Text>
        ) : null}

        {!isDictating && dictation.notice ? <Text style={styles.statusText} accessibilityLiveRegion="polite">{dictation.notice}</Text> : null}
        {isListening ? (
          <Animated.View
            style={styles.dictationStatusRow}
            entering={reducedMotion ? undefined : FadeIn.duration(160)}
            exiting={reducedMotion ? undefined : FadeOut.duration(120)}
          >
            <View style={styles.dictationDot} />
            <Text style={styles.dictationTimer}>Listening…</Text>
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
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xs,
  },
  composer: {
    minHeight: 52, backgroundColor: colors.surfaceElevated, borderRadius: 24, borderCurve: 'continuous', boxShadow: '0 2px 10px rgba(36,36,34,0.04)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.controlOutline, padding: spacing.xs,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
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
    backgroundColor: imageColors.surfaceSelected,
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
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    minHeight: MIN_INPUT_HEIGHT,
    maxHeight: MAX_INPUT_HEIGHT,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    fontSize: 17,
    lineHeight: 24,
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
  pressed: { opacity: 0.65 },
  disabled: { backgroundColor: colors.surfaceSelected },
  statusText: { ...typography.text.caption, color: colors.mutedForeground, paddingHorizontal: 12, paddingVertical: 8 },
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
