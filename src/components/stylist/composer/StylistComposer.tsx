import { useEffect, useRef, useState, type RefObject } from 'react';
import { useWindowDimensions, ActivityIndicator, Image, ScrollView, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from '../../../lib/haptics';
import { EditorialIcon } from '../../primitives/EditorialIcon';
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
  placeholder = 'Ask, or describe an occasion…',
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
  // One row (`+ · input · mic`) until the draft wraps, then the input gets the full
  // width and the controls drop below. Sticky until the draft is cleared: the wider
  // input could fit the line again and flip the layout back and forth.
  // Platforms disagree on whether content size includes padding, so compare
  // against the smallest height seen (one line) rather than a fixed constant.
  const [wrapped, setWrapped] = useState(false);
  const oneLineHeightRef = useRef<number | null>(null);
  useEffect(() => {
    if (oneLineHeightRef.current === null || contentHeight < oneLineHeightRef.current) oneLineHeightRef.current = contentHeight;
    if (!value) setWrapped(false);
    else if (contentHeight > oneLineHeightRef.current + 12) setWrapped(true);
  }, [value, contentHeight]);
  const compact = !wrapped && !attachment && !isDictating;
  const showSend = isLoading || canSend;
  const sendButton = showSend ? (
    <Animated.View
      entering={reducedMotion ? undefined : ZoomIn.duration(160)}
      exiting={reducedMotion ? undefined : ZoomOut.duration(120)}
    >
      <Pressable
        style={({ pressed }) => [styles.sendBtn, pressed && styles.pressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          if (isLoading) onStopGeneration(); else onSend();
        }}
        accessibilityRole="button"
        accessibilityLabel={isLoading ? 'Stop generating' : 'Send message'}
      >
        <Ionicons name={isLoading ? 'stop' : 'arrow-up'} size={isLoading ? 13 : 17} color={colors.white} />
      </Pressable>
    </Animated.View>
  ) : null;
  const micButton = (
    <Pressable style={pressStyle} onPress={() => { onStartDictation?.(); void dictation.start(value); }} accessibilityRole="button" accessibilityLabel="Dictate a message">
      <EditorialIcon name="mic" size={19} color={colors.inkSubtle} />
    </Pressable>
  );
  const addButton = (
    <Pressable style={pressStyle} onPress={onOpenAttachmentSheet} accessibilityRole="button" accessibilityLabel="Add a photo or wardrobe piece">
      <EditorialIcon name="image" size={19} color={colors.inkSubtle} />
    </Pressable>
  );

  return (
    <View style={styles.inputBar}>
      <Animated.View style={[styles.composer, cardAnimatedStyle]}>
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
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
        <View style={compact ? styles.compactRow : undefined}>
        <TextInput
          ref={inputRef}
          style={[styles.textInput, compact && styles.textInputCompact, isDictating && { display: 'none' }, { height: Math.min(Math.max(MIN_INPUT_HEIGHT, contentHeight), MAX_INPUT_HEIGHT * fontScale), maxHeight: MAX_INPUT_HEIGHT * fontScale }]}
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
        {compact ? <>{addButton}{micButton}{sendButton}</> : null}
        </View>
        {compact ? null : <View style={styles.composerRow}>
          {addButton}
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
              {micButton}
              {sendButton}
            </>
          )}
        </View>}
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
    // A whisper-light frosted pill: translucent fill over its own blur, a hairline
    // edge, no shadow. The dock behind it blurs the thread as well.
    minHeight: 48, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)', paddingVertical: 2, paddingHorizontal: spacing.xs,
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
    ...typography.text.caption,
    flexShrink: 1,
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
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.1,
    color: colors.foreground,
  },
  sendBtn: {
    width: 32,
    height: 32,
    marginHorizontal: 6,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.65 },
  compactRow: { flexDirection: 'row', alignItems: 'center' },
  textInputCompact: { flex: 1, paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 10 },
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
    ...typography.text.caption,
    color: colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  dictationBars: {
    flex: 1,
    alignItems: 'flex-end',
  },
});
